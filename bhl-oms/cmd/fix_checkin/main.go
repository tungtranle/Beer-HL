package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, "postgres://bhl:bhl_secret@localhost:5434/bhl_dev?sslmode=disable")
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	// Show all delivery dates from shipments/orders
	fmt.Println("=== Delivery dates in system ===")
	rows0, _ := conn.Query(ctx, `
		SELECT delivery_date::text, COUNT(*) 
		FROM sales_orders 
		WHERE delivery_date IS NOT NULL 
		GROUP BY delivery_date ORDER BY delivery_date DESC LIMIT 10
	`)
	var deliveryDates []string
	for rows0.Next() {
		var d string
		var c int
		rows0.Scan(&d, &c)
		fmt.Printf("  Order date: %s (%d orders)\n", d, c)
		deliveryDates = append(deliveryDates, d)
	}
	rows0.Close()

	// Also check shipments pending dates  
	rows0b, _ := conn.Query(ctx, `
		SELECT DISTINCT so.delivery_date::text
		FROM shipments sh
		JOIN sales_orders so ON so.id = sh.order_id
		WHERE sh.status IN ('pending', 'ready_for_delivery', 'confirmed')
		AND so.delivery_date IS NOT NULL
		ORDER BY 1 DESC LIMIT 5
	`)
	fmt.Println("\n=== Pending shipment delivery dates ===")
	for rows0b.Next() {
		var d string
		rows0b.Scan(&d)
		fmt.Printf("  Pending shipments date: %s\n", d)
		// Add to list if not already there
		found := false
		for _, dd := range deliveryDates {
			if dd == d { found = true; break }
		}
		if !found { deliveryDates = append(deliveryDates, d) }
	}
	rows0b.Close()

	// Current dates for reference
	var pgCurrentDate, vnDate string
	conn.QueryRow(ctx, "SELECT CURRENT_DATE::text").Scan(&pgCurrentDate)
	conn.QueryRow(ctx, "SELECT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text").Scan(&vnDate)
	fmt.Printf("\nPostgreSQL CURRENT_DATE: %s\n", pgCurrentDate)
	fmt.Printf("Vietnam date: %s\n", vnDate)
	fmt.Printf("Go time.Now(): %s\n", time.Now().Format("2006-01-02"))

	// Add current dates to the list
	for _, d := range []string{pgCurrentDate, vnDate, time.Now().Format("2006-01-02")} {
		found := false
		for _, dd := range deliveryDates { if dd == d { found = true; break } }
		if !found { deliveryDates = append(deliveryDates, d) }
	}

	// Insert check-ins for ALL delivery dates × ALL active drivers
	fmt.Printf("\n=== Inserting check-ins for %d dates ===\n", len(deliveryDates))
	for _, date := range deliveryDates {
		tag, err := conn.Exec(ctx, `
			INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
			SELECT d.id, $1::date, 'available', NOW() - INTERVAL '1 hour'
			FROM drivers d
			WHERE d.status = 'active'
			ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available'
		`, date)
		if err != nil {
			fmt.Printf("  ❌ Date %s: %v\n", date, err)
		} else {
			fmt.Printf("  ✅ Date %s: %d drivers checked in\n", date, tag.RowsAffected())
		}
	}

	// Final check
	fmt.Println("\n=== Final state ===")
	rows, _ := conn.Query(ctx, `
		SELECT checkin_date::text, COUNT(*) 
		FROM driver_checkins WHERE status='available' 
		GROUP BY checkin_date ORDER BY checkin_date DESC
	`)
	for rows.Next() {
		var date string
		var count int
		rows.Scan(&date, &count)
		fmt.Printf("  Date %s: %d available\n", date, count)
	}
	rows.Close()

	// Check warehouse assignment
	var withWarehouse, withoutWarehouse int
	conn.QueryRow(ctx, "SELECT COUNT(*) FROM drivers WHERE status='active' AND warehouse_id IS NOT NULL").Scan(&withWarehouse)
	conn.QueryRow(ctx, "SELECT COUNT(*) FROM drivers WHERE status='active' AND warehouse_id IS NULL").Scan(&withoutWarehouse)
	fmt.Printf("\nDrivers with warehouse: %d, without: %d\n", withWarehouse, withoutWarehouse)

	// Show warehouse_ids used
	rows2, _ := conn.Query(ctx, "SELECT warehouse_id::text, COUNT(*) FROM drivers WHERE status='active' AND warehouse_id IS NOT NULL GROUP BY warehouse_id")
	for rows2.Next() {
		var wid string
		var c int
		rows2.Scan(&wid, &c)
		fmt.Printf("  Warehouse %s: %d drivers\n", wid, c)
	}
	rows2.Close()

	fmt.Println("\n✅ Done! Refresh the planning page.")
}
