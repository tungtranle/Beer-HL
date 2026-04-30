package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	// Kết nối đến DB - sử dụng credentials từ docker-compose
	connStr := "postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable"
	pool, err := pgxpool.New(context.Background(), connStr)
	if err != nil {
		fmt.Printf("❌ Connection error: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	fmt.Println("\n📊 HISTORICAL DATA RANGE IN DATABASE:")
	fmt.Println("======================================")

	rows, err := pool.Query(context.Background(), `
		SELECT 'Sales Orders (delivery_date)' as table_name, MAX(delivery_date::date)::text as max_date FROM sales_orders WHERE delivery_date IS NOT NULL
		UNION ALL
		SELECT 'Sales Orders (created_at)', MAX(created_at::date)::text FROM sales_orders
		UNION ALL
		SELECT 'Trips (planned_date)', MAX(planned_date::date)::text FROM trips WHERE planned_date IS NOT NULL
		UNION ALL
		SELECT 'Shipments (created_at)', MAX(created_at::date)::text FROM shipments
		UNION ALL
		SELECT 'QA Scenario runs', MAX(started_at::date)::text FROM qa_scenario_runs
		ORDER BY 1
	`)
	if err != nil {
		fmt.Printf("❌ Query error: %v\n", err)
		os.Exit(1)
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		var maxDate *string
		if err := rows.Scan(&name, &maxDate); err != nil {
			fmt.Printf("❌ Scan error: %v\n", err)
			continue
		}
		if maxDate == nil {
			fmt.Printf("%-40s: (no data)\n", name)
		} else {
			fmt.Printf("%-40s: %s\n", name, *maxDate)
		}
	}
	if rows.Err() != nil {
		fmt.Printf("❌ Row iteration error: %v\n", rows.Err())
		os.Exit(1)
	}

	// Query ngày min/max để xem range
	fmt.Println("\n📅 FULL RANGE (Sales Orders):")
	fmt.Println("======================================")
	var minDate, maxDate *string
	var orderCount int64
	err = pool.QueryRow(context.Background(), `
		SELECT 
			MIN(created_at::date)::text as min_date,
			MAX(created_at::date)::text as max_date,
			COUNT(*) as total_orders
		FROM sales_orders
	`).Scan(&minDate, &maxDate, &orderCount)
	if err != nil {
		fmt.Printf("❌ Range query error: %v\n", err)
		os.Exit(1)
	} else {
		if minDate != nil && maxDate != nil {
			fmt.Printf("Created range:    %s → %s\n", *minDate, *maxDate)
			fmt.Printf("Total orders:     %d\n", orderCount)
		}
	}

	// Kiểm tra delivery date range
	var deliveryMin, deliveryMax *string
	var deliveryCount int64
	err = pool.QueryRow(context.Background(), `
		SELECT 
			MIN(delivery_date::date)::text as min_date,
			MAX(delivery_date::date)::text as max_date,
			COUNT(*) as total_orders
		FROM sales_orders
		WHERE delivery_date IS NOT NULL
	`).Scan(&deliveryMin, &deliveryMax, &deliveryCount)
	if err != nil {
		fmt.Printf("❌ Delivery range query error: %v\n", err)
	} else {
		if deliveryMin != nil && deliveryMax != nil {
			fmt.Printf("\nDelivery range:   %s → %s\n", *deliveryMin, *deliveryMax)
			fmt.Printf("Orders w/ delivery date: %d\n", deliveryCount)
		}
	}

	// Kiểm tra trips
	var tripMin, tripMax *string
	var tripCount int64
	err = pool.QueryRow(context.Background(), `
		SELECT 
			MIN(planned_date::date)::text,
			MAX(planned_date::date)::text,
			COUNT(*)
		FROM trips
		WHERE planned_date IS NOT NULL
	`).Scan(&tripMin, &tripMax, &tripCount)
	if err != nil {
		fmt.Printf("❌ Trips query error: %v\n", err)
	} else {
		if tripMin != nil && tripMax != nil {
			fmt.Printf("\nTrips date range: %s → %s\n", *tripMin, *tripMax)
			fmt.Printf("Total trips:      %d\n", tripCount)
		}
	}

	fmt.Println("\n✅ Done!")
}
