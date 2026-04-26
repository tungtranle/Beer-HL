package testportal

// aqf_engine.go — Decision Brief engine, evidence store, business health
//
// Decision Brief algorithm (AQF Section 4.3):
//   Start: 100 points
//   -20 per critical golden invariant that fails
//   -10 per high-priority golden invariant that fails
//   -20 per unanswered block_ship open question
//   -10 per DB connectivity issue
//   -5  per warning (non-blocking)
//   >= 85 → SHIP | >= 60 → CAUTION | < 60 → HOLD

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────────────────
// Decision Brief
// ─────────────────────────────────────────────────────────────

func (h *Handler) ComputeDecisionBrief(goldenResults []GoldenResult, health BusinessHealth) *DecisionBrief {
	score := 100
	var blocking []string
	var warnings []string

	// Golden invariant scoring
	for _, r := range goldenResults {
		if r.Status == "fail" {
			switch r.Priority {
			case "critical":
				score -= 20
				blocking = append(blocking, fmt.Sprintf("[%s] %s — %d/%d cases fail", r.InvariantID, r.Name, r.FailedCases, r.TotalCases))
			case "high":
				score -= 10
				warnings = append(warnings, fmt.Sprintf("[%s] %s — %d cases fail", r.InvariantID, r.Name, r.FailedCases))
			}
		} else if r.Status == "error" {
			score -= 15
			blocking = append(blocking, fmt.Sprintf("[%s] %s — golden runner error", r.InvariantID, r.Name))
		}
	}

	// Health scoring
	if !health.DBConnOK {
		score -= 30
		blocking = append(blocking, "Database connection FAILED")
	}
	if !health.RedisOK {
		score -= 5
		warnings = append(warnings, "Redis unavailable — cache/session degraded")
	}
	if health.FailedIntegrations > 0 {
		score -= 5
		warnings = append(warnings, fmt.Sprintf("%d failed integration jobs pending", health.FailedIntegrations))
	}
	if health.OpenDiscrepancies > 5 {
		score -= 5
		warnings = append(warnings, fmt.Sprintf("%d open reconciliation discrepancies", health.OpenDiscrepancies))
	}

	// Open questions
	for _, q := range defaultOpenQuestions() {
		if q.BlockShip && q.Answer == "" {
			score -= 20
			blocking = append(blocking, fmt.Sprintf("[%s] Unanswered: %s", q.ID, q.Question))
		}
	}

	if score < 0 {
		score = 0
	}

	var verdict, summary string
	switch {
	case score >= 85:
		verdict = "SHIP"
		summary = fmt.Sprintf("Confidence %d/100 — Hệ thống đạt ngưỡng ship. Tất cả invariants quan trọng pass.", score)
	case score >= 60:
		verdict = "CAUTION"
		summary = fmt.Sprintf("Confidence %d/100 — Ship được nhưng cần chú ý %d cảnh báo.", score, len(warnings))
	default:
		verdict = "HOLD"
		summary = fmt.Sprintf("Confidence %d/100 — HOLD: %d vấn đề blocking cần giải quyết trước khi ship.", score, len(blocking))
	}

	evidenceID := uuid.New().String()[:8]

	brief := &DecisionBrief{
		Verdict:        verdict,
		Confidence:     score,
		Summary:        summary,
		BlockingIssues: blocking,
		Warnings:       warnings,
		Gates:          deriveGateStatus(goldenResults, health),
		RunAt:          time.Now(),
		EvidenceID:     evidenceID,
	}

	return brief
}

func deriveGateStatus(goldenResults []GoldenResult, health BusinessHealth) []GateStatus {
	now := time.Now()

	// G0: local build/vet/test — we don't run this from portal, show as "manual"
	g0 := GateStatus{
		Gate:    "G0",
		Status:  "skip",
		Summary: "Run AQF_G0_CHECK.bat locally before commit",
		RunAt:   &now,
	}

	// G1: depends on golden + health
	g1Status := "pass"
	if !health.DBConnOK || !health.RedisOK {
		g1Status = "fail"
	}
	g1 := GateStatus{
		Gate:    "G1",
		Status:  g1Status,
		Summary: "Infrastructure health check",
		RunAt:   &now,
	}

	// G2: golden dataset results
	g2Status := "pass"
	g2Fails := 0
	for _, r := range goldenResults {
		if r.Status == "fail" && r.Priority == "critical" {
			g2Status = "fail"
			g2Fails++
		}
	}
	g2Summary := fmt.Sprintf("%d golden invariants checked", len(goldenResults))
	if g2Fails > 0 {
		g2Summary = fmt.Sprintf("%d critical invariants FAIL", g2Fails)
	}
	g2 := GateStatus{
		Gate:    "G2",
		Status:  g2Status,
		Summary: g2Summary,
		RunAt:   &now,
	}

	// G3: E2E — would require Playwright, show as unknown (can be triggered from CI)
	g3 := GateStatus{
		Gate:    "G3",
		Status:  "skip",
		Summary: "E2E Playwright — trigger via GitHub Actions or npm run test:e2e",
	}

	// G4: production metrics (not available in dev portal)
	g4 := GateStatus{
		Gate:    "G4",
		Status:  "skip",
		Summary: "Production watch — check Sentry + /health endpoint after deploy",
	}

	return []GateStatus{g0, g1, g2, g3, g4}
}

// ─────────────────────────────────────────────────────────────
// Business Health
// ─────────────────────────────────────────────────────────────

func (h *Handler) GetBusinessHealth(ctx context.Context) BusinessHealth {
	health := BusinessHealth{}

	// DB connectivity
	if err := h.db.Ping(ctx); err == nil {
		health.DBConnOK = true
	}

	// Redis connectivity
	if h.rdb != nil {
		if err := h.rdb.Ping(ctx).Err(); err == nil {
			health.RedisOK = true
		}
	}

	if !health.DBConnOK {
		return health
	}

	queries := []struct {
		dest  *int
		query string
	}{
		{&health.OrdersToday, `SELECT COUNT(*) FROM sales_orders WHERE created_at::date = CURRENT_DATE`},
		{&health.PendingApproval, `SELECT COUNT(*) FROM sales_orders WHERE status = 'pending_approval'`},
		{&health.ActiveTrips, `SELECT COUNT(*) FROM trips WHERE status IN ('approved','in_progress')`},
		{&health.PendingRecon, `SELECT COUNT(*) FROM trips WHERE status = 'completed' AND id NOT IN (SELECT trip_id FROM reconciliations WHERE trip_id IS NOT NULL)`},
		{&health.OpenDiscrepancies, `SELECT COUNT(*) FROM discrepancies WHERE status = 'open'`},
		{&health.FailedIntegrations, `SELECT COUNT(*) FROM integration_dlq WHERE status IN ('failed','retrying')`},
		{&health.LowStockAlerts, `SELECT COUNT(*) FROM (SELECT product_id FROM stock_quants GROUP BY product_id, warehouse_id HAVING SUM(quantity - reserved_qty) < 50) t`},
	}

	for _, q := range queries {
		_ = h.db.QueryRow(ctx, q.query).Scan(q.dest)
	}

	return health
}

// ─────────────────────────────────────────────────────────────
// Evidence Store — file-based persistence in aqf/evidence/
// ─────────────────────────────────────────────────────────────

func evidenceDir() string {
	candidates := []string{"aqf/evidence", "../aqf/evidence", "../../aqf/evidence"}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	// Auto-create if not found
	_ = os.MkdirAll("aqf/evidence", 0755)
	return "aqf/evidence"
}

func (h *Handler) SaveEvidence(brief *DecisionBrief, goldenResults []GoldenResult) {
	dir := evidenceDir()

	goldenPass, goldenFail := 0, 0
	for _, r := range goldenResults {
		if r.Status == "pass" {
			goldenPass++
		} else if r.Status == "fail" {
			goldenFail++
		}
	}

	rec := EvidenceRecord{
		ID:            brief.EvidenceID,
		RunAt:         brief.RunAt,
		Verdict:       brief.Verdict,
		Confidence:    brief.Confidence,
		GoldenPass:    goldenPass,
		GoldenFail:    goldenFail,
		BlockingCount: len(brief.BlockingIssues),
		WarningCount:  len(brief.Warnings),
	}

	filename := filepath.Join(dir, fmt.Sprintf("%s-%s.json",
		brief.RunAt.Format("20060102-150405"),
		brief.EvidenceID,
	))

	type evidenceFile struct {
		EvidenceRecord
		GoldenResults []GoldenResult `json:"golden_results"`
		Brief         *DecisionBrief `json:"brief"`
	}

	full := evidenceFile{
		EvidenceRecord: rec,
		GoldenResults:  goldenResults,
		Brief:          brief,
	}

	data, err := json.MarshalIndent(full, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(filename, data, 0644)
}

func (h *Handler) LoadEvidenceLog(limit int) []EvidenceRecord {
	dir := evidenceDir()

	entries, err := os.ReadDir(dir)
	if err != nil {
		return []EvidenceRecord{}
	}

	// Sort descending (newest first)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() > entries[j].Name()
	})

	var records []EvidenceRecord
	for _, e := range entries {
		if len(records) >= limit {
			break
		}
		if !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var rec struct {
			EvidenceRecord
		}
		if json.Unmarshal(data, &rec) == nil {
			records = append(records, rec.EvidenceRecord)
		}
	}
	return records
}

// ─────────────────────────────────────────────────────────────
// Open Questions — hardcoded from aqf.config.yml
// (In a full implementation, these would be stored in aqf/evidence/questions.json)
// ─────────────────────────────────────────────────────────────

const openQuestionsFile = "aqf/evidence/open-questions.json"

func defaultOpenQuestions() []OpenQuestion {
	return []OpenQuestion{
		{
			ID:        "Q-BHL-001",
			Question:  "Credit vượt >200% → auto reject hay vẫn pending_approval?",
			Affects:   "oms/service.go credit check logic",
			BlockShip: false,
		},
		{
			ID:        "Q-BHL-002",
			Question:  "Driver hoàn toàn offline (không 4G) → offline queue sync khi nào? timeout bao lâu?",
			Affects:   "web/src/lib/useOfflineSync.ts",
			BlockShip: true,
		},
		{
			ID:        "Q-BHL-003",
			Question:  "FEFO: nếu 2 lô cùng ngày hết hạn → ưu tiên lô nào (lot_number nhỏ hơn)?",
			Affects:   "wms/service.go FEFO sort",
			BlockShip: false,
		},
	}
}

func loadOpenQuestions() []OpenQuestion {
	data, err := os.ReadFile(openQuestionsPath())
	if err != nil {
		return defaultOpenQuestions()
	}
	var qs []OpenQuestion
	if json.Unmarshal(data, &qs) != nil {
		return defaultOpenQuestions()
	}
	return qs
}

func saveOpenQuestions(qs []OpenQuestion) error {
	data, err := json.MarshalIndent(qs, "", "  ")
	if err != nil {
		return err
	}
	_ = os.MkdirAll(filepath.Dir(openQuestionsPath()), 0755)
	return os.WriteFile(openQuestionsPath(), data, 0644)
}

func openQuestionsPath() string {
	candidates := []string{openQuestionsFile, "../" + openQuestionsFile, "../../" + openQuestionsFile}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return openQuestionsFile
}
