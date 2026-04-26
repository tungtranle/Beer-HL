// Package aqf chứa Golden Dataset validation tests và Property tests
// Chạy: go test -v -run "Golden|Property|StateMachine|AuthMatrix" ./internal/aqf/
//
// AQF G2 Gate: các test này chạy khi file critical thay đổi
// Reference: AQF 4.0 Section 6 (Oracle Engine), Section 7 (Evidence)

package aqf

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

// goldenDir trỏ tới aqf/golden/ tính từ vị trí file test này
func goldenDir(t *testing.T) string {
	t.Helper()
	_, filename, _, _ := runtime.Caller(0)
	// internal/aqf/ → 2 levels up → project root → aqf/golden/
	root := filepath.Join(filepath.Dir(filename), "..", "..", "aqf", "golden")
	abs, err := filepath.Abs(root)
	if err != nil {
		t.Fatalf("không tìm được golden dir: %v", err)
	}
	return abs
}

// ─────────────────────────────────────────────────────────────
// CREDIT GOLDEN DATASET TESTS
// Mô phỏng business rule: BR-CRD-01, BR-CRD-02
// ─────────────────────────────────────────────────────────────

type CreditCase struct {
	ID       string `json:"id"`
	Scenario string `json:"scenario"`
	Input    struct {
		CustomerCreditLimit float64 `json:"customer_credit_limit"`
		ExistingDebt        float64 `json:"existing_debt"`
		NewOrderTotal       float64 `json:"new_order_total"`
	} `json:"input"`
	Expected struct {
		OrderStatus  string `json:"order_status"`
		CreditStatus string `json:"credit_status"`
		EventType    string `json:"event_type,omitempty"`
	} `json:"expected"`
}

// checkCreditStatus mô phỏng business rule từ internal/oms/service.go
// BR-CRD-01: available_limit < new_order_total → pending_approval
// BR-CRD-02: credit_limit = 0 → unlimited (luôn confirmed)
func checkCreditStatus(creditLimit, existingDebt, orderTotal float64) (orderStatus, creditStatus string) {
	if creditLimit == 0 {
		// BR-CRD-02: unlimited credit
		return "confirmed", "unlimited"
	}

	availableLimit := creditLimit - existingDebt
	if availableLimit < orderTotal {
		// BR-CRD-01: credit exceeded
		return "pending_approval", "over_limit"
	}

	return "confirmed", "ok"
}

func TestGolden_CreditCases(t *testing.T) {
	path := filepath.Join(goldenDir(t), "credit.cases.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("không đọc được golden file %s: %v", path, err)
	}

	var rawCases []json.RawMessage
	if err := json.Unmarshal(data, &rawCases); err != nil {
		t.Fatalf("parse JSON thất bại: %v", err)
	}

	ran := 0
	for _, raw := range rawCases {
		// Skip metadata entries (có key "_meta")
		var check map[string]interface{}
		if err := json.Unmarshal(raw, &check); err != nil {
			continue
		}
		if _, isMeta := check["_meta"]; isMeta {
			continue
		}

		var tc CreditCase
		if err := json.Unmarshal(raw, &tc); err != nil {
			t.Logf("skip invalid case: %v", err)
			continue
		}

		t.Run(tc.ID+"_"+tc.Scenario, func(t *testing.T) {
			// Skip HTTP-level test cases — these test RBAC/validation, not the credit function
			if tc.Input.CustomerCreditLimit == 0 && tc.Input.ExistingDebt == 0 && tc.Input.NewOrderTotal == 0 &&
				tc.Expected.OrderStatus == "" && tc.Expected.CreditStatus == "" {
				t.Skip("HTTP-level test case — verified via API integration test, not unit function")
				return
			}

			gotStatus, gotCredit := checkCreditStatus(
				tc.Input.CustomerCreditLimit,
				tc.Input.ExistingDebt,
				tc.Input.NewOrderTotal,
			)

			if tc.Expected.OrderStatus != "" && gotStatus != tc.Expected.OrderStatus {
				t.Errorf(
					"[%s] order_status: got %q, want %q\n  input: credit=%v debt=%v order=%v",
					tc.ID, gotStatus, tc.Expected.OrderStatus,
					tc.Input.CustomerCreditLimit, tc.Input.ExistingDebt, tc.Input.NewOrderTotal,
				)
			}

			if tc.Expected.CreditStatus != "" && gotCredit != tc.Expected.CreditStatus {
				t.Errorf(
					"[%s] credit_status: got %q, want %q",
					tc.ID, gotCredit, tc.Expected.CreditStatus,
				)
			}
		})
		ran++
	}

	if ran == 0 {
		t.Fatal("Không có credit cases nào được chạy — kiểm tra lại golden file")
	}
	t.Logf("Golden Credit: %d cases validated", ran)
}

// ─────────────────────────────────────────────────────────────
// ORDER STATE MACHINE GOLDEN TESTS
// ─────────────────────────────────────────────────────────────

// Định nghĩa valid transitions theo business rules
var validTransitions = map[string][]string{
	"new":                      {"pending_customer_confirm", "confirmed", "cancelled"},
	"pending_customer_confirm": {"confirmed", "cancelled"},
	"confirmed":                {"in_transit", "pending_approval", "cancelled"},
	"pending_approval":         {"confirmed", "rejected"},
	"in_transit":               {"delivered", "partially_delivered", "failed"},
	"partially_delivered":      {"confirmed"}, // tạo redelivery shipment
	"failed":                   {"confirmed"}, // tạo redelivery
	"delivered":                {},            // terminal state
	"rejected":                 {},            // terminal state
	"cancelled":                {},            // terminal state
}

func isValidTransition(from, to string) bool {
	allowed, exists := validTransitions[from]
	if !exists {
		return false
	}
	for _, a := range allowed {
		if a == to {
			return true
		}
	}
	return false
}

type StateMachineCase struct {
	ID          string `json:"id"`
	Scenario    string `json:"scenario"`
	Allowed     bool   `json:"allowed"`
	Transitions []struct {
		From    string `json:"from"`
		To      string `json:"to"`
		Trigger string `json:"trigger"`
	} `json:"transitions"`
	ExpectedError string `json:"expected_error,omitempty"`
}

func TestGolden_OrderStateMachine(t *testing.T) {
	path := filepath.Join(goldenDir(t), "order-state-machine.cases.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("không đọc được golden file: %v", err)
	}

	var rawCases []json.RawMessage
	if err := json.Unmarshal(data, &rawCases); err != nil {
		t.Fatalf("parse JSON: %v", err)
	}

	ran := 0
	for _, raw := range rawCases {
		var check map[string]interface{}
		if err := json.Unmarshal(raw, &check); err != nil {
			continue
		}
		if _, isMeta := check["_meta"]; isMeta {
			continue
		}

		var tc StateMachineCase
		if err := json.Unmarshal(raw, &tc); err != nil {
			t.Logf("skip: %v", err)
			continue
		}

		t.Run(tc.ID+"_"+tc.Scenario, func(t *testing.T) {
			for _, tr := range tc.Transitions {
				got := isValidTransition(tr.From, tr.To)
				if got != tc.Allowed {
					t.Errorf(
						"[%s] transition %s→%s via %q: got allowed=%v, want allowed=%v",
						tc.ID, tr.From, tr.To, tr.Trigger, got, tc.Allowed,
					)
				}
			}
		})
		ran++
	}

	if ran == 0 {
		t.Fatal("Không có state machine cases nào được chạy")
	}
	t.Logf("Golden StateMachine: %d cases validated", ran)
}

// ─────────────────────────────────────────────────────────────
// FEFO GOLDEN DATASET TESTS
// Invariant INV-FEFO-01: always pick lot with earliest expiry first
// ─────────────────────────────────────────────────────────────

type Lot struct {
	LotNumber  string `json:"lot_number"`
	ExpiryDate string `json:"expiry_date"`
	Qty        int    `json:"qty"`
}

type FEFOAllocation struct {
	LotNumber string `json:"lot_number"`
	Qty       int    `json:"qty"`
}

// allocateFEFO mô phỏng FEFO allocation logic từ wms/service.go
// INV-FEFO-01: chọn lô có expiry_date sớm nhất trước
func allocateFEFO(lots []Lot, requestedQty int) ([]FEFOAllocation, string) {
	if requestedQty <= 0 {
		return nil, "invalid_request"
	}

	// Sort lots by expiry date ascending (FEFO), tiebreak by lot_number ascending
	sorted := make([]Lot, len(lots))
	copy(sorted, lots)
	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			ti, _ := time.Parse("2006-01-02", sorted[i].ExpiryDate)
			tj, _ := time.Parse("2006-01-02", sorted[j].ExpiryDate)
			// Primary: earlier expiry first; tiebreak: smaller lot_number first
			swap := tj.Before(ti) || (!ti.Before(tj) && !tj.Before(ti) && sorted[j].LotNumber < sorted[i].LotNumber)
			if swap {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	// Check total availability
	totalAvailable := 0
	for _, l := range sorted {
		totalAvailable += l.Qty
	}
	if totalAvailable < requestedQty {
		return nil, "insufficient"
	}

	// Allocate FEFO
	var result []FEFOAllocation
	remaining := requestedQty
	for _, lot := range sorted {
		if remaining <= 0 {
			break
		}
		take := lot.Qty
		if take > remaining {
			take = remaining
		}
		result = append(result, FEFOAllocation{LotNumber: lot.LotNumber, Qty: take})
		remaining -= take
	}

	return result, "ok"
}

type FEFOCase struct {
	ID       string `json:"id"`
	Scenario string `json:"scenario"`
	Input    struct {
		ProductID     string `json:"product_id"`
		RequestedQty  int    `json:"requested_qty"`
		AvailableLots []Lot  `json:"available_lots"`
	} `json:"input"`
	Expected struct {
		AllocatedLot string           `json:"allocated_lot,omitempty"`
		AllocatedQty int              `json:"allocated_qty,omitempty"`
		Allocations  []FEFOAllocation `json:"allocations,omitempty"`
		ATPStatus    string           `json:"atp_status,omitempty"`
		AvailableQty int              `json:"available_qty,omitempty"`
	} `json:"expected"`
}

func TestGolden_InventoryFEFO(t *testing.T) {
	path := filepath.Join(goldenDir(t), "inventory-fefo.cases.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("không đọc được golden file: %v", err)
	}

	var rawCases []json.RawMessage
	if err := json.Unmarshal(data, &rawCases); err != nil {
		t.Fatalf("parse JSON: %v", err)
	}

	ran := 0
	for _, raw := range rawCases {
		var check map[string]interface{}
		if err := json.Unmarshal(raw, &check); err != nil {
			continue
		}
		if _, isMeta := check["_meta"]; isMeta {
			continue
		}

		var tc FEFOCase
		if err := json.Unmarshal(raw, &tc); err != nil {
			t.Logf("skip: %v", err)
			continue
		}

		t.Run(tc.ID+"_"+tc.Scenario, func(t *testing.T) {
			allocs, status := allocateFEFO(tc.Input.AvailableLots, tc.Input.RequestedQty)

			// Check ATP insufficient case
			if tc.Expected.ATPStatus == "insufficient" {
				if status != "insufficient" {
					t.Errorf("[%s] expected atp_status=insufficient, got %q", tc.ID, status)
				}
				return
			}

			// Check single lot allocation
			if tc.Expected.AllocatedLot != "" {
				if len(allocs) == 0 {
					t.Errorf("[%s] expected allocation to lot %s, got empty", tc.ID, tc.Expected.AllocatedLot)
					return
				}
				if allocs[0].LotNumber != tc.Expected.AllocatedLot {
					t.Errorf("[%s] allocated_lot: got %q, want %q", tc.ID, allocs[0].LotNumber, tc.Expected.AllocatedLot)
				}
				// Only check qty if explicitly specified in golden case (0 means not specified)
				if tc.Expected.AllocatedQty > 0 && allocs[0].Qty != tc.Expected.AllocatedQty {
					t.Errorf("[%s] allocated_qty: got %d, want %d", tc.ID, allocs[0].Qty, tc.Expected.AllocatedQty)
				}
				return
			}

			// Check multi-lot allocation
			if len(tc.Expected.Allocations) > 0 {
				if len(allocs) != len(tc.Expected.Allocations) {
					t.Errorf("[%s] allocation count: got %d, want %d", tc.ID, len(allocs), len(tc.Expected.Allocations))
					return
				}
				for i, want := range tc.Expected.Allocations {
					if allocs[i].LotNumber != want.LotNumber {
						t.Errorf("[%s] alloc[%d].lot: got %q, want %q", tc.ID, i, allocs[i].LotNumber, want.LotNumber)
					}
					if allocs[i].Qty != want.Qty {
						t.Errorf("[%s] alloc[%d].qty: got %d, want %d", tc.ID, i, allocs[i].Qty, want.Qty)
					}
				}
			}
		})
		ran++
	}

	if ran == 0 {
		t.Fatal("Không có FEFO cases nào được chạy")
	}
	t.Logf("Golden FEFO: %d cases validated", ran)
}
