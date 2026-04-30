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

	// Sentry
	SentryDSN string

	// Test Portal
	EnableTestPortal bool

	// Integration
	BravoURL        string
	BravoAPIKey     string
	DMSURL          string
	DMSAPIKey       string
	ZaloBaseURL     string
	ZaloOAToken     string
	ZaloOAID        string
	IntegrationMock bool

	// AI Intelligence Layer (Sprint 2)
	// Gemini free: 1,500 req/day — get key at https://aistudio.google.com
	GeminiAPIKey string
	// Groq free fallback: 14,400 req/day — get key at https://console.groq.com
	GroqAPIKey string

	// HIGH-007: allowed WebSocket/CORS origins (comma-separated)
	AllowedOrigins string
}

func Load() *Config {
	return &Config{
		Env:            getEnv("ENV", "development"),
		ServerPort:     getEnv("SERVER_PORT", "8080"),
		DBURL:          getEnv("DB_URL", "postgres://bhl:bhl_dev@localhost:5433/bhl_dev?sslmode=disable"),
		RedisURL:       getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTPrivKeyPath: getEnv("JWT_PRIVATE_KEY_PATH", "./keys/private.pem"),
		JWTPubKeyPath:  getEnv("JWT_PUBLIC_KEY_PATH", "./keys/public.pem"),
		JWTAccessTTL:   parseDuration(getEnv("JWT_ACCESS_TTL", "4h")),
		JWTRefreshTTL:  parseDuration(getEnv("JWT_REFRESH_TTL", "168h")), // 7 days
		VRPSolverURL:   getEnv("VRP_SOLVER_URL", "http://localhost:8090"),
		OSRMURL:        getEnv("OSRM_URL", "http://localhost:5000"),

		SentryDSN:        getEnv("SENTRY_DSN", ""),
		EnableTestPortal: getEnv("ENABLE_TEST_PORTAL", "true") == "true",

		BravoURL:        getEnv("BRAVO_URL", "http://localhost:9001"),
		BravoAPIKey:     getEnv("BRAVO_API_KEY", ""),
		DMSURL:          getEnv("DMS_URL", "http://localhost:9002"),
		DMSAPIKey:       getEnv("DMS_API_KEY", ""),
		ZaloBaseURL:     getEnv("ZALO_BASE_URL", ""),
		ZaloOAToken:     getEnv("ZALO_OA_TOKEN", ""),
		ZaloOAID:        getEnv("ZALO_OA_ID", ""),
		IntegrationMock: getEnv("INTEGRATION_MOCK", "true") == "true",

		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		GroqAPIKey:   getEnv("GROQ_API_KEY", ""),

		// HIGH-007: default to localhost:3000 for dev; set ALLOWED_ORIGINS in prod
		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
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
