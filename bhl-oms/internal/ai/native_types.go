package ai

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AIProviderCall struct {
	FeatureKey string
	ActionType string
	Prompt     string
	UserID     uuid.UUID
	Role       string
}

type AIProviderCallResult struct {
	Text     string          `json:"text"`
	Provider string          `json:"provider"`
	Privacy  PrivacyDecision `json:"privacy"`
	Latency  int             `json:"latency_ms"`
}

type AIAuditLogInput struct {
	FeatureKey   string
	ActionType   string
	Provider     string
	Route        PrivacyRoute
	Model        string
	Sensitivity  SensitivityLevel
	Confidence   float64
	RequestHash  string
	Redacted     bool
	LatencyMS    int
	Success      bool
	ErrorMessage string
	UserID       uuid.UUID
	Role         string
}

type AIProviderStatus struct {
	Name      string `json:"name"`
	Route     string `json:"route"`
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}

type AITransparencySnapshot struct {
	GeneratedAt time.Time          `json:"generated_at"`
	Flags       map[string]bool    `json:"flags"`
	Providers   []AIProviderStatus `json:"providers"`
	Guardrails  []string           `json:"guardrails"`
	CostMode    string             `json:"cost_mode"`
}

type AIInboxItem struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	Priority    string          `json:"priority"`
	Title       string          `json:"title"`
	Detail      string          `json:"detail"`
	Suggestion  json.RawMessage `json:"ai_suggestion"`
	GroupKey    string          `json:"group_key"`
	Status      string          `json:"status"`
	CreatedAt   time.Time       `json:"created_at"`
	Explainable bool            `json:"explainable"`
}

type IntentMatch struct {
	Intent     string         `json:"intent"`
	Action     string         `json:"action"`
	Confidence float64        `json:"confidence"`
	Tier       int            `json:"tier"`
	Href       string         `json:"href,omitempty"`
	Args       map[string]any `json:"args"`
	RequiresAI bool           `json:"requires_ai"`
}

type VoiceCommandResult struct {
	Command          string   `json:"command"`
	Transcript       string   `json:"transcript"`
	Confidence       float64  `json:"confidence"`
	Allowed          bool     `json:"allowed"`
	ConfirmRequired  bool     `json:"confirm_required"`
	AutoCancelSecond int      `json:"auto_cancel_second"`
	Reasons          []string `json:"reasons"`
}

type SimulationOption struct {
	ID       string         `json:"id"`
	Title    string         `json:"title"`
	Metrics  map[string]any `json:"metrics"`
	Warnings []string       `json:"warnings"`
}

type SimulationSnapshot struct {
	ID                  uuid.UUID          `json:"id"`
	Type                string             `json:"type"`
	Status              string             `json:"status"`
	Options             []SimulationOption `json:"options"`
	RecommendedOptionID string             `json:"recommended_option_id"`
	Explanation         string             `json:"explanation"`
	ExpiresAt           time.Time          `json:"expires_at"`
	CreatedAt           time.Time          `json:"created_at"`
}

type TrustSuggestion struct {
	ActionType     string  `json:"action_type"`
	CurrentTier    int     `json:"current_tier"`
	SuggestedTier  int     `json:"suggested_tier"`
	Confidence     float64 `json:"confidence"`
	Reason         string  `json:"reason"`
	RequiresReview bool    `json:"requires_review"`
}
