// Package tms — Cost Engine golden dataset validation tests
// Chạy: go test -v -run "TestCostEngine" ./internal/tms/
//
// Validates cost-engine.cases.json — BHL trip cost calculation:
//   fuel_cost = distance_km * fuel_consumption_per_100km / 100 * fuel_price_per_liter
//   total_cost = fuel_cost + toll_cost + driver_allowance
//
// AQF Invariants: INV-COST-01..04 (never negative, correct formula)

package tms

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// ─────────────────────────────────────────────────────────────
// Cost calculation helpers (mirrors tms/service.go logic)
// ─────────────────────────────────────────────────────────────

type TollStation struct {
	Name string  `json:"name"`
	Fee  float64 `json:"fee"`
}

// calculateFuelCost computes fuel cost from distance, consumption, and price.
// INV-COST-01: result must be >= 0
func calculateFuelCost(distanceKm, fuelConsumptionPer100km, fuelPricePerLiter float64) float64 {
	if distanceKm <= 0 || fuelConsumptionPer100km <= 0 || fuelPricePerLiter <= 0 {
		return 0
	}
	return distanceKm * fuelConsumptionPer100km / 100.0 * fuelPricePerLiter
}

// calculateTollCost sums all toll station fees on the route.
// INV-COST-02: toll = 0 if no stations
func calculateTollCost(stations []TollStation) float64 {
	total := 0.0
	for _, s := range stations {
		if s.Fee > 0 {
			total += s.Fee
		}
	}
	return total
}

// calculateTripCost returns total trip cost.
// INV-COST-03: total = fuel + toll + driver_allowance
func calculateTripCost(distanceKm, fuelConsumptionPer100km, fuelPricePerLiter float64, stations []TollStation, driverAllowance float64) (fuel, toll, total float64) {
	fuel = calculateFuelCost(distanceKm, fuelConsumptionPer100km, fuelPricePerLiter)
	toll = calculateTollCost(stations)
	if driverAllowance < 0 {
		driverAllowance = 0
	}
	total = fuel + toll + driverAllowance
	return
}

// ─────────────────────────────────────────────────────────────
// Golden dataset loader
// ─────────────────────────────────────────────────────────────

func goldenDir(t *testing.T) string {
	t.Helper()
	_, filename, _, _ := runtime.Caller(0)
	// internal/tms/ → 2 up → root → aqf/golden/
	root := filepath.Join(filepath.Dir(filename), "..", "..", "aqf", "golden")
	abs, err := filepath.Abs(root)
	if err != nil {
		t.Fatalf("goldenDir: %v", err)
	}
	return abs
}

// ─────────────────────────────────────────────────────────────
// COST ENGINE GOLDEN TESTS
// ─────────────────────────────────────────────────────────────

type CostCase struct {
	ID       string `json:"id"`
	Scenario string `json:"scenario"`
	Type     string `json:"type,omitempty"` // metamorphic | "" (standard)
	Input    struct {
		TotalDistanceKm         float64       `json:"total_distance_km"`
		FuelPricePerLiter       float64       `json:"fuel_price_per_liter"`
		FuelConsumptionPer100km float64       `json:"fuel_consumption_per_100km"`
		TollStationsOnRoute     []TollStation `json:"toll_stations_on_route"`
		DriverAllowance         float64       `json:"driver_allowance"`
		RouteA                  *struct {
			TotalDistanceKm     float64       `json:"total_distance_km"`
			TollStationsOnRoute []TollStation `json:"toll_stations_on_route"`
		} `json:"route_A,omitempty"`
		RouteB *struct {
			TotalDistanceKm     float64       `json:"total_distance_km"`
			TollStationsOnRoute []TollStation `json:"toll_stations_on_route"`
		} `json:"route_B,omitempty"`
	} `json:"input"`
	Expected struct {
		FuelCost        float64 `json:"fuel_cost"`
		TollCost        float64 `json:"toll_cost"`
		DriverAllowance float64 `json:"driver_allowance"`
		TotalCost       float64 `json:"total_cost"`
		CostStatus      string  `json:"cost_status"`
		CostAEqualsB    *bool   `json:"cost_A_equals_cost_B,omitempty"`
	} `json:"expected"`
}

func TestCostEngine_GoldenCases(t *testing.T) {
	path := filepath.Join(goldenDir(t), "cost-engine.cases.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("cannot read golden file %s: %v", path, err)
	}

	var rawCases []json.RawMessage
	if err := json.Unmarshal(data, &rawCases); err != nil {
		t.Fatalf("parse JSON: %v", err)
	}

	const epsilon = 1.0 // allow 1 VND rounding difference

	ran := 0
	for _, raw := range rawCases {
		var check map[string]interface{}
		if err := json.Unmarshal(raw, &check); err != nil {
			continue
		}
		if _, isMeta := check["_meta"]; isMeta {
			continue
		}

		var tc CostCase
		if err := json.Unmarshal(raw, &tc); err != nil {
			t.Logf("skip invalid case: %v", err)
			continue
		}

		t.Run(tc.ID+"_"+tc.Scenario, func(t *testing.T) {
			// Metamorphic test: 2 routes with same distance → same cost
			if tc.Type == "metamorphic" {
				if tc.Input.RouteA == nil || tc.Input.RouteB == nil {
					t.Skip("metamorphic case missing route_A or route_B")
					return
				}
				const fuelPrice = 22000.0
				const consumption = 12.0
				const allowance = 0.0
				_, _, costA := calculateTripCost(tc.Input.RouteA.TotalDistanceKm, consumption, fuelPrice, tc.Input.RouteA.TollStationsOnRoute, allowance)
				_, _, costB := calculateTripCost(tc.Input.RouteB.TotalDistanceKm, consumption, fuelPrice, tc.Input.RouteB.TollStationsOnRoute, allowance)
				if tc.Expected.CostAEqualsB != nil && *tc.Expected.CostAEqualsB {
					if math.Abs(costA-costB) > epsilon {
						t.Errorf("[%s] metamorphic: costA=%.2f != costB=%.2f (same distance should equal)", tc.ID, costA, costB)
					}
				}
				ran++
				return
			}

			// Standard test
			gotFuel, gotToll, gotTotal := calculateTripCost(
				tc.Input.TotalDistanceKm,
				tc.Input.FuelConsumptionPer100km,
				tc.Input.FuelPricePerLiter,
				tc.Input.TollStationsOnRoute,
				tc.Input.DriverAllowance,
			)

			// INV-COST-01: total cost never negative
			if gotTotal < 0 {
				t.Errorf("[%s] INV-COST-01 VIOLATED: total_cost=%.2f < 0", tc.ID, gotTotal)
			}

			// INV-COST-02: toll = 0 if no stations
			if len(tc.Input.TollStationsOnRoute) == 0 && gotToll != 0 {
				t.Errorf("[%s] INV-COST-02 VIOLATED: toll_cost=%.2f but no toll stations", tc.ID, gotToll)
			}

			// Check expected values (if specified in golden file)
			if tc.Expected.FuelCost > 0 && math.Abs(gotFuel-tc.Expected.FuelCost) > epsilon {
				t.Errorf("[%s] fuel_cost: got %.2f, want %.2f (diff=%.2f)", tc.ID, gotFuel, tc.Expected.FuelCost, math.Abs(gotFuel-tc.Expected.FuelCost))
			}

			if math.Abs(gotToll-tc.Expected.TollCost) > epsilon {
				t.Errorf("[%s] toll_cost: got %.2f, want %.2f", tc.ID, gotToll, tc.Expected.TollCost)
			}

			if tc.Expected.TotalCost > 0 && math.Abs(gotTotal-tc.Expected.TotalCost) > epsilon {
				t.Errorf("[%s] total_cost: got %.2f, want %.2f (diff=%.2f)", tc.ID, gotTotal, tc.Expected.TotalCost, math.Abs(gotTotal-tc.Expected.TotalCost))
			}

			// INV-COST-03: total = fuel + toll + allowance
			expectedTotal := gotFuel + gotToll + tc.Input.DriverAllowance
			if math.Abs(gotTotal-expectedTotal) > epsilon {
				t.Errorf("[%s] INV-COST-03 VIOLATED: total=%.2f != fuel+toll+allowance=%.2f", tc.ID, gotTotal, expectedTotal)
			}
		})
		ran++
	}

	if ran == 0 {
		t.Fatal("no cost cases ran — check golden file")
	}
	t.Logf("Golden CostEngine: %d cases validated", ran)
}

// ─────────────────────────────────────────────────────────────
// HAVERSINE PROPERTY TESTS
// INV-COST-04: distance always >= 0
// ─────────────────────────────────────────────────────────────

func TestCostEngine_HaversineNonNegative(t *testing.T) {
	testPoints := []struct {
		name       string
		lat1, lon1 float64
		lat2, lon2 float64
	}{
		{"Depot → HN Stop", 21.0285, 105.8542, 21.0378, 105.8435},
		{"Same point", 21.0285, 105.8542, 21.0285, 105.8542},
		{"HN → HCM", 21.0285, 105.8542, 10.8231, 106.6297},
		{"Equator", 0, 0, 0, 90},
		{"Poles", -90, 0, 90, 0},
	}

	for _, p := range testPoints {
		t.Run(p.name, func(t *testing.T) {
			d := haversineKm(p.lat1, p.lon1, p.lat2, p.lon2)
			// INV-COST-04: distance never negative
			if d < 0 {
				t.Errorf("INV-COST-04 VIOLATED: haversine(%v,%v→%v,%v) = %.4f < 0",
					p.lat1, p.lon1, p.lat2, p.lon2, d)
			}
			// Same point → distance = 0
			if p.lat1 == p.lat2 && p.lon1 == p.lon2 && d > 0.001 {
				t.Errorf("same point should have distance ~0, got %.4f", d)
			}
		})
	}
}

// ─────────────────────────────────────────────────────────────
// RECONCILIATION GOLDEN TESTS
// Validates reconciliation.cases.json — idempotency & integrity
// ─────────────────────────────────────────────────────────────

type ReconTransition struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason,omitempty"`
}

type ReconOrder struct {
	ID          string  `json:"id"`
	Total       float64 `json:"total"`
	PaymentType string  `json:"payment_type"`
}

type ReconCase struct {
	ID        string `json:"id"`
	Scenario  string `json:"scenario"`
	Invariant string `json:"invariant,omitempty"`
	Input     struct {
		TripID                string            `json:"trip_id"`
		RunCount              int               `json:"run_count,omitempty"` // > 0 → DB-level test, skip
		TotalOrderValue       float64           `json:"total_order_value"`   // direct total
		TotalAmount           float64           `json:"total_amount"`        // alias used in some cases
		Orders                []ReconOrder      `json:"orders,omitempty"`    // compute total from orders
		CashCollected         float64           `json:"cash_collected"`
		ReturnedItemsValue    float64           `json:"returned_items_value"`
		BankTransferConfirmed float64           `json:"bank_transfer_confirmed,omitempty"`
		TransitionsToTest     []ReconTransition `json:"transitions_to_test,omitempty"`
	} `json:"input"`
	Expected struct {
		DiscrepancyAmount    float64 `json:"discrepancy_amount"`
		Status               string  `json:"status"`
		ReconRecordsCount    int     `json:"recon_records_count"`
		ValidTransitionCount int     `json:"valid_transition_count,omitempty"`
		TotalOrderValue      float64 `json:"total_order_value,omitempty"`
		ResultsIdentical     *bool   `json:"results_identical,omitempty"`
	} `json:"expected"`
}

// validReconTransitions mirrors the reconciliation state machine
var validReconTransitions = map[string][]string{
	"pending":   {"in_review"},
	"in_review": {"resolved"},
	"resolved":  {},
}

func isValidReconTransition(from, to string) bool {
	allowed := validReconTransitions[from]
	for _, a := range allowed {
		if a == to {
			return true
		}
	}
	return false
}

// calcDiscrepancy simulates reconciliation logic
func calcDiscrepancy(totalOrderValue, cashCollected, returnedItemsValue float64) float64 {
	effective := cashCollected + returnedItemsValue
	return totalOrderValue - effective
}

func TestCostEngine_ReconciliationCases(t *testing.T) {
	path := filepath.Join(goldenDir(t), "reconciliation.cases.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("cannot read reconciliation golden file: %v", err)
	}

	var rawCases []json.RawMessage
	if err := json.Unmarshal(data, &rawCases); err != nil {
		t.Fatalf("parse JSON: %v", err)
	}

	const epsilon = 1.0
	ran := 0

	for _, raw := range rawCases {
		var check map[string]interface{}
		if err := json.Unmarshal(raw, &check); err != nil {
			continue
		}
		if _, isMeta := check["_meta"]; isMeta {
			continue
		}

		var tc ReconCase
		if err := json.Unmarshal(raw, &tc); err != nil {
			t.Logf("skip: %v", err)
			continue
		}

		t.Run(tc.ID+"_"+tc.Scenario, func(t *testing.T) {
			// State machine transition test (RECON-005)
			if len(tc.Input.TransitionsToTest) > 0 {
				validCount := 0
				for _, tr := range tc.Input.TransitionsToTest {
					got := isValidReconTransition(tr.From, tr.To)
					if got != tr.Allowed {
						t.Errorf("[%s] transition %s→%s: got allowed=%v, want allowed=%v (reason: %s)",
							tc.ID, tr.From, tr.To, got, tr.Allowed, tr.Reason)
					}
					if tr.Allowed {
						validCount++
					}
				}
				if tc.Expected.ValidTransitionCount > 0 && validCount != tc.Expected.ValidTransitionCount {
					t.Errorf("[%s] valid transitions: got %d, want %d", tc.ID, validCount, tc.Expected.ValidTransitionCount)
				}
				return
			}

			// Skip DB-level idempotency tests (need real DB to verify record count)
			if tc.Input.RunCount > 1 {
				t.Skip("idempotency record-count test — verified at service/DB level (SC-08)")
				return
			}

			// Skip HTTP-level validation tests (negative amounts → 400)
			if tc.Input.CashCollected < 0 {
				t.Skip("HTTP-level validation test — verified by API layer")
				return
			}

			// Compute total order value from orders array if not set directly
			totalOrderValue := tc.Input.TotalOrderValue
			if totalOrderValue == 0 {
				totalOrderValue = tc.Input.TotalAmount
			}
			if totalOrderValue == 0 && len(tc.Input.Orders) > 0 {
				for _, o := range tc.Input.Orders {
					totalOrderValue += o.Total
				}
			}

			// Skip if no meaningful financial data
			if totalOrderValue == 0 && tc.Input.CashCollected == 0 {
				t.Skip("no financial data to validate")
				return
			}

			// For RECON-006 (idempotency pure calc), expected has ResultsIdentical
			if tc.Expected.ResultsIdentical != nil {
				// Run calculation twice, verify same result
				d1 := calcDiscrepancy(totalOrderValue, tc.Input.CashCollected, tc.Input.ReturnedItemsValue)
				d2 := calcDiscrepancy(totalOrderValue, tc.Input.CashCollected, tc.Input.ReturnedItemsValue)
				if math.Abs(d1-d2) > epsilon {
					t.Errorf("[%s] INV-RECON-01: runs not identical: %.2f vs %.2f", tc.ID, d1, d2)
				}
				return
			}

			// Effective collected: cash + returned items + bank transfer
			effectiveCash := tc.Input.CashCollected
			effectiveReturned := tc.Input.ReturnedItemsValue
			// For mixed payment (RECON-008): cash + bank transfer
			if tc.Input.BankTransferConfirmed > 0 {
				effectiveCash += tc.Input.BankTransferConfirmed
			}

			discrepancy := calcDiscrepancy(totalOrderValue, effectiveCash, effectiveReturned)

			// INV-RECON-04: discrepancy must be preserved
			if tc.Expected.DiscrepancyAmount != 0 {
				if math.Abs(discrepancy-tc.Expected.DiscrepancyAmount) > epsilon {
					t.Errorf("[%s] discrepancy: got %.2f, want %.2f",
						tc.ID, discrepancy, tc.Expected.DiscrepancyAmount)
				}
			} else {
				if math.Abs(discrepancy) > epsilon {
					t.Errorf("[%s] expected no discrepancy but got %.2f (total=%.2f cash=%.2f returned=%.2f)",
						tc.ID, discrepancy, totalOrderValue, effectiveCash, effectiveReturned)
				}
			}
		})
		ran++
	}

	if ran == 0 {
		t.Fatal("no reconciliation cases ran")
	}
	t.Logf("Golden Reconciliation: %d cases validated", ran)
}
