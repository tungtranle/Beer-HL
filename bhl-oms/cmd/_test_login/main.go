package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, "postgres://bhl:bhl_secret@localhost:5434/bhl_dev?sslmode=disable")
	if err != nil {
		fmt.Println("DB connect error:", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	var username, passwordHash, role string
	var isActive bool
	err = conn.QueryRow(ctx,
		"SELECT username, password_hash, role, is_active FROM users WHERE username = $1", "driver01",
	).Scan(&username, &passwordHash, &role, &isActive)
	if err != nil {
		fmt.Println("Query error:", err)
		os.Exit(1)
	}

	fmt.Printf("Username: %s\nRole: %s\nActive: %v\nHash: %s\n", username, role, isActive, passwordHash)

	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte("demo123"))
	if err != nil {
		fmt.Println("BCRYPT FAIL:", err)
	} else {
		fmt.Println("BCRYPT OK: demo123 matches!")
	}

	// Test actual HTTP login endpoint
	body := []byte(`{"username":"driver01","password":"demo123"}`)
	resp, err := http.Post("http://localhost:8080/v1/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Println("HTTP error:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	fmt.Printf("HTTP %d: %s\n", resp.StatusCode, string(data)[:min(len(data), 200)])
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
