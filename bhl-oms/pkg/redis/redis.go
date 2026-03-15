package redis

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

// NewClient creates a Redis client from a redis:// URL.
func NewClient(redisURL string) *redis.Client {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Invalid REDIS_URL: %v", err)
	}
	return redis.NewClient(opts)
}

// Ping verifies Redis connectivity.
func Ping(ctx context.Context, rdb *redis.Client) error {
	return rdb.Ping(ctx).Err()
}
