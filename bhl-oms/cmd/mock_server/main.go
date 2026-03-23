package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

// Mock server for external system APIs: Bravo ERP, DMS, Zalo OA
// Run: go run cmd/mock_server/main.go
// Endpoints:
//   Bravo (port 9001): POST /api/documents/delivery, GET /api/credit-balance, POST /webhooks/bravo
//   DMS   (port 9002): POST /api/orders/sync
//   Zalo  (port 9003): POST /message/template
//
// Set env vars before starting main server:
//   INTEGRATION_MOCK=false
//   BRAVO_URL=http://localhost:9001
//   DMS_URL=http://localhost:9002
//   ZALO_OA_TOKEN=mock_token

func main() {
	log.Println("========================================")
	log.Println("  BHL Mock Server — External APIs")
	log.Println("========================================")

	var wg sync.WaitGroup

	wg.Add(3)
	go func() { defer wg.Done(); startBravo() }()
	go func() { defer wg.Done(); startDMS() }()
	go func() { defer wg.Done(); startZalo() }()

	log.Println("")
	log.Println("Mock servers ready:")
	log.Println("  Bravo ERP:  http://localhost:9001")
	log.Println("  DMS:        http://localhost:9002")
	log.Println("  Zalo OA:    http://localhost:9003")
	log.Println("")
	log.Println("To use: set INTEGRATION_MOCK=false and restart BHL OMS server")

	wg.Wait()
}

// ==================== BRAVO ERP ====================

func startBravo() {
	mux := http.NewServeMux()

	// POST /api/documents/delivery — Push delivery document
	mux.HandleFunc("/api/documents/delivery", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var doc map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"status": "error", "code": "INVALID_PAYLOAD",
			})
			return
		}

		orderNum, _ := doc["order_number"].(string)
		log.Printf("[BRAVO] Received delivery document: %s", orderNum)

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":         "success",
			"document_id":    fmt.Sprintf("PHGIANG-2026-%06d", rand.Intn(999999)),
			"posted_at":      time.Now().Format(time.RFC3339),
			"voucher_number": fmt.Sprintf("PGH%s%02d", time.Now().Format("20060102"), rand.Intn(99)),
		})
	})

	// GET /api/credit-balance?customer_codes=NPP001,NPP002
	mux.HandleFunc("/api/credit-balance", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		codes := r.URL.Query().Get("customer_codes")
		log.Printf("[BRAVO] Credit balance request: %s", codes)

		// Return mock credit balances
		var results []map[string]interface{}
		for _, code := range splitCodes(codes) {
			results = append(results, map[string]interface{}{
				"customer_code": code,
				"balance":       178750000 + float64(rand.Intn(50000000)),
				"last_payment":  time.Now().AddDate(0, 0, -rand.Intn(7)).Format("2006-01-02"),
			})
		}
		writeJSON(w, http.StatusOK, results)
	})

	// POST /api/payment-receipt — Push payment
	mux.HandleFunc("/api/payment-receipt", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		log.Printf("[BRAVO] Payment receipt received")
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":      "success",
			"receipt_id":  fmt.Sprintf("PT-%s-%04d", time.Now().Format("20060102"), rand.Intn(9999)),
			"received_at": time.Now().Format(time.RFC3339),
		})
	})

	// POST /webhooks/bravo — Bravo sends webhook
	mux.HandleFunc("/webhooks/bravo", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[BRAVO] Webhook received (method: %s)", r.Method)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": "ok"})
	})

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"service": "bravo-mock", "status": "ok"})
	})

	log.Println("  Bravo ERP mock starting on :9001")
	if err := http.ListenAndServe(":9001", withLogging("BRAVO", mux)); err != nil {
		log.Fatalf("Bravo mock failed: %v", err)
	}
}

// ==================== DMS ====================

func startDMS() {
	mux := http.NewServeMux()

	// POST /api/orders/sync — Sync order status
	mux.HandleFunc("/api/orders/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var order map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error_code": "INVALID_PAYLOAD",
			})
			return
		}

		orderNum, _ := order["order_number"].(string)
		status, _ := order["status"].(string)
		log.Printf("[DMS] Order sync: %s → %s", orderNum, status)

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":      true,
			"dms_order_id": fmt.Sprintf("DMS-2026-%06d", rand.Intn(999999)),
			"synced_at":    time.Now().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"service": "dms-mock", "status": "ok"})
	})

	log.Println("  DMS mock starting on :9002")
	if err := http.ListenAndServe(":9002", withLogging("DMS", mux)); err != nil {
		log.Fatalf("DMS mock failed: %v", err)
	}
}

// ==================== ZALO OA ====================

func startZalo() {
	mux := http.NewServeMux()

	// POST /message/template — Send ZNS message
	mux.HandleFunc("/message/template", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var msg map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"error": -1, "message": "invalid payload",
			})
			return
		}

		phone, _ := msg["phone"].(string)
		templateID, _ := msg["template_id"].(string)

		// Log specific template types
		if templateID == "order_confirmation" {
			templateData, _ := msg["template_data"].(map[string]interface{})
			orderNum, _ := templateData["order_number"].(string)
			confirmURL, _ := templateData["confirm_url"].(string)
			log.Printf("[ZALO] 📋 ORDER CONFIRMATION to %s — Order: %s", phone, orderNum)
			log.Printf("[ZALO]   → Customer confirm URL: %s", confirmURL)
		} else if templateID == "delivery_confirmation" {
			log.Printf("[ZALO] 🚛 DELIVERY CONFIRMATION to %s", phone)
		} else {
			log.Printf("[ZALO] ZNS sent to %s (template: %s)", phone, templateID)
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"error":   0,
			"message": "Success",
			"data": map[string]interface{}{
				"msg_id": fmt.Sprintf("zns_mock_%d", time.Now().UnixNano()%1000000),
			},
		})
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"service": "zalo-mock", "status": "ok"})
	})

	log.Println("  Zalo OA mock starting on :9003")
	if err := http.ListenAndServe(":9003", withLogging("ZALO", mux)); err != nil {
		log.Fatalf("Zalo mock failed: %v", err)
	}
}

// ==================== Helpers ====================

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func splitCodes(s string) []string {
	if s == "" {
		return nil
	}
	var codes []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			code := s[start:i]
			if code != "" {
				codes = append(codes, code)
			}
			start = i + 1
		}
	}
	if start < len(s) {
		codes = append(codes, s[start:])
	}
	return codes
}

// withLogging wraps a handler with request logging
func withLogging(prefix string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s %s (%s)", prefix, r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
