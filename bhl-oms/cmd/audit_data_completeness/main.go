package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func count(pool *pgxpool.Pool, query string) int64 {
	var n int64
	pool.QueryRow(context.Background(), query).Scan(&n)
	return n
}

func pct(part, total int64) float64 {
	if total == 0 {
		return 0
	}
	return float64(part) / float64(total) * 100
}

func main() {
	pool, err := pgxpool.New(context.Background(), "postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable")
	if err != nil {
		fmt.Printf("❌ Connection error: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	bar := strings.Repeat("─", 85)
	fat := strings.Repeat("═", 85)

	fmt.Println("\n" + fat)
	fmt.Println("   BHL OMS-TMS-WMS -- HISTORICAL DATA COMPLETENESS AUDIT")
	fmt.Println(fat)

	// Core
	fmt.Println("\n" + bar)
	fmt.Println("[1] CORE BUSINESS DATA")
	fmt.Println(bar)
	orders := count(pool, `SELECT COUNT(*) FROM sales_orders`)
	shipments := count(pool, `SELECT COUNT(*) FROM shipments`)
	trips := count(pool, `SELECT COUNT(*) FROM trips`)
	stops := count(pool, `SELECT COUNT(*) FROM trip_stops`)
	fmt.Printf("OK  Sales Orders   : %8d\n", orders)
	fmt.Printf("OK  Shipments      : %8d\n", shipments)
	fmt.Printf("OK  Trips          : %8d\n", trips)
	fmt.Printf("OK  Trip Stops     : %8d\n", stops)

	// Delivery
	fmt.Println("\n" + bar)
	fmt.Println("[2] DELIVERY & E-POD  (table: epod)")
	fmt.Println(bar)
	attempts := count(pool, `SELECT COUNT(*) FROM delivery_attempts`)
	epods := count(pool, `SELECT COUNT(*) FROM epod`)
	epodWithPhotos := count(pool, `SELECT COUNT(*) FROM epod WHERE array_length(photo_urls,1) > 0`)
	payments := count(pool, `SELECT COUNT(*) FROM payments`)
	fmt.Printf("OK  Delivery Attempts: %8d  (%.0f%% of stops)\n", attempts, pct(attempts, stops))
	fmt.Printf("OK  E-POD records   : %8d  (co anh: %d -- %.0f%%)\n", epods, epodWithPhotos, pct(epodWithPhotos, stops))
	fmt.Printf("OK  Payments        : %8d  (%.0f%% of stops)\n", payments, pct(payments, stops))

	// GPS
	fmt.Println("\n" + bar)
	fmt.Println("[3] GPS DATA  (table: gps_locations, partitioned)")
	fmt.Println(bar)
	gpsTotal := count(pool, `SELECT COUNT(*) FROM gps_locations`)
	vehWithGPS := count(pool, `SELECT COUNT(DISTINCT vehicle_id) FROM gps_locations`)
	vehTotal := count(pool, `SELECT COUNT(*) FROM vehicles WHERE status='active'`)
	tripsWithGPS := count(pool, `
		SELECT COUNT(DISTINCT t.id) FROM trips t 
		JOIN gps_locations g ON g.vehicle_id = t.vehicle_id 
		  AND g.recorded_at BETWEEN COALESCE(t.started_at, t.created_at) 
		                        AND COALESCE(t.completed_at, NOW())
		WHERE t.vehicle_id IS NOT NULL`)
	var avgSpeed float64
	pool.QueryRow(context.Background(), `SELECT COALESCE(AVG(speed_kmh),0)::float FROM gps_locations`).Scan(&avgSpeed)
	gpsStatus := "WARN"
	if gpsTotal == 0 {
		gpsStatus = "MISS"
	} else if pct(tripsWithGPS, trips) > 80 {
		gpsStatus = "OK  "
	}
	fmt.Printf("%s GPS Points      : %8d  (avg %.0f km/h)\n", gpsStatus, gpsTotal, avgSpeed)
	fmt.Printf("     Xe co GPS     : %8d / %d active vehicles\n", vehWithGPS, vehTotal)
	fmt.Printf("     Chuyen co GPS : %8d / %d trips (%.0f%%)\n", tripsWithGPS, trips, pct(tripsWithGPS, trips))

	// Checklists
	fmt.Println("\n" + bar)
	fmt.Println("[4] TRIP CHECKLISTS  (table: trip_checklists)")
	fmt.Println(bar)
	checklists := count(pool, `SELECT COUNT(*) FROM trip_checklists`)
	tripsWithCheckl := count(pool, `SELECT COUNT(DISTINCT trip_id) FROM trip_checklists`)
	passedCheckl := count(pool, `SELECT COUNT(*) FROM trip_checklists WHERE is_passed = true`)
	ckStatus := "MISS"
	if checklists > 0 {
		ckStatus = "OK  "
	}
	fmt.Printf("%s Trip Checklists : %8d  (%.0f%% of trips)\n", ckStatus, checklists, pct(tripsWithCheckl, trips))
	if checklists > 0 {
		fmt.Printf("     Passed        : %8d  (%.0f%%)\n", passedCheckl, pct(passedCheckl, checklists))
	}

	// Gate Checks
	fmt.Println("\n" + bar)
	fmt.Println("[5] GATE CHECKS  (table: gate_checks)")
	fmt.Println(bar)
	gateChecks := count(pool, `SELECT COUNT(*) FROM gate_checks`)
	gatePass := count(pool, `SELECT COUNT(*) FROM gate_checks WHERE result::text = 'pass'`)
	gateFail := count(pool, `SELECT COUNT(*) FROM gate_checks WHERE result::text = 'fail'`)
	shipsWithGate := count(pool, `SELECT COUNT(DISTINCT shipment_id) FROM gate_checks`)
	gcStatus := "WARN"
	if pct(shipsWithGate, shipments) > 80 {
		gcStatus = "OK  "
	}
	fmt.Printf("%s Gate Checks     : %8d  (%d shipments = %.0f%% coverage)\n", gcStatus, gateChecks, shipsWithGate, pct(shipsWithGate, shipments))
	if gateChecks > 0 {
		fmt.Printf("     Pass / Fail   : %d / %d  (%.0f%% pass)\n", gatePass, gateFail, pct(gatePass, gateChecks))
	}

	// Reconciliation
	fmt.Println("\n" + bar)
	fmt.Println("[6] RECONCILIATION  (table: reconciliations)")
	fmt.Println(bar)
	recons := count(pool, `SELECT COUNT(*) FROM reconciliations`)
	tripsWithRecon := count(pool, `SELECT COUNT(DISTINCT trip_id) FROM reconciliations`)
	reconGoods := count(pool, `SELECT COUNT(*) FROM reconciliations WHERE recon_type::text = 'goods'`)
	reconPayment := count(pool, `SELECT COUNT(*) FROM reconciliations WHERE recon_type::text = 'payment'`)
	reconAsset := count(pool, `SELECT COUNT(*) FROM reconciliations WHERE recon_type::text = 'asset'`)
	rStatus := "MISS"
	if tripsWithRecon > 0 {
		rStatus = "OK  "
	}
	fmt.Printf("%s Reconciliations : %8d  (%d trips = %.0f%%)\n", rStatus, recons, tripsWithRecon, pct(tripsWithRecon, trips))
	if recons > 0 {
		fmt.Printf("     goods: %d  payment: %d  asset: %d\n", reconGoods, reconPayment, reconAsset)
	}

	// Ratings
	fmt.Println("\n" + bar)
	fmt.Println("[7] PERFORMANCE RATINGS")
	fmt.Println(bar)
	driverRatings := count(pool, `SELECT COUNT(*) FROM driver_ratings`)
	suppRatings := count(pool, `SELECT COUNT(*) FROM supplier_ratings`)
	driversRated := count(pool, `SELECT COUNT(DISTINCT driver_id) FROM driver_ratings`)
	driversTotal := count(pool, `SELECT COUNT(*) FROM drivers WHERE status = 'active'`)
	customersRated := count(pool, `SELECT COUNT(DISTINCT customer_id) FROM supplier_ratings`)
	customersTotal := count(pool, `SELECT COUNT(*) FROM customers WHERE is_active = true`)
	fmt.Printf("OK  Driver Ratings  : %8d  (%d / %d drivers = %.0f%%)\n", driverRatings, driversRated, driversTotal, pct(driversRated, driversTotal))
	fmt.Printf("OK  Supplier Ratings: %8d  (%d / %d customers = %.0f%%)\n", suppRatings, customersRated, customersTotal, pct(customersRated, customersTotal))

	// Summary
	fmt.Println("\n" + fat)
	fmt.Println("SUMMARY -- COVERAGE MAP")
	fmt.Println(fat)
	type sumRow struct {
		name   string
		got    int64
		target int64
		note   string
	}
	rows := []sumRow{
		{"E-POD (co anh)", epodWithPhotos, stops, "Visual proof giao hang"},
		{"GPS points", gpsTotal, trips * 100, "AI anomaly, ETA (~100pts/trip)"},
		{"Trip Checklists", checklists, trips, "Vehicle health monitoring"},
		{"Gate Checks", gateChecks, shipments, "Inventory validation"},
		{"Reconciliation (trips)", tripsWithRecon, trips, "Audit trail"},
		{"Driver Ratings", driverRatings, driversTotal * 3, "AI performance scoring"},
		{"Supplier Ratings", suppRatings, customersTotal * 2, "Credit risk AI"},
	}
	for _, r := range rows {
		icon := "OK "
		coverage := pct(r.got, r.target)
		if coverage < 50 {
			icon = "ERR"
		} else if coverage < 80 {
			icon = "WRN"
		}
		fmt.Printf("  %s  %-28s : %7d / %-7d (%.0f%%)  -- %s\n",
			icon, r.name, r.got, r.target, coverage, r.note)
	}

	fmt.Println("\n" + fat + "\n")
}
