package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func main() {
	host := flag.String("host", "http://localhost:8080", "API base URL")
	user := flag.String("user", "dispatcher01", "Username")
	pass := flag.String("pass", "demo123", "Password")
	warehouseID := flag.String("warehouse", "a0000000-0000-0000-0000-000000000001", "Warehouse ID")
	deliveryDate := flag.String("date", "2026-03-22", "Delivery date")
	timeout := flag.Int("timeout", 300, "VRP timeout in seconds")
	flag.Parse()

	fmt.Printf("\n%s\n  BHL OMS — VRP Load Test\n  Target: %s\n  Warehouse: %s\n  Date: %s\n%s\n\n",
		strings.Repeat("=", 50), *host, *warehouseID, *deliveryDate, strings.Repeat("=", 50))

	// 1. Login
	fmt.Print("[1/4] Logging in... ")
	token, err := login(*host, *user, *pass)
	if err != nil {
		fmt.Printf("FAILED: %v\n", err)
		return
	}
	fmt.Println("OK")

	// 2. Check pending shipments
	fmt.Print("[2/4] Checking pending shipments... ")
	count := countPending(*host, token, *deliveryDate)
	fmt.Printf("%d pending\n", count)

	// 3. Run VRP
	fmt.Print("[3/4] Running VRP solver... ")
	start := time.Now()
	jobID, err := runVRP(*host, token, *warehouseID, *deliveryDate)
	if err != nil {
		fmt.Printf("FAILED: %v\n", err)
		return
	}
	fmt.Printf("Job %s\n", jobID)

	// 4. Poll
	fmt.Print("[4/4] Polling for completion... ")
	result, err := pollJob(*host, token, jobID, time.Duration(*timeout)*time.Second)
	elapsed := time.Since(start)

	if err != nil {
		fmt.Printf("FAILED: %v\n", err)
		return
	}
	fmt.Printf("Done in %.1fs\n", elapsed.Seconds())

	// Results
	trips := 0
	stops := 0
	if data, ok := result["data"].(map[string]interface{}); ok {
		if t, ok := data["trips"].([]interface{}); ok {
			trips = len(t)
			for _, trip := range t {
				if tm, ok := trip.(map[string]interface{}); ok {
					if s, ok := tm["stops"].([]interface{}); ok {
						stops += len(s)
					}
				}
			}
		}
		if s, ok := data["status"].(string); ok {
			fmt.Printf("  VRP Status: %s\n", s)
		}
	}

	fmt.Printf("\n%s\n  VRP LOAD TEST RESULTS\n%s\n", strings.Repeat("=", 50), strings.Repeat("=", 50))
	fmt.Printf("  Shipments:  %d\n", count)
	fmt.Printf("  VRP Time:   %.1fs\n", elapsed.Seconds())
	fmt.Printf("  Trips:      %d\n", trips)
	fmt.Printf("  Stops:      %d\n", stops)

	fmt.Println("\n  Criteria:")
	pass1 := elapsed.Seconds() < 120
	pass2 := trips > 0
	printCriteria("VRP completes in < 120s", pass1)
	printCriteria("VRP produces valid trips", pass2)

	if pass1 && pass2 {
		fmt.Printf("\n  ✅ VRP LOAD TEST PASSED\n")
	} else {
		fmt.Printf("\n  ❌ VRP LOAD TEST FAILED\n")
	}
	fmt.Println(strings.Repeat("=", 50))
}

func printCriteria(name string, passed bool) {
	if passed {
		fmt.Printf("    ✅ %s\n", name)
	} else {
		fmt.Printf("    ❌ %s\n", name)
	}
}

func login(host, user, pass string) (string, error) {
	body := fmt.Sprintf(`{"username":"%s","password":"%s"}`, user, pass)
	resp, err := http.Post(host+"/v1/auth/login", "application/json", strings.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	data, _ := result["data"].(map[string]interface{})
	tokens, _ := data["tokens"].(map[string]interface{})
	token, _ := tokens["access_token"].(string)
	if token == "" {
		return "", fmt.Errorf("no token in response")
	}
	return token, nil
}

func countPending(host, token, date string) int {
	req, _ := http.NewRequest("GET", host+"/v1/shipments/pending?delivery_date="+date+"&limit=1", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return -1
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if data, ok := result["data"].(map[string]interface{}); ok {
		if total, ok := data["total"].(float64); ok {
			return int(total)
		}
	}
	return -1
}

func runVRP(host, token, warehouseID, date string) (string, error) {
	body := fmt.Sprintf(`{"warehouse_id":"%s","delivery_date":"%s"}`, warehouseID, date)
	req, _ := http.NewRequest("POST", host+"/v1/planning/run-vrp", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	json.Unmarshal(respBody, &result)
	if data, ok := result["data"].(map[string]interface{}); ok {
		if jobID, ok := data["job_id"].(string); ok {
			return jobID, nil
		}
	}
	return "", fmt.Errorf("no job_id in response: %s", string(respBody))
}

func pollJob(host, token, jobID string, timeout time.Duration) (map[string]interface{}, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		req, _ := http.NewRequest("GET", host+"/v1/planning/jobs/"+jobID, nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			time.Sleep(2 * time.Second)
			continue
		}

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()

		if data, ok := result["data"].(map[string]interface{}); ok {
			status, _ := data["status"].(string)
			switch status {
			case "completed", "done", "success":
				return result, nil
			case "failed", "error":
				errMsg, _ := data["error"].(string)
				return result, fmt.Errorf("VRP failed: %s", errMsg)
			default:
				fmt.Printf(".")
			}
		}
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("timed out after %v", timeout)
}
