package main

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	rand.Seed(time.Now().UnixNano())
	connStr := "postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable"
	pool, err := pgxpool.New(context.Background(), connStr)
	if err != nil {
		fmt.Printf("❌ Connection error: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	ctx := context.Background()

	fmt.Println("\n" + strings.Repeat("=", 90))
	fmt.Println("📊 SEEDING HISTORICAL RATING & QUALITY DATA")
	fmt.Println(strings.Repeat("=", 90))

	// 1. Seed driver_ratings
	fmt.Println("\n[1/4] Seeding driver_ratings...")

	var drivers []uuid.UUID
	rows, _ := pool.Query(ctx, `SELECT id FROM drivers LIMIT 50`)
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		rows.Scan(&id)
		drivers = append(drivers, id)
	}

	var trips []uuid.UUID
	rows2, _ := pool.Query(ctx, `SELECT id FROM trips ORDER BY created_at DESC LIMIT 500`)
	defer rows2.Close()
	for rows2.Next() {
		var id uuid.UUID
		rows2.Scan(&id)
		trips = append(trips, id)
	}

	driverRatingCount := 0
	for _, driverID := range drivers {
		// 2-3 ratings per driver over past 90 days
		for i := 0; i < 2+rand.Intn(2); i++ {
			ratingDate := time.Now().AddDate(0, 0, -rand.Intn(90))
			safetyScore := 3 + rand.Intn(3) // 3-5
			punctualityScore := 3 + rand.Intn(3)
			professionalScore := 3 + rand.Intn(3)
			vehicleScore := 3 + rand.Intn(3)

			overallScore := float64(safetyScore+punctualityScore+professionalScore+vehicleScore) / 4.0

			pool.Exec(ctx, `
				INSERT INTO driver_ratings 
				(driver_id, trip_id, rating_date, safety_rating, punctuality_rating, 
				 professionalism_rating, vehicle_condition_rating, on_time_count, 
				 late_count, customer_complaint_count, incident_count, overall_score)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			`, driverID, trips[rand.Intn(len(trips))], ratingDate, safetyScore, punctualityScore,
				professionalScore, vehicleScore,
				5+rand.Intn(15), rand.Intn(3), rand.Intn(2), rand.Intn(2), overallScore)
			driverRatingCount++
		}
	}
	fmt.Printf("✅ Created %d driver ratings\n", driverRatingCount)

	// 2. Seed supplier_ratings (customer ratings)
	fmt.Println("\n[2/4] Seeding supplier_ratings...")

	var customers []uuid.UUID
	rows3, _ := pool.Query(ctx, `SELECT id FROM customers ORDER BY created_at DESC LIMIT 200`)
	defer rows3.Close()
	for rows3.Next() {
		var id uuid.UUID
		rows3.Scan(&id)
		customers = append(customers, id)
	}

	var orders []uuid.UUID
	rows4, _ := pool.Query(ctx, `SELECT id FROM sales_orders ORDER BY created_at DESC LIMIT 1000`)
	defer rows4.Close()
	for rows4.Next() {
		var id uuid.UUID
		rows4.Scan(&id)
		orders = append(orders, id)
	}

	supplierRatingCount := 0
	for _, customerID := range customers {
		// 1-2 ratings per customer
		for i := 0; i < 1+rand.Intn(2); i++ {
			ratingDate := time.Now().AddDate(0, 0, -rand.Intn(90))
			paymentScore := 2 + rand.Intn(4) // 2-5
			accuracyScore := 3 + rand.Intn(3)
			cooperationScore := 3 + rand.Intn(3)
			returnScore := 4 + rand.Intn(2) // Usually high (good customer)

			overallScore := float64(paymentScore+accuracyScore+cooperationScore+returnScore) / 4.0
			var creditTier string
			if overallScore >= 4.5 {
				creditTier = "gold"
			} else if overallScore >= 3.5 {
				creditTier = "silver"
			} else if overallScore >= 2.5 {
				creditTier = "bronze"
			} else {
				creditTier = "watch"
			}

			pool.Exec(ctx, `
				INSERT INTO supplier_ratings
				(customer_id, order_id, rating_date, payment_reliability_rating, order_accuracy_rating,
				 delivery_cooperation_rating, return_rate_rating, on_time_payment_count, late_payment_count,
				 return_count, total_orders_count, overall_score, credit_tier)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			`, customerID, orders[rand.Intn(len(orders))], ratingDate,
				paymentScore, accuracyScore, cooperationScore, returnScore,
				10+rand.Intn(20), rand.Intn(3), rand.Intn(3), 15+rand.Intn(30), overallScore, creditTier)
			supplierRatingCount++
		}
	}
	fmt.Printf("✅ Created %d supplier ratings\n", supplierRatingCount)

	// 3. Seed vehicle_condition_checks (pre/post-trip checklists)
	fmt.Println("\n[3/4] Seeding vehicle_condition_checks...")

	checkItems := []string{
		"tire_pressure", "tire_condition", "brake_fluid", "brake_pads", "coolant_level",
		"windshield_wipers", "lights_working", "mirrors_clean", "fuel_level",
		"battery_condition", "horn_working", "seatbelts_working", "door_locks", "trunk_latch",
	}

	conditionCheckCount := 0
	rows5, _ := pool.Query(ctx, `SELECT id, vehicle_id FROM trips ORDER BY created_at DESC LIMIT 200`)
	defer rows5.Close()
	for rows5.Next() {
		var tripID, vehicleID uuid.UUID
		rows5.Scan(&tripID, &vehicleID)

		// Pre-trip: 10-12 checks
		for _, item := range checkItems[0 : 10+rand.Intn(3)] {
			status := "pass"
			if rand.Float64() < 0.05 {
				status = "warning"
			}
			if rand.Float64() < 0.02 {
				status = "fail"
			}

			pool.Exec(ctx, `
				INSERT INTO vehicle_condition_checks 
				(trip_id, vehicle_id, check_type, check_item_name, status)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (trip_id, vehicle_id, check_type, check_item_name) DO NOTHING
			`, tripID, vehicleID, "pre_trip", item, status)
			conditionCheckCount++
		}

		// Post-trip: 8-10 checks (less detailed)
		for _, item := range checkItems[0 : 8+rand.Intn(2)] {
			status := "pass"
			if rand.Float64() < 0.08 {
				status = "warning"
			}
			if rand.Float64() < 0.03 {
				status = "fail"
			}

			pool.Exec(ctx, `
				INSERT INTO vehicle_condition_checks 
				(trip_id, vehicle_id, check_type, check_item_name, status)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (trip_id, vehicle_id, check_type, check_item_name) DO NOTHING
			`, tripID, vehicleID, "post_trip", item, status)
			conditionCheckCount++
		}
	}
	fmt.Printf("✅ Created %d vehicle condition checks\n", conditionCheckCount)

	// 4. Seed reconciliation_records
	fmt.Println("\n[4/4] Seeding reconciliation_records...")

	reconciliationCount := 0
	rows6, _ := pool.Query(ctx, `
		SELECT t.id, COUNT(DISTINCT ts.shipment_id), COALESCE(SUM(p.amount), 0)
		FROM trips t
		LEFT JOIN trip_stops ts ON ts.trip_id = t.id
		LEFT JOIN payments p ON p.order_id = ANY(
			SELECT o.id FROM sales_orders o 
			WHERE o.id = ANY(s.order_ids)
		)
		CROSS JOIN LATERAL (SELECT id, order_ids FROM shipments s LIMIT 1) s
		WHERE t.status = 'completed' AND t.completed_at IS NOT NULL
		GROUP BY t.id
		LIMIT 300
	`)
	defer rows6.Close()

	type tripReconcData struct {
		tripID        uuid.UUID
		shipmentCount int64
		totalMoney    float64
	}
	var tripReconciliations []tripReconcData

	for rows6.Next() {
		var tr tripReconcData
		if rows6.Scan(&tr.tripID, &tr.shipmentCount, &tr.totalMoney) == nil {
			tripReconciliations = append(tripReconciliations, tr)
		}
	}

	for _, tr := range tripReconciliations {
		reconciliationDate := time.Now().AddDate(0, 0, -rand.Intn(60)).Truncate(24 * time.Hour)

		// Simulate match (90%) or discrepancy (10%)
		isMatched := rand.Float64() < 0.9
		moneyMatch := isMatched
		goodsMatch := isMatched
		assetsMatch := isMatched

		pool.Exec(ctx, `
			INSERT INTO reconciliation_records
			(trip_id, reconciliation_date, goods_expected, goods_delivered, goods_returned,
			 goods_match, money_expected, money_collected, money_credit, money_match,
			 assets_expected, assets_actual, assets_match, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			ON CONFLICT (trip_id) DO NOTHING
		`, tr.tripID, reconciliationDate,
			`[{"product_id": "1", "qty": 100}]`, // Simplified
			`[{"product_id": "1", "qty": 98}]`,
			`[{"product_id": "1", "qty": 2}]`,
			goodsMatch,
			tr.totalMoney, tr.totalMoney*0.98, 0, moneyMatch,
			`[{"asset_type": "pallet", "qty": 10}]`,
			`[{"asset_type": "pallet", "qty": 10}]`,
			assetsMatch,
			"reconciled")
		reconciliationCount++
	}

	fmt.Printf("✅ Created %d reconciliation records\n", reconciliationCount)

	fmt.Println("\n" + strings.Repeat("=", 90))
	fmt.Println("✅ Data seeding complete!")
	fmt.Printf("   📊 Driver Ratings: %d\n", driverRatingCount)
	fmt.Printf("   📊 Supplier Ratings: %d\n", supplierRatingCount)
	fmt.Printf("   📊 Vehicle Checks: %d\n", conditionCheckCount)
	fmt.Printf("   📊 Reconciliations: %d\n", reconciliationCount)
	fmt.Println(strings.Repeat("=", 90) + "\n")
}
