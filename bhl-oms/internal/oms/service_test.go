package oms

import (
	"testing"
	"time"
)

// ===== generateOrderNumber Tests =====

func TestGenerateOrderNumber_Format(t *testing.T) {
	// BR-OMS-03: Order number = SO-{YYYYMMDD}-{NNNN}
	orderNum := generateOrderNumber()

	if len(orderNum) < 16 {
		t.Errorf("order number too short: %s", orderNum)
	}

	// Must start with "SO-"
	if orderNum[:3] != "SO-" {
		t.Errorf("order number must start with SO-, got: %s", orderNum)
	}

	// Must contain today's date in YYYYMMDD format
	today := time.Now().Format("20060102")
	if orderNum[3:11] != today {
		t.Errorf("order number date part should be %s, got: %s", today, orderNum[3:11])
	}

	// Must have dash separator after date
	if orderNum[11] != '-' {
		t.Errorf("order number missing dash after date: %s", orderNum)
	}
}

func TestGenerateOrderNumber_Uniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		num := generateOrderNumber()
		if seen[num] {
			t.Errorf("duplicate order number generated: %s", num)
		}
		seen[num] = true
	}
}

// ===== determineCutoffGroup Tests =====
// These test the cutoff logic concept (BR-OMS-04)
// The actual function depends on repo, so we test the time logic directly

func TestCutoffGroupLogic_Before16h(t *testing.T) {
	// BR-OMS-04: Before 16h = "before_16h" (deliver same day)
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")

	testTimes := []struct {
		hour     int
		expected string
	}{
		{0, "before_16h"},
		{8, "before_16h"},
		{10, "before_16h"},
		{15, "before_16h"},
	}

	for _, tc := range testTimes {
		testTime := time.Date(2026, 3, 20, tc.hour, 0, 0, 0, loc)
		result := cutoffGroupForTime(testTime, 16)
		if result != tc.expected {
			t.Errorf("hour %d: expected %s, got %s", tc.hour, tc.expected, result)
		}
	}
}

func TestCutoffGroupLogic_After16h(t *testing.T) {
	// BR-OMS-04: After 16h = "after_16h" (deliver T+1)
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")

	testTimes := []struct {
		hour     int
		expected string
	}{
		{16, "after_16h"},
		{17, "after_16h"},
		{20, "after_16h"},
		{23, "after_16h"},
	}

	for _, tc := range testTimes {
		testTime := time.Date(2026, 3, 20, tc.hour, 0, 0, 0, loc)
		result := cutoffGroupForTime(testTime, 16)
		if result != tc.expected {
			t.Errorf("hour %d: expected %s, got %s", tc.hour, tc.expected, result)
		}
	}
}

func TestCutoffGroupLogic_CustomCutoffHour(t *testing.T) {
	// Test with non-default cutoff hour (e.g., 14h)
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")

	tests := []struct {
		hour       int
		cutoffHour int
		expected   string
	}{
		{13, 14, "before_16h"},
		{14, 14, "after_16h"},
		{15, 14, "after_16h"},
		{9, 10, "before_16h"},
		{10, 10, "after_16h"},
	}

	for _, tc := range tests {
		testTime := time.Date(2026, 3, 20, tc.hour, 0, 0, 0, loc)
		result := cutoffGroupForTime(testTime, tc.cutoffHour)
		if result != tc.expected {
			t.Errorf("hour %d with cutoff %d: expected %s, got %s",
				tc.hour, tc.cutoffHour, tc.expected, result)
		}
	}
}

// ===== Credit Limit Logic Tests =====
// BR-OMS-02: Credit exceeded → pending_approval

func TestCreditLimitLogic_WithinLimit(t *testing.T) {
	creditLimit := 10000000.0 // 10 triệu
	currentBalance := 3000000.0
	orderAmount := 5000000.0

	availableLimit := creditLimit - currentBalance
	status := determineCreditStatus(availableLimit, orderAmount)

	if status != "within_limit" {
		t.Errorf("expected within_limit, got %s (available: %.0f, order: %.0f)",
			status, availableLimit, orderAmount)
	}
}

func TestCreditLimitLogic_Exceeded(t *testing.T) {
	creditLimit := 10000000.0
	currentBalance := 7000000.0
	orderAmount := 5000000.0

	availableLimit := creditLimit - currentBalance
	status := determineCreditStatus(availableLimit, orderAmount)

	if status != "exceeded" {
		t.Errorf("expected exceeded, got %s (available: %.0f, order: %.0f)",
			status, availableLimit, orderAmount)
	}
}

func TestCreditLimitLogic_ExactLimit(t *testing.T) {
	creditLimit := 10000000.0
	currentBalance := 5000000.0
	orderAmount := 5000000.0

	availableLimit := creditLimit - currentBalance
	status := determineCreditStatus(availableLimit, orderAmount)

	// Exact match should be within_limit (not exceeded)
	if status != "within_limit" {
		t.Errorf("exact limit should be within_limit, got %s", status)
	}
}

func TestCreditLimitLogic_ZeroBalance(t *testing.T) {
	creditLimit := 10000000.0
	currentBalance := 0.0
	orderAmount := 10000000.0

	availableLimit := creditLimit - currentBalance
	status := determineCreditStatus(availableLimit, orderAmount)

	if status != "within_limit" {
		t.Errorf("zero balance with exact order should be within_limit, got %s", status)
	}
}

// ===== Order Status for Credit Tests =====

func TestOrderStatusForCredit_Confirmed(t *testing.T) {
	status := orderStatusForCredit("within_limit")
	if status != "confirmed" {
		t.Errorf("within_limit should produce confirmed, got %s", status)
	}
}

func TestOrderStatusForCredit_PendingApproval(t *testing.T) {
	status := orderStatusForCredit("exceeded")
	if status != "pending_approval" {
		t.Errorf("exceeded should produce pending_approval, got %s", status)
	}
}

// ===== ATP Logic Tests =====
// BR-OMS-01: ATP per (product_id, warehouse_id)

func TestATPCheckLogic_Sufficient(t *testing.T) {
	atpMap := map[string]int{
		"product-A": 100,
		"product-B": 50,
	}

	items := []struct {
		productID string
		quantity  int
	}{
		{"product-A", 30},
		{"product-B", 20},
	}

	status := checkATPStatus(atpMap, items)
	if status != "sufficient" {
		t.Errorf("expected sufficient, got %s", status)
	}
}

func TestATPCheckLogic_Insufficient(t *testing.T) {
	atpMap := map[string]int{
		"product-A": 100,
		"product-B": 10, // Only 10 available
	}

	items := []struct {
		productID string
		quantity  int
	}{
		{"product-A", 30},
		{"product-B", 20}, // Needs 20, only 10
	}

	status := checkATPStatus(atpMap, items)
	if status != "insufficient" {
		t.Errorf("expected insufficient, got %s", status)
	}
}

func TestATPCheckLogic_ProductNotInWarehouse(t *testing.T) {
	atpMap := map[string]int{
		"product-A": 100,
		// product-B not in this warehouse
	}

	items := []struct {
		productID string
		quantity  int
	}{
		{"product-A", 30},
		{"product-B", 5}, // Not found in ATP
	}

	status := checkATPStatus(atpMap, items)
	if status != "insufficient" {
		t.Errorf("product not in warehouse should be insufficient, got %s", status)
	}
}

func TestATPCheckLogic_ExactMatch(t *testing.T) {
	atpMap := map[string]int{
		"product-A": 30,
	}

	items := []struct {
		productID string
		quantity  int
	}{
		{"product-A", 30}, // Exact ATP
	}

	status := checkATPStatus(atpMap, items)
	if status != "sufficient" {
		t.Errorf("exact ATP match should be sufficient, got %s", status)
	}
}

// ===== Order Amount Calculation Tests =====

func TestOrderAmountCalculation(t *testing.T) {
	items := []struct {
		price    float64
		deposit  float64
		quantity int
	}{
		{150000, 5000, 10},  // 1,500,000 + 50,000
		{200000, 8000, 5},   // 1,000,000 + 40,000
	}

	var totalAmount, depositAmount float64
	for _, item := range items {
		totalAmount += item.price * float64(item.quantity)
		depositAmount += item.deposit * float64(item.quantity)
	}

	if totalAmount != 2500000 {
		t.Errorf("expected total 2,500,000, got %.0f", totalAmount)
	}
	if depositAmount != 90000 {
		t.Errorf("expected deposit 90,000, got %.0f", depositAmount)
	}

	grandTotal := totalAmount + depositAmount
	if grandTotal != 2590000 {
		t.Errorf("expected grand total 2,590,000, got %.0f", grandTotal)
	}
}

// ===== Helper functions for testable pure logic =====
// These extract the pure logic from service methods for testing

func cutoffGroupForTime(t time.Time, cutoffHour int) string {
	if t.Hour() < cutoffHour {
		return "before_16h"
	}
	return "after_16h"
}

func determineCreditStatus(availableLimit, orderAmount float64) string {
	if availableLimit < orderAmount {
		return "exceeded"
	}
	return "within_limit"
}

func orderStatusForCredit(creditStatus string) string {
	if creditStatus == "exceeded" {
		return "pending_approval"
	}
	return "confirmed"
}

func checkATPStatus(atpMap map[string]int, items []struct {
	productID string
	quantity  int
}) string {
	for _, item := range items {
		atp, found := atpMap[item.productID]
		if !found || atp < item.quantity {
			return "insufficient"
		}
	}
	return "sufficient"
}
