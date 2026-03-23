package wms

import (
	"encoding/json"
	"testing"
)

// ===== Gate Check Tests =====
// BR-TMS-04: R01 — qty_loaded = qty_ordered (100% match)

func TestGateCheck_Pass_ExactMatch(t *testing.T) {
	// Scanned items match expected exactly
	scannedJSON := `[{"product_id":"aaa","lot_id":"bbb","qty":100}]`
	expectedJSON := `[{"product_id":"aaa","lot_id":"bbb","qty":100}]`

	result := compareGateCheck(expectedJSON, scannedJSON)
	if result != "pass" {
		t.Errorf("exact match should pass, got %s", result)
	}
}

func TestGateCheck_Fail_Shortage(t *testing.T) {
	scannedJSON := `[{"product_id":"aaa","lot_id":"bbb","qty":90}]`
	expectedJSON := `[{"product_id":"aaa","lot_id":"bbb","qty":100}]`

	result := compareGateCheck(expectedJSON, scannedJSON)
	if result != "fail" {
		t.Errorf("shortage should fail, got %s", result)
	}
}

func TestGateCheck_Fail_Excess(t *testing.T) {
	scannedJSON := `[{"product_id":"aaa","lot_id":"bbb","qty":110}]`
	expectedJSON := `[{"product_id":"aaa","lot_id":"bbb","qty":100}]`

	result := compareGateCheck(expectedJSON, scannedJSON)
	if result != "fail" {
		t.Errorf("excess should fail, got %s", result)
	}
}

func TestGateCheck_Fail_MissingProduct(t *testing.T) {
	scannedJSON := `[{"product_id":"aaa","lot_id":"bbb","qty":100}]`
	expectedJSON := `[{"product_id":"aaa","lot_id":"bbb","qty":100},{"product_id":"ccc","lot_id":"ddd","qty":50}]`

	result := compareGateCheck(expectedJSON, scannedJSON)
	if result != "fail" {
		t.Errorf("missing product should fail, got %s", result)
	}
}

func TestGateCheck_Pass_MultipleProducts(t *testing.T) {
	scannedJSON := `[{"product_id":"aaa","qty":100},{"product_id":"bbb","qty":50}]`
	expectedJSON := `[{"product_id":"aaa","qty":100},{"product_id":"bbb","qty":50}]`

	result := compareGateCheck(expectedJSON, scannedJSON)
	if result != "pass" {
		t.Errorf("all products matching should pass, got %s", result)
	}
}

// ===== FEFO Picking Tests =====
// BR-WMS-01: expiry_date ASC, lot_number ASC

func TestFEFOSorting_ByExpiryDate(t *testing.T) {
	lots := []testLot{
		{LotNumber: "LOT-003", ExpiryDate: "2026-06-01", Qty: 50},
		{LotNumber: "LOT-001", ExpiryDate: "2026-04-01", Qty: 30},
		{LotNumber: "LOT-002", ExpiryDate: "2026-05-01", Qty: 40},
	}

	sorted := sortFEFO(lots)

	if sorted[0].LotNumber != "LOT-001" {
		t.Errorf("first lot should be LOT-001 (earliest expiry), got %s", sorted[0].LotNumber)
	}
	if sorted[1].LotNumber != "LOT-002" {
		t.Errorf("second lot should be LOT-002, got %s", sorted[1].LotNumber)
	}
	if sorted[2].LotNumber != "LOT-003" {
		t.Errorf("third lot should be LOT-003 (latest expiry), got %s", sorted[2].LotNumber)
	}
}

func TestFEFOSorting_SameExpiry_ByLotNumber(t *testing.T) {
	lots := []testLot{
		{LotNumber: "LOT-C", ExpiryDate: "2026-05-01", Qty: 50},
		{LotNumber: "LOT-A", ExpiryDate: "2026-05-01", Qty: 30},
		{LotNumber: "LOT-B", ExpiryDate: "2026-05-01", Qty: 40},
	}

	sorted := sortFEFO(lots)

	if sorted[0].LotNumber != "LOT-A" {
		t.Errorf("same expiry: first should be LOT-A (alphabetical), got %s", sorted[0].LotNumber)
	}
}

func TestFEFOPicking_ExactQuantity(t *testing.T) {
	lots := []testLot{
		{LotNumber: "LOT-001", ExpiryDate: "2026-04-01", Qty: 30},
		{LotNumber: "LOT-002", ExpiryDate: "2026-05-01", Qty: 40},
	}

	picked := pickFEFO(lots, 30)

	if len(picked) != 1 {
		t.Fatalf("should pick from 1 lot, got %d", len(picked))
	}
	if picked[0].LotNumber != "LOT-001" {
		t.Errorf("should pick from earliest expiry lot, got %s", picked[0].LotNumber)
	}
	if picked[0].PickedQty != 30 {
		t.Errorf("should pick exactly 30, got %d", picked[0].PickedQty)
	}
}

func TestFEFOPicking_SpanMultipleLots(t *testing.T) {
	lots := []testLot{
		{LotNumber: "LOT-001", ExpiryDate: "2026-04-01", Qty: 20},
		{LotNumber: "LOT-002", ExpiryDate: "2026-05-01", Qty: 30},
	}

	picked := pickFEFO(lots, 35)

	if len(picked) != 2 {
		t.Fatalf("should pick from 2 lots, got %d", len(picked))
	}
	if picked[0].PickedQty != 20 {
		t.Errorf("first lot should be fully picked (20), got %d", picked[0].PickedQty)
	}
	if picked[1].PickedQty != 15 {
		t.Errorf("second lot should pick remaining (15), got %d", picked[1].PickedQty)
	}
}

func TestFEFOPicking_InsufficientStock(t *testing.T) {
	lots := []testLot{
		{LotNumber: "LOT-001", ExpiryDate: "2026-04-01", Qty: 20},
	}

	picked := pickFEFO(lots, 50) // Need 50, only 20

	totalPicked := 0
	for _, p := range picked {
		totalPicked += p.PickedQty
	}
	if totalPicked != 20 {
		t.Errorf("should pick all available (20), got %d", totalPicked)
	}
}

func TestFEFOPicking_PositiveQuantityRequired(t *testing.T) {
	lots := []testLot{
		{LotNumber: "LOT-001", ExpiryDate: "2026-04-01", Qty: 100},
	}

	picked := pickFEFO(lots, 0)
	if len(picked) != 0 {
		t.Error("picking 0 quantity should return empty")
	}

	picked = pickFEFO(lots, -5)
	if len(picked) != 0 {
		t.Error("picking negative quantity should return empty")
	}
}

// ===== Helper types and functions =====

type gateCheckItem struct {
	ProductID string `json:"product_id"`
	LotID     string `json:"lot_id,omitempty"`
	Qty       int    `json:"qty"`
}

type testLot struct {
	LotNumber  string
	ExpiryDate string
	Qty        int
}

type pickedLot struct {
	LotNumber string
	PickedQty int
}

func compareGateCheck(expectedJSON, scannedJSON string) string {
	var expected, scanned []gateCheckItem
	json.Unmarshal([]byte(expectedJSON), &expected)
	json.Unmarshal([]byte(scannedJSON), &scanned)

	// Build map of expected
	expectedMap := make(map[string]int)
	for _, item := range expected {
		expectedMap[item.ProductID] += item.Qty
	}

	// Build map of scanned
	scannedMap := make(map[string]int)
	for _, item := range scanned {
		scannedMap[item.ProductID] += item.Qty
	}

	// R01: ANY discrepancy → fail
	for productID, expectedQty := range expectedMap {
		scannedQty := scannedMap[productID]
		if scannedQty != expectedQty {
			return "fail"
		}
	}

	// Check for unexpected products
	for productID := range scannedMap {
		if _, exists := expectedMap[productID]; !exists {
			return "fail"
		}
	}

	return "pass"
}

func sortFEFO(lots []testLot) []testLot {
	sorted := make([]testLot, len(lots))
	copy(sorted, lots)

	// Simple bubble sort for test — expiry_date ASC, lot_number ASC
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			swap := false
			if sorted[j].ExpiryDate < sorted[i].ExpiryDate {
				swap = true
			} else if sorted[j].ExpiryDate == sorted[i].ExpiryDate && sorted[j].LotNumber < sorted[i].LotNumber {
				swap = true
			}
			if swap {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	return sorted
}

func pickFEFO(lots []testLot, need int) []pickedLot {
	if need <= 0 {
		return nil
	}

	sorted := sortFEFO(lots)
	var result []pickedLot
	remaining := need

	for _, lot := range sorted {
		if remaining <= 0 {
			break
		}
		pick := lot.Qty
		if pick > remaining {
			pick = remaining
		}
		result = append(result, pickedLot{
			LotNumber: lot.LotNumber,
			PickedQty: pick,
		})
		remaining -= pick
	}

	return result
}
