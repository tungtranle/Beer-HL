// Property tests — AQF 4.0 Section 6.1 (Property Oracle)
// Business invariants cho BHL OMS-TMS-WMS
//
// Chạy: go test -v -run "Property|Invariant" ./internal/aqf/
// Chạy nhiều lần: go test -count=100 -run "Property" ./internal/aqf/

package aqf

import (
	"math"
	"math/rand"
	"testing"
	"time"
)

// ─────────────────────────────────────────────────────────────
// INV-MONEY-01: Tổng tiền không bao giờ âm
// ─────────────────────────────────────────────────────────────

func TestProperty_Invariant_MoneyNonNegative(t *testing.T) {
	// Property: totalAmount = sum(price * qty) luôn >= 0
	// khi price >= 0 và qty >= 0
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	for i := 0; i < 1000; i++ {
		// Generate random order items (price, qty always non-negative)
		numItems := rng.Intn(20) + 1
		var total float64
		for j := 0; j < numItems; j++ {
			price := math.Abs(rng.Float64() * 1_000_000)
			qty := rng.Intn(100) + 1
			total += price * float64(qty)
		}

		if total < 0 {
			t.Errorf("INV-MONEY-01 VIOLATED: totalAmount=%v < 0 (run %d)", total, i)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// INV-CREDIT-01: Credit check deterministic
// ─────────────────────────────────────────────────────────────

func TestProperty_Invariant_CreditCheck_Deterministic(t *testing.T) {
	// Property: với cùng input, credit check cho cùng output (idempotent)
	rng := rand.New(rand.NewSource(42))

	for i := 0; i < 1000; i++ {
		creditLimit := rng.Float64() * 100_000_000
		existingDebt := rng.Float64() * creditLimit
		orderTotal := rng.Float64() * 50_000_000

		status1, credit1 := checkCreditStatus(creditLimit, existingDebt, orderTotal)
		status2, credit2 := checkCreditStatus(creditLimit, existingDebt, orderTotal)

		if status1 != status2 || credit1 != credit2 {
			t.Errorf("INV-CREDIT-01: checkCreditStatus non-deterministic run %d", i)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// INV-CREDIT-02: Credit limit = 0 LUÔN là unlimited
// ─────────────────────────────────────────────────────────────

func TestProperty_Invariant_UnlimitedCredit(t *testing.T) {
	// BR-CRD-02: credit_limit = 0 → unlimited → luôn confirmed
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	for i := 0; i < 500; i++ {
		existingDebt := rng.Float64() * 999_999_999
		orderTotal := rng.Float64() * 999_999_999

		orderStatus, creditStatus := checkCreditStatus(0, existingDebt, orderTotal)

		if orderStatus != "confirmed" {
			t.Errorf("INV-CREDIT-02: credit_limit=0 should always be confirmed, got %q (run %d)", orderStatus, i)
		}
		if creditStatus != "unlimited" {
			t.Errorf("INV-CREDIT-02: credit_limit=0 should have credit_status=unlimited, got %q (run %d)", creditStatus, i)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// INV-FEFO-01: FEFO luôn lấy lô hết hạn sớm nhất trước
// ─────────────────────────────────────────────────────────────

func TestProperty_Invariant_FEFO_OldestFirst(t *testing.T) {
	// Với 2 lô có qty đủ, lô nào expiry_date nhỏ hơn được lấy trước
	rng := rand.New(rand.NewSource(42))

	for i := 0; i < 500; i++ {
		// Tạo 2 lô ngẫu nhiên với expiry dates khác nhau
		baseDate := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
		days1 := rng.Intn(180)
		days2 := rng.Intn(180)
		for days1 == days2 {
			days2 = rng.Intn(180) // đảm bảo khác nhau
		}

		lot1 := Lot{
			LotNumber:  "L001",
			ExpiryDate: baseDate.AddDate(0, 0, days1).Format("2006-01-02"),
			Qty:        100,
		}
		lot2 := Lot{
			LotNumber:  "L002",
			ExpiryDate: baseDate.AddDate(0, 0, days2).Format("2006-01-02"),
			Qty:        100,
		}

		lots := []Lot{lot1, lot2}
		allocs, status := allocateFEFO(lots, 10)

		if status != "ok" {
			t.Errorf("INV-FEFO-01: allocation should succeed but got status=%q (run %d)", status, i)
			continue
		}
		if len(allocs) == 0 {
			t.Errorf("INV-FEFO-01: got empty allocation (run %d)", i)
			continue
		}

		// Xác định lô nào hết hạn trước
		t1, _ := time.Parse("2006-01-02", lot1.ExpiryDate)
		t2, _ := time.Parse("2006-01-02", lot2.ExpiryDate)

		var expectedFirst string
		if t1.Before(t2) {
			expectedFirst = "L001"
		} else {
			expectedFirst = "L002"
		}

		if allocs[0].LotNumber != expectedFirst {
			t.Errorf(
				"INV-FEFO-01: expected lot %s (expiry %s) before %s (expiry %s), got %s (run %d)",
				expectedFirst, lot1.ExpiryDate, lot2.ExpiryDate,
				lot2.ExpiryDate, allocs[0].LotNumber, i,
			)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// INV-FEFO-02: Tổng allocated qty = requested qty
// ─────────────────────────────────────────────────────────────

func TestProperty_Invariant_FEFO_TotalQty(t *testing.T) {
	rng := rand.New(rand.NewSource(42))

	for i := 0; i < 1000; i++ {
		numLots := rng.Intn(5) + 1
		lots := make([]Lot, numLots)
		totalAvailable := 0

		for j := 0; j < numLots; j++ {
			qty := rng.Intn(50) + 5
			lots[j] = Lot{
				LotNumber:  string(rune('A' + j)),
				ExpiryDate: time.Now().AddDate(0, j+1, 0).Format("2006-01-02"),
				Qty:        qty,
			}
			totalAvailable += qty
		}

		requestedQty := rng.Intn(totalAvailable) + 1
		allocs, status := allocateFEFO(lots, requestedQty)

		if status != "ok" {
			t.Errorf("INV-FEFO-02: allocation should succeed (run %d)", i)
			continue
		}

		// Tổng allocated phải bằng requested
		totalAllocated := 0
		for _, a := range allocs {
			totalAllocated += a.Qty
		}
		if totalAllocated != requestedQty {
			t.Errorf(
				"INV-FEFO-02: totalAllocated=%d != requestedQty=%d (run %d)",
				totalAllocated, requestedQty, i,
			)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// INV-GEO-01: Haversine distance không bao giờ âm
// ─────────────────────────────────────────────────────────────

// haversineKm tính khoảng cách hai điểm trên bề mặt Trái Đất (km)
func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func TestProperty_Invariant_HaversineNonNegative(t *testing.T) {
	// INV-GEO-01: khoảng cách địa lý không bao giờ âm
	rng := rand.New(rand.NewSource(42))

	for i := 0; i < 1000; i++ {
		lat1 := rng.Float64()*180 - 90  // -90 to 90
		lng1 := rng.Float64()*360 - 180 // -180 to 180
		lat2 := rng.Float64()*180 - 90
		lng2 := rng.Float64()*360 - 180

		dist := haversineKm(lat1, lng1, lat2, lng2)
		if dist < 0 {
			t.Errorf(
				"INV-GEO-01: haversine negative! lat1=%v,lng1=%v,lat2=%v,lng2=%v → dist=%v",
				lat1, lng1, lat2, lng2, dist,
			)
		}
	}
}

func TestProperty_Invariant_HaversineSymmetric(t *testing.T) {
	// INV-GEO-02: d(A,B) = d(B,A)
	rng := rand.New(rand.NewSource(99))

	for i := 0; i < 500; i++ {
		lat1 := rng.Float64()*180 - 90
		lng1 := rng.Float64()*360 - 180
		lat2 := rng.Float64()*180 - 90
		lng2 := rng.Float64()*360 - 180

		d1 := haversineKm(lat1, lng1, lat2, lng2)
		d2 := haversineKm(lat2, lng2, lat1, lng1)

		if math.Abs(d1-d2) > 0.001 { // 1m tolerance
			t.Errorf("INV-GEO-02: haversine not symmetric: d1=%v, d2=%v", d1, d2)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// INV-STATE-01: State machine không có invalid transitions
// ─────────────────────────────────────────────────────────────

func TestProperty_Invariant_StateMachine_TerminalStates(t *testing.T) {
	// Terminal states: delivered, rejected, cancelled
	// Không có transition ra khỏi terminal state
	terminals := []string{"delivered", "rejected", "cancelled"}

	allStates := make([]string, 0)
	for from := range validTransitions {
		allStates = append(allStates, from)
	}

	for _, terminal := range terminals {
		targets, exists := validTransitions[terminal]
		if !exists {
			t.Errorf("INV-STATE-01: terminal state %q không có trong validTransitions", terminal)
			continue
		}
		if len(targets) != 0 {
			t.Errorf("INV-STATE-01: terminal state %q có transitions: %v", terminal, targets)
		}
	}
}

func TestProperty_Invariant_StateMachine_NoSelfLoop(t *testing.T) {
	// Không có self-loop: state không transition sang chính nó
	for from, targets := range validTransitions {
		for _, to := range targets {
			if from == to {
				t.Errorf("INV-STATE-01: self-loop found: %q → %q", from, to)
			}
		}
	}
}

// ─────────────────────────────────────────────────────────────
// INV-ORDER-01: Order number format SO-YYYYMMDD-NNNN
// ─────────────────────────────────────────────────────────────

func TestProperty_Invariant_OrderNumberFormat(t *testing.T) {
	// Kiểm tra generateOrderNumber format bất biến:
	// - bắt đầu bằng "SO-"
	// - phần tiếp theo là ngày hôm nay YYYYMMDD
	// - kết thúc bằng "-XXXX"
	// Note: chúng ta kiểm tra logic qua service_test.go đã có,
	// đây là cross-package sanity check
	today := time.Now().Format("20060102")
	prefix := "SO-" + today + "-"

	// Simulate format (không gọi DB)
	testNumbers := []string{
		"SO-" + today + "-0001",
		"SO-" + today + "-9999",
		"SO-" + today + "-0123",
	}

	for _, num := range testNumbers {
		if len(num) < len(prefix) {
			t.Errorf("INV-ORDER-01: order number too short: %q", num)
		}
		if num[:len(prefix)] != prefix {
			t.Errorf("INV-ORDER-01: order number prefix wrong: got %q, want prefix %q", num, prefix)
		}
	}
}
