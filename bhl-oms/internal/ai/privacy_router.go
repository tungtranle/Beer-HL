package ai

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
)

type PrivacyRoute string

const (
	PrivacyRouteCloud   PrivacyRoute = "cloud"
	PrivacyRouteLocal   PrivacyRoute = "local"
	PrivacyRouteRules   PrivacyRoute = "rules"
	PrivacyRouteBlocked PrivacyRoute = "blocked"
)

type SensitivityLevel string

const (
	SensitivityLow    SensitivityLevel = "low"
	SensitivityMedium SensitivityLevel = "medium"
	SensitivityHigh   SensitivityLevel = "high"
)

type PrivacyDecision struct {
	Route          PrivacyRoute     `json:"route"`
	Sensitivity    SensitivityLevel `json:"sensitivity"`
	Confidence     float64          `json:"confidence"`
	Redacted       bool             `json:"redacted"`
	SanitizedInput string           `json:"sanitized_input"`
	Reasons        []string         `json:"reasons"`
	RequestHash    string           `json:"request_hash"`
}

type privacyPattern struct {
	name        string
	re          *regexp.Regexp
	replacement string
	sensitivity SensitivityLevel
	cloudSafe   bool
}

var privacyPatterns = []privacyPattern{
	{name: "phone", re: regexp.MustCompile(`(?i)(\+?84|0)(3|5|7|8|9)\d{8}\b`), replacement: "[PHONE]", sensitivity: SensitivityHigh, cloudSafe: false},
	{name: "cccd", re: regexp.MustCompile(`\b\d{12}\b`), replacement: "[ID_NUMBER]", sensitivity: SensitivityHigh, cloudSafe: false},
	{name: "email", re: regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`), replacement: "[EMAIL]", sensitivity: SensitivityHigh, cloudSafe: false},
	{name: "npp_code", re: regexp.MustCompile(`\b(NPP|HD|QN|HP|HL|KH)[-_]?\d{2,6}\b`), replacement: "[NPP_CODE]", sensitivity: SensitivityMedium, cloudSafe: true},
	{name: "money", re: regexp.MustCompile(`(?i)\b\d{1,3}([\.,]\d{3})*\s*(vnđ|vnd|đ|trieu|triệu|ty|tỷ)\b?`), replacement: "[MONEY]", sensitivity: SensitivityMedium, cloudSafe: true},
	{name: "stock", re: regexp.MustCompile(`(?i)(ton kho|tồn kho|available_stock|reserved|stock).*\d+`), replacement: "[STOCK_CONTEXT]", sensitivity: SensitivityMedium, cloudSafe: true},
	{name: "plate", re: regexp.MustCompile(`\b\d{2}[A-Z]-\d{3}\.\d{2}\b`), replacement: "[PLATE]", sensitivity: SensitivityMedium, cloudSafe: true},
	{name: "address", re: regexp.MustCompile(`(?i)(dia chi|địa chỉ|duong|đường|phuong|phường|quan|quận|tp\.)[^\n]{0,80}`), replacement: "[ADDRESS]", sensitivity: SensitivityHigh, cloudSafe: false},
}

func RoutePrivacy(input string) PrivacyDecision {
	sanitized := input
	reasons := []string{}
	sensitivity := SensitivityLow
	cloudSafe := true

	for _, pattern := range privacyPatterns {
		if !pattern.re.MatchString(sanitized) {
			continue
		}
		reasons = append(reasons, pattern.name)
		if sensitivityRank(pattern.sensitivity) > sensitivityRank(sensitivity) {
			sensitivity = pattern.sensitivity
		}
		if !pattern.cloudSafe {
			cloudSafe = false
		}
		sanitized = pattern.re.ReplaceAllString(sanitized, pattern.replacement)
	}

	decision := PrivacyDecision{
		Route:          PrivacyRouteCloud,
		Sensitivity:    sensitivity,
		Confidence:     0.95,
		Redacted:       sanitized != input,
		SanitizedInput: strings.TrimSpace(sanitized),
		Reasons:        reasons,
		RequestHash:    hashRequest(input),
	}

	if strings.TrimSpace(input) == "" {
		decision.Route = PrivacyRouteBlocked
		decision.Confidence = 1
		decision.Reasons = append(decision.Reasons, "empty_input")
		return decision
	}

	if sensitivity == SensitivityHigh && !cloudSafe {
		decision.Route = PrivacyRouteLocal
		decision.Confidence = 0.9
		return decision
	}
	if sensitivity == SensitivityMedium {
		decision.Route = PrivacyRouteCloud
		decision.Confidence = 0.88
	}
	return decision
}

func sensitivityRank(level SensitivityLevel) int {
	switch level {
	case SensitivityHigh:
		return 3
	case SensitivityMedium:
		return 2
	default:
		return 1
	}
}

func hashRequest(input string) string {
	sum := sha256.Sum256([]byte(input))
	return hex.EncodeToString(sum[:])
}
