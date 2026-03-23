package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

var (
	baseURL     = flag.String("host", "http://localhost:8080", "API base URL")
	count       = flag.Int("count", 3000, "Number of orders to create")
	concurrency = flag.Int("concurrency", 20, "Concurrent workers")
	username    = flag.String("user", "dispatcher01", "Login username")
	password    = flag.String("pass", "demo123", "Login password")
)

type LoginResp struct {
	Data struct {
		Tokens struct {
			AccessToken string `json:"access_token"`
		} `json:"tokens"`
	} `json:"data"`
}

type ListResp struct {
	Data []map[string]interface{} `json:"data"`
}

func main() {
	flag.Parse()
	fmt.Println("═══════════════════════════════════════════════")
	fmt.Println("  BHL OMS — Load Test: Order Creation")
	fmt.Printf("  Target: %s | Orders: %d | Workers: %d\n", *baseURL, *count, *concurrency)
	fmt.Println("═══════════════════════════════════════════════")

	// 1. Login
	fmt.Print("\n[1/4] Logging in... ")
	token, err := login(*baseURL, *username, *password)
	if err != nil {
		fmt.Printf("FAILED: %v\n", err)
		return
	}
	fmt.Println("OK")

	// 2. Load master data
	fmt.Print("[2/4] Loading customers & products... ")
	customers, err := loadIDs(token, *baseURL+"/v1/customers")
	if err != nil {
		fmt.Printf("FAILED: %v\n", err)
		return
	}
	products, err := loadIDs(token, *baseURL+"/v1/products")
	if err != nil {
		fmt.Printf("FAILED: %v\n", err)
		return
	}
	fmt.Printf("OK (%d customers, %d products)\n", len(customers), len(products))

	if len(customers) == 0 || len(products) == 0 {
		fmt.Println("ERROR: No customers or products in database. Seed data first.")
		return
	}

	// 3. Run load test
	fmt.Printf("[3/4] Creating %d orders with %d workers...\n", *count, *concurrency)

	var (
		successCount int64
		errorCount   int64
		latencies    []float64
		mu           sync.Mutex
		wg           sync.WaitGroup
		semaphore    = make(chan struct{}, *concurrency)
	)

	warehouseID := "a0000000-0000-0000-0000-000000000001"
	deliveryDate := time.Now().Add(24 * time.Hour).Format("2006-01-02")
	windows := []string{"08:00-12:00", "09:00-13:00", "13:00-17:00", "14:00-18:00"}

	startTime := time.Now()

	for i := 0; i < *count; i++ {
		wg.Add(1)
		semaphore <- struct{}{}

		go func(idx int) {
			defer wg.Done()
			defer func() { <-semaphore }()

			custID := customers[rand.Intn(len(customers))]
			numItems := rand.Intn(3) + 1
			items := make([]map[string]interface{}, numItems)
			for j := 0; j < numItems; j++ {
				items[j] = map[string]interface{}{
					"product_id": products[rand.Intn(len(products))],
					"quantity":   rand.Intn(50) + 1,
				}
			}

			body := map[string]interface{}{
				"customer_id":   custID,
				"warehouse_id":  warehouseID,
				"delivery_date": deliveryDate,
				"time_window":   windows[rand.Intn(len(windows))],
				"priority":      "normal",
				"notes":         fmt.Sprintf("Load test order #%d", idx+1),
				"items":         items,
			}

			reqStart := time.Now()
			err := createOrder(token, *baseURL, body)
			elapsed := time.Since(reqStart).Seconds()

			mu.Lock()
			latencies = append(latencies, elapsed)
			mu.Unlock()

			if err != nil {
				atomic.AddInt64(&errorCount, 1)
				if atomic.LoadInt64(&errorCount) <= 5 {
					fmt.Printf("  ERROR #%d: %v\n", idx+1, err)
				}
			} else {
				atomic.AddInt64(&successCount, 1)
			}

			if (idx+1)%500 == 0 {
				fmt.Printf("  Progress: %d/%d (%.0f%%)\n", idx+1, *count, float64(idx+1)/float64(*count)*100)
			}
		}(i)
	}

	wg.Wait()
	totalTime := time.Since(startTime).Seconds()

	// 4. Report
	fmt.Println("\n[4/4] Results:")
	fmt.Println("───────────────────────────────────────────────")
	fmt.Printf("  Total time:     %.2f seconds\n", totalTime)
	fmt.Printf("  Success:        %d\n", successCount)
	fmt.Printf("  Errors:         %d\n", errorCount)
	fmt.Printf("  Error rate:     %.2f%%\n", float64(errorCount)/float64(*count)*100)
	fmt.Printf("  Throughput:     %.1f orders/sec\n", float64(successCount)/totalTime)

	if len(latencies) > 0 {
		sort.Float64s(latencies)
		fmt.Printf("  Latency p50:    %.0f ms\n", latencies[len(latencies)/2]*1000)
		fmt.Printf("  Latency p95:    %.0f ms\n", latencies[int(float64(len(latencies))*0.95)]*1000)
		fmt.Printf("  Latency p99:    %.0f ms\n", latencies[int(float64(len(latencies))*0.99)]*1000)
		fmt.Printf("  Latency max:    %.0f ms\n", latencies[len(latencies)-1]*1000)
	}
	fmt.Println("───────────────────────────────────────────────")

	// Pass criteria
	throughput := float64(successCount) / totalTime
	errorRate := float64(errorCount) / float64(*count) * 100
	p95 := latencies[int(float64(len(latencies))*0.95)] * 1000

	fmt.Println("\n  Pass Criteria:")
	printCheck("Throughput > 50 orders/sec", throughput > 50)
	printCheck("Error rate < 1%", errorRate < 1)
	printCheck("p95 latency < 2000ms", p95 < 2000)

	if throughput > 50 && errorRate < 1 && p95 < 2000 {
		fmt.Println("\n  ✅ LOAD TEST PASSED")
	} else {
		fmt.Println("\n  ❌ LOAD TEST FAILED — review metrics above")
	}
}

func printCheck(label string, ok bool) {
	if ok {
		fmt.Printf("    ✅ %s\n", label)
	} else {
		fmt.Printf("    ❌ %s\n", label)
	}
}

func login(base, user, pass string) (string, error) {
	body, _ := json.Marshal(map[string]string{"username": user, "password": pass})
	resp, err := http.Post(base+"/v1/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result LoginResp
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.Data.Tokens.AccessToken == "" {
		return "", fmt.Errorf("login failed: no token returned")
	}
	return result.Data.Tokens.AccessToken, nil
}

func loadIDs(token, url string) ([]string, error) {
	req, _ := http.NewRequest("GET", url+"?limit=500", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result ListResp
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(result.Data))
	for _, item := range result.Data {
		if id, ok := item["id"].(string); ok {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func createOrder(token, base string, body map[string]interface{}) error {
	jsonBody, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", base+"/v1/orders", bytes.NewReader(jsonBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b)[:min(200, len(b))])
	}
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
