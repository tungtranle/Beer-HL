package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	connStr := "postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable"
	pool, err := pgxpool.New(context.Background(), connStr)
	if err != nil {
		fmt.Printf("❌ Connection error: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	fmt.Println("\n📊 DATA CONSISTENCY CHECK: Sales Orders → Shipments → Trips")
	fmt.Println(strings.Repeat("=", 70))

	// 1. Check total counts
	fmt.Println("\n📈 RECORD COUNTS:")
	fmt.Println(strings.Repeat("-", 70))

	var orderCount, shipmentCount, tripCount, tripStopsCount int64
	rows := pool.QueryRow(context.Background(), `
		SELECT 
			(SELECT COUNT(*) FROM sales_orders) as orders,
			(SELECT COUNT(*) FROM shipments) as shipments,
			(SELECT COUNT(*) FROM trips) as trips,
			(SELECT COUNT(*) FROM trip_stops) as trip_stops
	`)
	if err := rows.Scan(&orderCount, &shipmentCount, &tripCount, &tripStopsCount); err != nil {
		fmt.Printf("❌ Count query failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Sales Orders:  %12d\n", orderCount)
	fmt.Printf("Shipments:     %12d\n", shipmentCount)
	fmt.Printf("Trips:         %12d\n", tripCount)
	fmt.Printf("Trip Stops:    %12d\n", tripStopsCount)

	// 2. Check for orphan shipments (no matching order)
	fmt.Println("\n🔗 REFERENTIAL INTEGRITY:")
	fmt.Println(strings.Repeat("-", 70))

	var orphanShipments int64
	pool.QueryRow(context.Background(), `
		SELECT COUNT(*)
		FROM shipments sh
		WHERE NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sh.order_id)
	`).Scan(&orphanShipments)
	if orphanShipments > 0 {
		fmt.Printf("⚠️  Orphan shipments (no order): %d\n", orphanShipments)
	} else {
		fmt.Printf("✅ Orphan shipments: 0\n")
	}

	var orphanTripStops int64
	pool.QueryRow(context.Background(), `
		SELECT COUNT(*)
		FROM trip_stops ts
		WHERE NOT EXISTS (SELECT 1 FROM shipments sh WHERE sh.id = ts.shipment_id)
	`).Scan(&orphanTripStops)
	if orphanTripStops > 0 {
		fmt.Printf("⚠️  Orphan trip_stops (no shipment): %d\n", orphanTripStops)
	} else {
		fmt.Printf("✅ Orphan trip_stops: 0\n")
	}

	var orphanTripStopsTrip int64
	pool.QueryRow(context.Background(), `
		SELECT COUNT(*)
		FROM trip_stops ts
		WHERE NOT EXISTS (SELECT 1 FROM trips t WHERE t.id = ts.trip_id)
	`).Scan(&orphanTripStopsTrip)
	if orphanTripStopsTrip > 0 {
		fmt.Printf("⚠️  Trip_stops with invalid trip: %d\n", orphanTripStopsTrip)
	} else {
		fmt.Printf("✅ Trip_stops with valid trip: OK\n")
	}

	// 3. Check order-shipment mapping
	fmt.Println("\n📦 ORDER → SHIPMENT MAPPING:")
	fmt.Println(strings.Repeat("-", 70))

	var ordersWithShipments, ordersWithoutShipments int64
	pool.QueryRow(context.Background(), `
		SELECT 
			COUNT(DISTINCT sh.order_id) as with_shipments,
			COUNT(DISTINCT CASE WHEN NOT EXISTS (SELECT 1 FROM shipments sh2 WHERE sh2.order_id = so.id) THEN so.id END) as without
		FROM sales_orders so
		LEFT JOIN shipments sh ON sh.order_id = so.id
	`).Scan(&ordersWithShipments, &ordersWithoutShipments)

	var noShipmentCount int64
	pool.QueryRow(context.Background(), `
		SELECT COUNT(*)
		FROM sales_orders so
		WHERE NOT EXISTS (SELECT 1 FROM shipments sh WHERE sh.order_id = so.id)
	`).Scan(&noShipmentCount)

	fmt.Printf("Orders with shipments:    %d\n", ordersWithShipments)
	fmt.Printf("Orders without shipments: %d\n", noShipmentCount)
	if noShipmentCount > 0 {
		fmt.Printf("⚠️  ISSUE: %d orders have no shipment!\n", noShipmentCount)
	}

	// 4. Check shipment-tripstop mapping
	fmt.Println("\n📍 SHIPMENT → TRIP_STOPS MAPPING:")
	fmt.Println(strings.Repeat("-", 70))

	var shipmentsWithStops, shipmentsWithoutStops int64
	pool.QueryRow(context.Background(), `
		SELECT 
			COUNT(DISTINCT sh.id) as with_stops,
			COUNT(*) as total
		FROM shipments sh
		LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
		WHERE sh.created_at >= NOW() - INTERVAL '5 days'
	`).Scan(&shipmentsWithStops, &shipmentsWithoutStops)

	var recentShipments, shipmentsNoStops int64
	pool.QueryRow(context.Background(), `
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM trip_stops ts WHERE ts.shipment_id = sh.id) THEN 1 ELSE 0 END) as no_stops
		FROM shipments sh
		WHERE created_at >= NOW() - INTERVAL '5 days'
	`).Scan(&recentShipments, &shipmentsNoStops)

	fmt.Printf("Recent shipments (5 days):        %d\n", recentShipments)
	fmt.Printf("  - With trip_stops:             %d ✅\n", recentShipments-shipmentsNoStops)
	fmt.Printf("  - Without trip_stops:          %d\n", shipmentsNoStops)
	if shipmentsNoStops > 0 {
		fmt.Printf("⚠️  ISSUE: %d shipments without trip_stops\n", shipmentsNoStops)
	}

	// 5. Check status consistency
	fmt.Println("\n🔄 STATUS CONSISTENCY (Recent orders - 5 days):")
	fmt.Println(strings.Repeat("-", 70))

	type StatusCheck struct {
		OrderStatus    string
		ShipmentStatus string
		TripStatus     string
		Count          int64
	}

	rows2, _ := pool.Query(context.Background(), `
		SELECT 
			so.status::text as order_status,
			sh.status::text as shipment_status,
			t.status::text as trip_status,
			COUNT(*) as cnt
		FROM sales_orders so
		LEFT JOIN shipments sh ON sh.order_id = so.id
		LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
		LEFT JOIN trips t ON t.id = ts.trip_id
		WHERE so.created_at >= NOW() - INTERVAL '5 days'
		GROUP BY so.status, sh.status, t.status
		ORDER BY so.status, sh.status, t.status
		LIMIT 30
	`)
	defer rows2.Close()

	fmt.Printf("%-20s | %-20s | %-20s | Count\n", "Order Status", "Shipment Status", "Trip Status")
	fmt.Printf("%-20s + %-20s + %-20s + -----\n", strings.Repeat("-", 20), strings.Repeat("-", 20), strings.Repeat("-", 20))

	hasIssues := false
	for rows2.Next() {
		var orderStatus, shipmentStatus, tripStatus *string
		var cnt int64
		if err := rows2.Scan(&orderStatus, &shipmentStatus, &tripStatus, &cnt); err != nil {
			fmt.Printf("❌ Scan error: %v\n", err)
			continue
		}

		os := "NULL"
		if orderStatus != nil {
			os = *orderStatus
		}
		ss := "NULL"
		if shipmentStatus != nil {
			ss = *shipmentStatus
		}
		ts := "NULL"
		if tripStatus != nil {
			ts = *tripStatus
		}

		fmt.Printf("%-20s | %-20s | %-20s | %d\n", os, ss, ts, cnt)

		// Check for likely inconsistencies
		if (os == "confirmed" || os == "pending_approval") && ss == "NULL" {
			hasIssues = true
		}
	}

	if hasIssues {
		fmt.Println("\n⚠️  ISSUE: Some confirmed orders have NULL shipment status")
	}

	// 6. Check for orphan orders (confirmed but no active trips)
	fmt.Println("\n🚚 CONFIRMED ORDERS WITHOUT ACTIVE TRIPS:")
	fmt.Println(strings.Repeat("-", 70))

	var confirmedNoTrips int64
	pool.QueryRow(context.Background(), `
		SELECT COUNT(*)
		FROM sales_orders so
		WHERE so.status::text = 'confirmed'
		  AND so.created_at >= NOW() - INTERVAL '5 days'
		  AND NOT EXISTS (
			SELECT 1 FROM shipments sh
			WHERE sh.order_id = so.id
			AND EXISTS (
				SELECT 1 FROM trip_stops ts
				WHERE ts.shipment_id = sh.id
				AND EXISTS (
					SELECT 1 FROM trips t
					WHERE t.id = ts.trip_id
					AND t.status::text NOT IN ('cancelled', 'closed', 'completed')
				)
			)
		  )
	`).Scan(&confirmedNoTrips)

	fmt.Printf("Confirmed orders without active trips: %d\n", confirmedNoTrips)
	if confirmedNoTrips > 0 {
		fmt.Printf("⚠️  ISSUE: %d confirmed orders without active trips\n", confirmedNoTrips)
	} else {
		fmt.Printf("✅ All confirmed orders have active trips or in transit\n")
	}

	// 7. Data completeness summary
	fmt.Println("\n📊 DATA COMPLETENESS SUMMARY:")
	fmt.Println(strings.Repeat("-", 70))

	var completenessScore float64 = 100

	var missingShipments int64
	pool.QueryRow(context.Background(), `
		SELECT COUNT(*)
		FROM sales_orders so
		WHERE NOT EXISTS (SELECT 1 FROM shipments sh WHERE sh.order_id = so.id)
	`).Scan(&missingShipments)

	if missingShipments > 0 {
		penalty := float64(missingShipments) / float64(orderCount) * 100
		completenessScore -= penalty
	}

	var brokenLinks int64
	pool.QueryRow(context.Background(), `
		SELECT COUNT(*)
		FROM trip_stops ts
		WHERE NOT EXISTS (SELECT 1 FROM shipments sh WHERE sh.id = ts.shipment_id)
		   OR NOT EXISTS (SELECT 1 FROM trips t WHERE t.id = ts.trip_id)
	`).Scan(&brokenLinks)

	if brokenLinks > 0 {
		penalty := float64(brokenLinks) / float64(tripStopsCount) * 100
		completenessScore -= penalty
	}

	if completenessScore < 0 {
		completenessScore = 0
	}

	fmt.Printf("Completeness Score: %.1f%%\n", completenessScore)

	if completenessScore >= 98 {
		fmt.Printf("✅ E2E Data Consistency: GOOD\n")
	} else if completenessScore >= 95 {
		fmt.Printf("⚠️  E2E Data Consistency: FAIR (check above)\n")
	} else {
		fmt.Printf("❌ E2E Data Consistency: POOR (issues detected)\n")
	}

	fmt.Println("\n✅ Check complete!")
}
