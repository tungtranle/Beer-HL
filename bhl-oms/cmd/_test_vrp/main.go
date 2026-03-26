package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const baseURL = "http://localhost:8097"

func main() {
	// 1. Login as dispatcher
	loginBody := []byte(`{"username":"dispatcher01","password":"demo123"}`)
	resp, err := http.Post(baseURL+"/v1/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		fmt.Println("Login HTTP error:", err)
		os.Exit(1)
	}
	b, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 {
		fmt.Printf("Login failed %d: %s\n", resp.StatusCode, string(b))
		os.Exit(1)
	}

	var loginResp struct {
		Data struct {
			Tokens struct {
				AccessToken string `json:"access_token"`
			} `json:"tokens"`
		} `json:"data"`
	}
	json.Unmarshal(b, &loginResp)
	token := loginResp.Data.Tokens.AccessToken
	fmt.Println("Login OK, token length:", len(token))
	if token == "" {
		fmt.Println("No token returned. Raw:", string(b)[:minInt(300, len(b))])
		os.Exit(1)
	}

	// 2. Load SC-09 scenario (no auth needed — test-portal is public)
	scenarioBody := []byte(`{"scenario_id":"SC-09"}`)
	req2, _ := http.NewRequest("POST", baseURL+"/v1/test-portal/load-scenario", bytes.NewReader(scenarioBody))
	req2.Header.Set("Content-Type", "application/json")
	resp2, err := http.DefaultClient.Do(req2)
	if err != nil {
		fmt.Println("Load scenario error:", err)
		os.Exit(1)
	}
	b2, _ := io.ReadAll(resp2.Body)
	resp2.Body.Close()
	fmt.Printf("SC-09 load: %d %s\n", resp2.StatusCode, string(b2)[:minInt(300, len(b2))])
	if resp2.StatusCode != 200 {
		os.Exit(1)
	}

	// 3. Get warehouse ID
	req3, _ := http.NewRequest("GET", baseURL+"/v1/warehouses", nil)
	req3.Header.Set("Authorization", "Bearer "+token)
	resp3, err := http.DefaultClient.Do(req3)
	if err != nil {
		fmt.Println("Warehouse error:", err)
		os.Exit(1)
	}
	b3, _ := io.ReadAll(resp3.Body)
	resp3.Body.Close()

	var whResp struct {
		Data []struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		} `json:"data"`
	}
	json.Unmarshal(b3, &whResp)

	whID := ""
	for _, w := range whResp.Data {
		if w.Code == "WH-HL" {
			whID = w.ID
			break
		}
	}
	if whID == "" && len(whResp.Data) > 0 {
		whID = whResp.Data[0].ID
	}
	fmt.Println("Warehouse:", whID)

	// 4. Today's date for delivery_date
	today := time.Now().Format("2006-01-02")
	fmt.Println("Delivery date:", today)

	// 5. Run VRP — POST /v1/planning/run-vrp (no vehicle_ids = use all available)
	vrpPayload := map[string]interface{}{
		"warehouse_id":  whID,
		"delivery_date": today,
		"criteria": map[string]interface{}{
			"max_capacity":     1,
			"min_vehicles":     2,
			"cluster_region":   3,
			"time_limit":       4,
			"balance_load":     5,
			"min_distance":     6,
			"max_trip_minutes": 480,
		},
	}
	vrpBody, _ := json.Marshal(vrpPayload)
	req5, _ := http.NewRequest("POST", baseURL+"/v1/planning/run-vrp", bytes.NewReader(vrpBody))
	req5.Header.Set("Authorization", "Bearer "+token)
	req5.Header.Set("Content-Type", "application/json")
	resp5, err := http.DefaultClient.Do(req5)
	if err != nil {
		fmt.Println("VRP error:", err)
		os.Exit(1)
	}
	b5, _ := io.ReadAll(resp5.Body)
	resp5.Body.Close()
	fmt.Printf("VRP response: %d\n", resp5.StatusCode)

	var vrpStartResp struct {
		Data struct {
			JobID  string `json:"job_id"`
			Status string `json:"status"`
		} `json:"data"`
	}
	json.Unmarshal(b5, &vrpStartResp)
	jobID := vrpStartResp.Data.JobID
	fmt.Println("Job ID:", jobID)
	if jobID == "" {
		fmt.Println("No job ID. Raw:", string(b5)[:minInt(500, len(b5))])
		os.Exit(1)
	}

	// 6. Poll for result
	var resultBody []byte
	for i := 0; i < 10; i++ {
		time.Sleep(1 * time.Second)
		req6, _ := http.NewRequest("GET", baseURL+"/v1/planning/jobs/"+jobID, nil)
		req6.Header.Set("Authorization", "Bearer "+token)
		resp6, err := http.DefaultClient.Do(req6)
		if err != nil {
			continue
		}
		resultBody, _ = io.ReadAll(resp6.Body)
		resp6.Body.Close()
		if resp6.StatusCode == 200 {
			break
		}
		fmt.Printf("  polling... %d\n", resp6.StatusCode)
	}

	var vrpResult struct {
		Data struct {
			Status  string `json:"status"`
			Summary struct {
				TotalTrips          int     `json:"total_trips"`
				AvgCapacityUtilPct  float64 `json:"avg_capacity_util_pct"`
				TotalDistanceKm     float64 `json:"total_distance_km"`
				TotalWeightKg       float64 `json:"total_weight_kg"`
				UnassignedShipments int     `json:"unassigned_shipments"`
				ConsolidatedStops   int     `json:"consolidated_stops"`
				SplitDeliveries     int     `json:"split_deliveries"`
			} `json:"summary"`
			Trips []struct {
				PlateNumber     string  `json:"plate_number"`
				VehicleType     string  `json:"vehicle_type"`
				TotalWeightKg   float64 `json:"total_weight_kg"`
				TotalDistanceKm float64 `json:"total_distance_km"`
				Stops           []struct {
					CustomerName string  `json:"customer_name"`
					WeightKg     float64 `json:"weight_kg"`
				} `json:"stops"`
			} `json:"trips"`
		} `json:"data"`
	}

	if err := json.Unmarshal(resultBody, &vrpResult); err != nil {
		fmt.Printf("VRP parse error: %v\nRaw: %s\n", err, string(resultBody)[:minInt(500, len(resultBody))])
		os.Exit(1)
	}

	s := vrpResult.Data.Summary
	fmt.Println("\n════════════ VRP RESULTS ════════════")
	fmt.Printf("Status:               %s\n", vrpResult.Data.Status)
	fmt.Printf("Total Trips:          %d\n", s.TotalTrips)
	fmt.Printf("Avg Capacity Util:    %.1f%%\n", s.AvgCapacityUtilPct)
	fmt.Printf("Total Distance:       %.0f km\n", s.TotalDistanceKm)
	fmt.Printf("Total Weight:         %.0f kg\n", s.TotalWeightKg)
	fmt.Printf("Unassigned:           %d\n", s.UnassignedShipments)
	fmt.Printf("Consolidated Stops:   %d\n", s.ConsolidatedStops)
	fmt.Printf("Split Deliveries:     %d\n", s.SplitDeliveries)

	// Print per-trip details
	fmt.Println("\n──── Per-Trip Details ────")
	for i, t := range vrpResult.Data.Trips {
		fmt.Printf("Trip %2d: %-12s %-10s  %6.0f kg  %3d stops  %7.1f km\n",
			i+1, t.PlateNumber, t.VehicleType, t.TotalWeightKg, len(t.Stops), t.TotalDistanceKm)
	}

	// Check pass/fail
	fmt.Println("\n──── VERDICT ────")
	if s.AvgCapacityUtilPct >= 85 {
		fmt.Printf("PASS: %.1f%% >= 85%% target\n", s.AvgCapacityUtilPct)
	} else {
		fmt.Printf("FAIL: %.1f%% < 85%% target\n", s.AvgCapacityUtilPct)
	}
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
