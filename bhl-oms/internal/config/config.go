package config

import (
	"os"
	"time"
)

type Config struct {
	Env            string
	ServerPort     string
	DBURL          string
	RedisURL       string
	JWTPrivKeyPath string
	JWTPubKeyPath  string
	JWTAccessTTL   time.Duration
	JWTRefreshTTL  time.Duration
	VRPSolverURL   string
	OSRMURL        string

	// Integration
	BravoURL      string
	BravoAPIKey   string
	DMSURL        string
	DMSAPIKey     string
	ZaloOAToken   string
	ZaloOAID      string
	IntegrationMock bool
}

func Load() *Config {
	return &Config{
		Env:            getEnv("ENV", "development"),
		ServerPort:     getEnv("SERVER_PORT", "8080"),
		DBURL:          getEnv("DB_URL", "postgres://bhl:bhl_dev@localhost:5432/bhl_dev?sslmode=disable"),
		RedisURL:       getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTPrivKeyPath: getEnv("JWT_PRIVATE_KEY_PATH", "./keys/private.pem"),
		JWTPubKeyPath:  getEnv("JWT_PUBLIC_KEY_PATH", "./keys/public.pem"),
		JWTAccessTTL:   parseDuration(getEnv("JWT_ACCESS_TTL", "4h")),
		JWTRefreshTTL:  parseDuration(getEnv("JWT_REFRESH_TTL", "168h")), // 7 days
		VRPSolverURL:   getEnv("VRP_SOLVER_URL", "http://localhost:8090"),
		OSRMURL:        getEnv("OSRM_URL", "http://localhost:5000"),

		BravoURL:        getEnv("BRAVO_URL", "http://localhost:9001"),
		BravoAPIKey:     getEnv("BRAVO_API_KEY", ""),
		DMSURL:          getEnv("DMS_URL", "http://localhost:9002"),
		DMSAPIKey:       getEnv("DMS_API_KEY", ""),
		ZaloOAToken:     getEnv("ZALO_OA_TOKEN", ""),
		ZaloOAID:        getEnv("ZALO_OA_ID", ""),
		IntegrationMock: getEnv("INTEGRATION_MOCK", "true") == "true",
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}
