// Local latency probe (k6 substitute) for ML + Anomaly endpoints.
// Hits each endpoint N times, prints min/avg/p95/p99/max in ms.
// Usage: go run ./tests/load_probe -token=<JWT> -n=200
package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"
	"time"
)

type endpoint struct {
	name string
	path string
}

func main() {
	base := flag.String("base", "http://localhost:8080", "base url")
	token := flag.String("token", "", "JWT access token")
	n := flag.Int("n", 100, "requests per endpoint")
	conc := flag.Int("c", 10, "concurrency")
	npp := flag.String("npp", "NPP001", "npp code")
	flag.Parse()

	endpoints := []endpoint{
		{"npp_health_one", fmt.Sprintf("/v1/ml/npp/%s/health", *npp)},
		{"npp_health_all", "/v1/ml/npp/health?limit=50"},
		{"sku_suggestions", fmt.Sprintf("/v1/ml/orders/suggestions?customer_code=%s&items=SKU001,SKU002", *npp)},
		{"anomaly_list", "/v1/anomalies?status=open&limit=50"},
	}

	for _, ep := range endpoints {
		probe(*base+ep.path, *token, *n, *conc, ep.name)
	}
}

func probe(url, token string, n, c int, name string) {
	jobs := make(chan int, n)
	results := make([]float64, 0, n)
	var mu sync.Mutex
	var ok, fail int
	var wg sync.WaitGroup

	for w := 0; w < c; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			client := &http.Client{Timeout: 10 * time.Second}
			for range jobs {
				req, _ := http.NewRequest("GET", url, nil)
				if token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
				}
				start := time.Now()
				resp, err := client.Do(req)
				ms := float64(time.Since(start).Microseconds()) / 1000.0
				mu.Lock()
				results = append(results, ms)
				if err != nil || resp.StatusCode >= 500 {
					fail++
				} else {
					ok++
				}
				mu.Unlock()
				if resp != nil {
					io.Copy(io.Discard, resp.Body)
					resp.Body.Close()
				}
			}
		}()
	}

	for i := 0; i < n; i++ {
		jobs <- i
	}
	close(jobs)
	wg.Wait()

	sort.Float64s(results)
	min := results[0]
	max := results[len(results)-1]
	var sum float64
	for _, v := range results {
		sum += v
	}
	avg := sum / float64(len(results))
	p95 := results[int(float64(len(results))*0.95)]
	p99 := results[int(float64(len(results))*0.99)]

	pass := "PASS"
	if p95 >= 500 {
		pass = "FAIL (p95 >= 500ms)"
	}
	fmt.Printf("[%s] %s\n  ok=%d fail=%d  min=%.1f avg=%.1f p95=%.1f p99=%.1f max=%.1f ms\n",
		pass, name, ok, fail, min, avg, p95, p99, max)
}
