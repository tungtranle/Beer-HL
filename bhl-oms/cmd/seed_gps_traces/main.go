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
	"github.com/shopspring/decimal"
)

const (
	// Hanoi approximate center
	hanoiLatMin, hanoiLatMax = 20.8, 21.1
	hanoiLngMin, hanoiLngMax = 105.7, 106.0
)

type GPSPoint struct {
	Lat       decimal.Decimal
	Lng       decimal.Decimal
	SpeedKmh  decimal.Decimal
	Heading   decimal.Decimal
	Accuracy  decimal.Decimal
	Timestamp time.Time
}

// Simulate realistic GPS path along route
func generateGPSPath(lat, lng float64, numPoints int) []GPSPoint {
	points := make([]GPSPoint, numPoints)

	// Start point with small random offset
	startLat := lat + (rand.Float64()-0.5)*0.005
	startLng := lng + (rand.Float64()-0.5)*0.005

	// Random direction (heading)
	heading := rand.Float64() * 360

	for i := 0; i < numPoints; i++ {
		// Gradual movement toward random destination
		moveFraction := float64(i) / float64(numPoints)
		destLatOffset := (rand.Float64() - 0.5) * 0.02
		destLngOffset := (rand.Float64() - 0.5) * 0.02

		currentLat := startLat + destLatOffset*moveFraction
		currentLng := startLng + destLngOffset*moveFraction

		// Realistic speed: 10-60 km/h for urban delivery
		speed := 10.0 + rand.Float64()*50.0

		// Speed varies: slower in congestion, faster on highway
		if rand.Float64() < 0.2 {
			speed = 5.0 + rand.Float64()*15.0 // Congestion: 5-20 km/h
		}

		// Slight heading variation
		heading = heading + (rand.Float64()-0.5)*15.0
		if heading < 0 {
			heading += 360
		}
		if heading >= 360 {
			heading -= 360
		}

		// GPS accuracy ±5m typical, ±20m in poor conditions
		accuracy := 5.0 + rand.Float64()*15.0
		if rand.Float64() < 0.1 {
			accuracy = 15.0 + rand.Float64()*35.0 // Poor signal: 15-50m
		}

		points[i] = GPSPoint{
			Lat:       decimal.NewFromFloat(currentLat),
			Lng:       decimal.NewFromFloat(currentLng),
			SpeedKmh:  decimal.NewFromFloat(speed),
			Heading:   decimal.NewFromFloat(heading),
			Accuracy:  decimal.NewFromFloat(accuracy),
			Timestamp: time.Now().Add(-24 * time.Hour).Add(time.Duration(i*15) * time.Second),
		}
	}

	return points
}

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
	fmt.Println("📍 SEEDING GPS LOCATION DATA FOR ACTIVE TRIPS")
	fmt.Println(strings.Repeat("=", 90))

	// Get active vehicles and their recent trips
	fmt.Println("\n[1/2] Fetching active vehicles and trips...")

	type VehicleTrip struct {
		VehicleID uuid.UUID
		DriverID  *uuid.UUID
		TripID    uuid.UUID
	}

	var vehicleTrips []VehicleTrip

	rows, _ := pool.Query(ctx, `
		SELECT t.id, COALESCE(t.vehicle_id, gen_random_uuid()::uuid), COALESCE(t.driver_id, NULL::uuid)
		FROM trips t
		WHERE t.status::text IN ('in_transit', 'at_stop', 'completed', 'settled', 'reconciled')
		  AND t.created_at > NOW() - INTERVAL '90 days'
		ORDER BY t.created_at DESC
		LIMIT 200
	`)
	defer rows.Close()

	for rows.Next() {
		var vt VehicleTrip
		rows.Scan(&vt.VehicleID, &vt.DriverID, &vt.TripID)
		vehicleTrips = append(vehicleTrips, vt)
	}

	fmt.Printf("✅ Found %d vehicles with trips\n", len(vehicleTrips))

	// Seed GPS data
	fmt.Println("\n[2/2] Generating GPS traces...")

	totalGPS := 0

	for idx, vt := range vehicleTrips {
		if idx%10 == 0 {
			fmt.Printf("  Processing vehicle %d/%d... (%d GPS points so far)\n", idx+1, len(vehicleTrips), totalGPS)
		}

		// Random delivery route within Hanoi
		startLat := hanoiLatMin + rand.Float64()*(hanoiLatMax-hanoiLatMin)
		startLng := hanoiLngMin + rand.Float64()*(hanoiLngMax-hanoiLngMin)

		// Generate 50-150 GPS points per trip (typical: 1 point every 15-30 seconds)
		numPoints := 50 + rand.Intn(100)
		gpsPoints := generateGPSPath(startLat, startLng, numPoints)

		// Batch insert
		for _, gpsPoint := range gpsPoints {
			pool.Exec(ctx, `
				INSERT INTO gps_locations 
				(id, vehicle_id, driver_id, lat, lng, speed_kmh, heading, accuracy_m, recorded_at)
				VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
			`, vt.VehicleID, vt.DriverID, gpsPoint.Lat, gpsPoint.Lng, gpsPoint.SpeedKmh,
				gpsPoint.Heading, gpsPoint.Accuracy, gpsPoint.Timestamp)
			totalGPS++
		}
	}

	fmt.Printf("✅ Generated %d GPS location points\n", totalGPS)

	// Verify
	fmt.Println("\n[Verification] Checking inserted GPS data...")
	var gpsCount int64
	pool.QueryRow(ctx, `SELECT COUNT(*) FROM gps_locations`).Scan(&gpsCount)

	var vehiclesWithGPS int64
	pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT vehicle_id) FROM gps_locations
	`).Scan(&vehiclesWithGPS)

	var speedStats struct {
		MinSpeed float64
		MaxSpeed float64
		AvgSpeed float64
	}
	pool.QueryRow(ctx, `
		SELECT 
			MIN(speed_kmh)::float,
			MAX(speed_kmh)::float,
			AVG(speed_kmh)::float
		FROM gps_locations
	`).Scan(&speedStats.MinSpeed, &speedStats.MaxSpeed, &speedStats.AvgSpeed)

	fmt.Printf("📊 Total GPS points: %d\n", gpsCount)
	fmt.Printf("📊 Vehicles with GPS: %d\n", vehiclesWithGPS)
	fmt.Printf("📊 Speed range: %.1f - %.1f km/h (avg: %.1f)\n",
		speedStats.MinSpeed, speedStats.MaxSpeed, speedStats.AvgSpeed)

	// Check for anomalies
	var speedAnomalies int64
	pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM gps_locations 
		WHERE speed_kmh > 100 OR speed_kmh < 0
	`).Scan(&speedAnomalies)

	if speedAnomalies > 0 {
		fmt.Printf("⚠️  Speed anomalies (>100 or <0 km/h): %d (will trigger AI detection)\n", speedAnomalies)
	}

	fmt.Println("\n" + strings.Repeat("=", 90))
	fmt.Println("✅ GPS seeding complete!")
	fmt.Println(strings.Repeat("=", 90) + "\n")
}
