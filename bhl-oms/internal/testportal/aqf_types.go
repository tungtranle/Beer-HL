package testportal

import "time"

// ─────────────────────────────────────────────────────────────
// Gate status (G0 → G4)
// ─────────────────────────────────────────────────────────────

type GateStatus struct {
	Gate      string     `json:"gate"`
	Status    string     `json:"status"` // pass | fail | warn | skip | unknown | running
	DurationS float64    `json:"duration_s"`
	Summary   string     `json:"summary"`
	RunAt     *time.Time `json:"run_at,omitempty"`
}

// ─────────────────────────────────────────────────────────────
// Golden Dataset Validation
// ─────────────────────────────────────────────────────────────

type GoldenResult struct {
	InvariantID string       `json:"invariant_id"`
	Name        string       `json:"name"`
	Module      string       `json:"module"`
	Priority    string       `json:"priority"` // critical | high
	Status      string       `json:"status"`   // pass | fail | skip | error
	TotalCases  int          `json:"total_cases"`
	PassedCases int          `json:"passed_cases"`
	FailedCases int          `json:"failed_cases"`
	FailDetails []FailDetail `json:"fail_details,omitempty"`
	DurationMs  int64        `json:"duration_ms"`
	GoldenFile  string       `json:"golden_file"`
}

type FailDetail struct {
	CaseID   string `json:"case_id"`
	Scenario string `json:"scenario,omitempty"`
	Message  string `json:"message"`
	Expected string `json:"expected,omitempty"`
	Actual   string `json:"actual,omitempty"`
}

// ─────────────────────────────────────────────────────────────
// Decision Brief
// ─────────────────────────────────────────────────────────────

type DecisionBrief struct {
	Verdict        string       `json:"verdict"`    // SHIP | CAUTION | HOLD
	Confidence     int          `json:"confidence"` // 0-100
	Summary        string       `json:"summary"`
	BlockingIssues []string     `json:"blocking_issues"`
	Warnings       []string     `json:"warnings"`
	Gates          []GateStatus `json:"gates"`
	RunAt          time.Time    `json:"run_at"`
	EvidenceID     string       `json:"evidence_id"`
}

// ─────────────────────────────────────────────────────────────
// Business Health
// ─────────────────────────────────────────────────────────────

type BusinessHealth struct {
	OrdersToday        int  `json:"orders_today"`
	PendingApproval    int  `json:"pending_approval"`
	ActiveTrips        int  `json:"active_trips"`
	PendingRecon       int  `json:"pending_recon"`
	OpenDiscrepancies  int  `json:"open_discrepancies"`
	FailedIntegrations int  `json:"failed_integrations"`
	LowStockAlerts     int  `json:"low_stock_alerts"`
	DBConnOK           bool `json:"db_conn_ok"`
	RedisOK            bool `json:"redis_ok"`
}

// ─────────────────────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────────────────────

type EvidenceRecord struct {
	ID            string    `json:"id"`
	RunAt         time.Time `json:"run_at"`
	Verdict       string    `json:"verdict"`
	Confidence    int       `json:"confidence"`
	GoldenPass    int       `json:"golden_pass"`
	GoldenFail    int       `json:"golden_fail"`
	BlockingCount int       `json:"blocking_count"`
	WarningCount  int       `json:"warning_count"`
	Notes         string    `json:"notes,omitempty"`
}

// ─────────────────────────────────────────────────────────────
// Open Questions (Human-in-the-Loop)
// ─────────────────────────────────────────────────────────────

type OpenQuestion struct {
	ID         string     `json:"id"`
	Question   string     `json:"question"`
	Affects    string     `json:"affects"`
	BlockShip  bool       `json:"block_ship"`
	Answer     string     `json:"answer,omitempty"` // yes | no | defer
	AnsweredAt *time.Time `json:"answered_at,omitempty"`
}

// ─────────────────────────────────────────────────────────────
// Full AQF Status (main API response)
// ─────────────────────────────────────────────────────────────

type AQFStatusResponse struct {
	LastRunAt     *time.Time       `json:"last_run_at"`
	Brief         *DecisionBrief   `json:"brief"`
	GoldenResults []GoldenResult   `json:"golden_results"`
	Health        BusinessHealth   `json:"health"`
	EvidenceLog   []EvidenceRecord `json:"evidence_log"`
	OpenQuestions []OpenQuestion   `json:"open_questions"`
}
