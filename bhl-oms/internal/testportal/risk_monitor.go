package testportal

// risk_monitor.go — Risk Monitor: đọc git log → map risk rules
//
// GET /v1/test-portal/risk-monitor
// Reads recent git commits and classifies each changed file
// according to aqf/risk-rules.yml patterns.
// Returns a risk map with gate requirements per changed file.

import (
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
)

// RiskItem represents a changed file with its risk classification.
type RiskItem struct {
	FilePath   string   `json:"file_path"`
	Risk       string   `json:"risk"`    // critical | high | medium | low
	RuleID     string   `json:"rule_id"` // RISK-BHL-xxx
	RuleName   string   `json:"rule_name"`
	Gates      []string `json:"gates"` // required gates
	CommitHash string   `json:"commit_hash"`
	CommitMsg  string   `json:"commit_msg"`
	ChangedAt  string   `json:"changed_at"`
}

// RiskMonitorReport holds the full risk assessment from recent git log.
type RiskMonitorReport struct {
	CommitCount   int        `json:"commit_count"`
	ChangedFiles  int        `json:"changed_files"`
	CriticalCount int        `json:"critical_count"`
	HighCount     int        `json:"high_count"`
	Items         []RiskItem `json:"items"`
	HighestRisk   string     `json:"highest_risk"` // critical | high | medium | low | none
	RequiredGates []string   `json:"required_gates"`
	RunAt         time.Time  `json:"run_at"`
}

// riskRule is an in-memory representation of a risk-rules.yml entry.
type riskRule struct {
	ID       string
	Name     string
	Patterns []string
	Risk     string
	Gates    []string
}

// bhlRiskRules mirrors the key rules from aqf/risk-rules.yml
// Hard-coded to avoid YAML parsing dependency.
var bhlRiskRules = []riskRule{
	{
		ID:       "RISK-BHL-AUTH",
		Name:     "Authentication & Authorization",
		Patterns: []string{"internal/auth/", "internal/middleware/auth", "internal/middleware/permission_guard"},
		Risk:     "critical",
		Gates:    []string{"G1", "G2"},
	},
	{
		ID:       "RISK-BHL-MIGRATION",
		Name:     "Database Migration",
		Patterns: []string{"migrations/"},
		Risk:     "critical",
		Gates:    []string{"G1", "G2"},
	},
	{
		ID:       "RISK-BHL-CREDIT",
		Name:     "Credit Limit & ATP Business Rules",
		Patterns: []string{"internal/oms/service.go", "internal/oms/handler.go", "internal/admin/handler.go", "web/src/app/dashboard/orders/new/"},
		Risk:     "critical",
		Gates:    []string{"G1", "G2"},
	},
	{
		ID:       "RISK-BHL-STATE-MACHINES",
		Name:     "Order / Trip / Stop State Machines",
		Patterns: []string{"internal/oms/service.go", "internal/tms/service.go", "internal/wms/service.go"},
		Risk:     "critical",
		Gates:    []string{"G1", "G2"},
	},
	{
		ID:       "RISK-BHL-FINANCE",
		Name:     "Financial Calculations",
		Patterns: []string{"internal/accounting/", "internal/reconciliation/", "internal/oms/"},
		Risk:     "critical",
		Gates:    []string{"G1", "G2"},
	},
	{
		ID:       "RISK-BHL-VRP",
		Name:     "VRP Route Optimization",
		Patterns: []string{"internal/vrp/", "vrp-solver/"},
		Risk:     "high",
		Gates:    []string{"G1", "G2"},
	},
	{
		ID:       "RISK-BHL-INTEGRATION",
		Name:     "External Integrations (Bravo/DMS/Zalo)",
		Patterns: []string{"internal/integration/"},
		Risk:     "high",
		Gates:    []string{"G1"},
	},
	{
		ID:       "RISK-BHL-FRONTEND",
		Name:     "Frontend Dashboard",
		Patterns: []string{"web/src/"},
		Risk:     "medium",
		Gates:    []string{"G2"},
	},
	{
		ID:       "RISK-BHL-CONFIG",
		Name:     "Configuration Changes",
		Patterns: []string{"aqf/", ".github/", "docker-compose"},
		Risk:     "medium",
		Gates:    []string{"G1"},
	},
}

// classifyFile returns the highest-risk rule matching a file path.
func classifyFile(filePath string) *riskRule {
	// Normalize to forward slashes
	normalized := strings.ReplaceAll(filePath, "\\", "/")
	var best *riskRule
	riskOrder := map[string]int{"critical": 4, "high": 3, "medium": 2, "low": 1}

	for i := range bhlRiskRules {
		rule := &bhlRiskRules[i]
		for _, pattern := range rule.Patterns {
			if strings.Contains(normalized, pattern) {
				if best == nil || riskOrder[rule.Risk] > riskOrder[best.Risk] {
					best = rule
				}
				break
			}
		}
	}
	return best
}

// getGitChangedFiles runs git log --name-only to get recently changed files.
func getGitChangedFiles(repoDir string, commits int) ([]struct{ hash, msg, file, date string }, error) {
	// git log --pretty=format:"%H|%s|%ad" --date=short --name-only -n N
	cmd := exec.Command("git", "log",
		"--pretty=format:%H|%s|%ad",
		"--date=short",
		"--name-only",
		"-n", "20", // look at last 20 commits
	)
	cmd.Dir = repoDir

	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var results []struct{ hash, msg, file, date string }
	lines := strings.Split(string(out), "\n")

	var currentHash, currentMsg, currentDate string
	count := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Check if it's a commit header (contains | separators)
		parts := strings.SplitN(line, "|", 3)
		if len(parts) == 3 && len(parts[0]) == 40 {
			// New commit header
			currentHash = parts[0][:8] // short hash
			currentMsg = parts[1]
			currentDate = parts[2]
			count++
			if count > commits {
				break
			}
			continue
		}

		// It's a file name
		if currentHash != "" && line != "" && !strings.HasPrefix(line, "commit ") {
			results = append(results, struct{ hash, msg, file, date string }{
				hash: currentHash,
				msg:  currentMsg,
				file: line,
				date: currentDate,
			})
		}
	}
	return results, nil
}

// GET /v1/test-portal/risk-monitor
func (h *Handler) GetRiskMonitor(c *gin.Context) {
	// Find the repo root (bhl-oms directory)
	repoDir := findRepoRoot()

	changedFiles, err := getGitChangedFiles(repoDir, 10)
	report := &RiskMonitorReport{
		RunAt: time.Now(),
		Items: make([]RiskItem, 0),
	}

	if err != nil {
		// Git not available or not a git repo — return empty report
		report.HighestRisk = "unknown"
		response.OK(c, report)
		return
	}

	riskOrder := map[string]int{"critical": 4, "high": 3, "medium": 2, "low": 1, "none": 0}
	seen := map[string]bool{}
	gatesNeeded := map[string]bool{}
	highestRisk := "none"

	for _, cf := range changedFiles {
		key := cf.hash + "|" + cf.file
		if seen[key] {
			continue
		}
		seen[key] = true

		rule := classifyFile(cf.file)
		if rule == nil {
			continue
		}

		item := RiskItem{
			FilePath:   cf.file,
			Risk:       rule.Risk,
			RuleID:     rule.ID,
			RuleName:   rule.Name,
			Gates:      rule.Gates,
			CommitHash: cf.hash,
			CommitMsg:  cf.msg,
			ChangedAt:  cf.date,
		}
		report.Items = append(report.Items, item)
		report.ChangedFiles++

		switch rule.Risk {
		case "critical":
			report.CriticalCount++
		case "high":
			report.HighCount++
		}

		if riskOrder[rule.Risk] > riskOrder[highestRisk] {
			highestRisk = rule.Risk
		}
		for _, g := range rule.Gates {
			gatesNeeded[g] = true
		}
	}

	// Count unique commits
	seen = map[string]bool{}
	for _, item := range report.Items {
		seen[item.CommitHash] = true
	}
	report.CommitCount = len(seen)
	report.HighestRisk = highestRisk

	// Collect required gates
	for g := range gatesNeeded {
		report.RequiredGates = append(report.RequiredGates, g)
	}

	response.OK(c, report)
}

// findRepoRoot finds the bhl-oms repo directory from working directory.
func findRepoRoot() string {
	// Try common locations relative to working directory
	candidates := []string{
		".",
		"..",
		"../bhl-oms",
	}
	for _, c := range candidates {
		abs, err := filepath.Abs(c)
		if err != nil {
			continue
		}
		// Check if it's a git repo
		cmd := exec.Command("git", "rev-parse", "--git-dir")
		cmd.Dir = abs
		if cmd.Run() == nil {
			return abs
		}
	}
	return "."
}
