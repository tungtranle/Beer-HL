package main

import (
	"encoding/csv"
	"fmt"
	"os"
	"regexp"
	"strings"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

// Province name normalization
func fixProvince(raw string) string {
	g := strings.TrimSpace(raw)
	switch {
	case strings.Contains(g, "Thanh Xuân") || strings.Contains(g, "Hà Đong") || strings.Contains(g, "Hà Đông"):
		return "Hà Nội"
	case strings.Contains(g, "TP.HỒ CHÍ MINH") || strings.Contains(g, "HCM"):
		return "TP. Hồ Chí Minh"
	default:
		return g
	}
}

func main() {
	// Open tab-separated TXT file (UTF-16 LE with BOM)
	f, err := os.Open(`d:\Beer HL\Tai lieu\danh sach NPP.txt`)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	// Decode UTF-16 LE → UTF-8
	decoder := unicode.UTF16(unicode.LittleEndian, unicode.UseBOM).NewDecoder()
	reader := csv.NewReader(transform.NewReader(f, decoder))
	reader.Comma = '\t'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		fmt.Fprintf(os.Stderr, "csv: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "Read %d records (including header)\n", len(records))

	// Write directly to file (avoid PowerShell encoding issues)
	outPath := `d:\Beer HL\bhl-oms\migrations\import_real_npp.sql`
	outFile, err := os.Create(outPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "create output: %v\n", err)
		os.Exit(1)
	}
	defer outFile.Close()
	out := outFile
	fmt.Fprintln(out, "-- BHL NPP Real Data Import")
	fmt.Fprintln(out, "-- Source: danh sach NPP.txt (218 NPPs)")
	fmt.Fprintln(out, "-- Date: 2026-03-20")
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "BEGIN;")
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "-- 1. Truncate customers (CASCADE removes all dependent data)")
	fmt.Fprintln(out, "TRUNCATE TABLE customers CASCADE;")

	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "-- 2. Insert real BHL NPPs")
	fmt.Fprintln(out, "")

	codeRe := regexp.MustCompile(`-([A-Z]{1,5}-?\d+)$`)

	count := 0
	for i, rec := range records {
		if i == 0 {
			continue // skip header
		}
		if len(rec) < 7 {
			fmt.Fprintf(os.Stderr, "Row %d: only %d fields, skipping\n", i, len(rec))
			continue
		}

		stt := strings.TrimSpace(rec[0])
		region := strings.TrimSpace(rec[1])
		name := strings.TrimSpace(rec[2])
		addr := strings.TrimSpace(rec[3])
		// rec[4] = business type (skip)
		lng := strings.TrimSpace(rec[5])
		lat := strings.TrimSpace(rec[6])

		// Generate code from NPP name or fallback to NPP-{STT}
		code := fmt.Sprintf("NPP-%03s", stt)
		if m := codeRe.FindStringSubmatch(name); len(m) > 1 {
			code = m[1]
		}

		// Fix province name
		province := fixProvince(region)

		if addr == "" {
			addr = province
		}

		// Coordinates
		lngSQL := "NULL"
		latSQL := "NULL"
		if lng != "" && lat != "" && lng != "0" && lat != "0" {
			lngSQL = lng
			latSQL = lat
		}

		fmt.Fprintf(out, "INSERT INTO customers (code, name, address, province, longitude, latitude, is_active) VALUES (%s, %s, %s, %s, %s, %s, true);\n",
			sqlStr(code), sqlStr(name), sqlStr(addr), sqlStr(province), lngSQL, latSQL)
		count++
	}

	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "-- 3. Auto-generate credit limits for all customers")
	fmt.Fprintln(out, "-- Random realistic credit limits based on province/region")
	fmt.Fprintln(out, "INSERT INTO credit_limits (customer_id, credit_limit, effective_from)")
	fmt.Fprintln(out, "SELECT id,")
	fmt.Fprintln(out, "  CASE")
	fmt.Fprintln(out, "    WHEN province = 'Quảng Ninh' THEN (300 + (EXTRACT(EPOCH FROM created_at)::int % 500)) * 1000000")
	fmt.Fprintln(out, "    WHEN province = 'Hải Phòng'  THEN (250 + (EXTRACT(EPOCH FROM created_at)::int % 400)) * 1000000")
	fmt.Fprintln(out, "    WHEN province = 'Hải Dương'  THEN (200 + (EXTRACT(EPOCH FROM created_at)::int % 350)) * 1000000")
	fmt.Fprintln(out, "    WHEN province = 'Thái Bình'  THEN (150 + (EXTRACT(EPOCH FROM created_at)::int % 300)) * 1000000")
	fmt.Fprintln(out, "    WHEN province = 'Bắc Giang'  THEN (200 + (EXTRACT(EPOCH FROM created_at)::int % 400)) * 1000000")
	fmt.Fprintln(out, "    WHEN province = 'Bắc Ninh'   THEN (200 + (EXTRACT(EPOCH FROM created_at)::int % 350)) * 1000000")
	fmt.Fprintln(out, "    ELSE (150 + (EXTRACT(EPOCH FROM created_at)::int % 300)) * 1000000")
	fmt.Fprintln(out, "  END,")
	fmt.Fprintln(out, "  '2026-01-01'")
	fmt.Fprintln(out, "FROM customers;")
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "COMMIT;")
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "-- Verify")
	fmt.Fprintln(out, "SELECT province, COUNT(*) FROM customers GROUP BY province ORDER BY province;")
	fmt.Fprintln(out, "SELECT 'Total customers: ' || count(*) FROM customers;")
	fmt.Fprintln(out, "SELECT 'Total credit_limits: ' || count(*) FROM credit_limits;")

	fmt.Fprintf(os.Stderr, "Generated %d INSERT statements\n", count)
}

func sqlStr(s string) string {
	s = strings.ReplaceAll(s, "'", "''")
	return "'" + s + "'"
}
