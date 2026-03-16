package main

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

func main() {
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   0,
	})
	ctx := context.Background()

	// Delete old data
	rdb.Del(ctx, "gps:latest")

	ts := time.Now().UTC().Format(time.RFC3339)

	vehicles := map[string]string{
		"e0000000-0000-0000-0000-000000000005": fmt.Sprintf(`{"lat":20.9565,"lng":107.072,"speed":35.5,"heading":85,"ts":"%s"}`, ts),
		"e0000000-0000-0000-0000-000000000009": fmt.Sprintf(`{"lat":20.948,"lng":107.085,"speed":28.3,"heading":120,"ts":"%s"}`, ts),
		"00770000-0000-0000-0000-000000000001": fmt.Sprintf(`{"lat":20.828,"lng":106.685,"speed":22.0,"heading":210,"ts":"%s"}`, ts),
		"00770000-0000-0000-0000-000000000017": fmt.Sprintf(`{"lat":21.052,"lng":106.548,"speed":45.0,"heading":270,"ts":"%s"}`, ts),
	}

	for vid, json := range vehicles {
		err := rdb.HSet(ctx, "gps:latest", vid, json).Err()
		if err != nil {
			fmt.Printf("ERROR %s: %v\n", vid, err)
		} else {
			fmt.Printf("OK %s\n", vid)
		}
	}

	// Verify
	result, _ := rdb.HGetAll(ctx, "gps:latest").Result()
	fmt.Printf("\nStored %d GPS entries:\n", len(result))
	for k, v := range result {
		fmt.Printf("  %s -> %s\n", k, v)
	}
}
