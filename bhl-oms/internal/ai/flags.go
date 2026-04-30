package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	FlagAIMaster        = "ai.master"
	FlagCopilot         = "ai.copilot"
	FlagBriefing        = "ai.briefing"
	FlagVoice           = "ai.voice"
	FlagCamera          = "ai.camera"
	FlagSimulation      = "ai.simulation"
	FlagIntent          = "ai.intent"
	FlagAutomationTier3 = "ai.automation.t3"
	FlagAutomationTier2 = "ai.automation.t2"
	FlagGPSAnomaly      = "ai.gps_anomaly"
	FlagDemandForecast  = "ai.forecast"
	FlagCreditScore     = "ai.credit_score"
	FlagAdaptiveUI      = "ai.adaptive_ui"
	FlagTransparency    = "ai.transparency"
	FlagTrustLoop       = "ai.trust_loop"
	FlagExplainability  = "ai.explainability"
	FlagFeedbackLoop    = "ai.feedback"
)

const defaultOrgScopeID = "bhl"

type FeatureFlagDefinition struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

type FeatureFlagState struct {
	ID        uuid.UUID       `json:"id"`
	FlagKey   string          `json:"flag_key"`
	ScopeType string          `json:"scope_type"`
	ScopeID   string          `json:"scope_id"`
	Enabled   bool            `json:"enabled"`
	Config    json.RawMessage `json:"config"`
	UpdatedBy *uuid.UUID      `json:"updated_by,omitempty"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type FeatureFlagAdminItem struct {
	Definition FeatureFlagDefinition `json:"definition"`
	Org        *FeatureFlagState     `json:"org"`
	Roles      []FeatureFlagState    `json:"roles"`
	Users      []FeatureFlagState    `json:"users"`
}

type UpsertFeatureFlagInput struct {
	FlagKey   string          `json:"flag_key"`
	ScopeType string          `json:"scope_type"`
	ScopeID   string          `json:"scope_id"`
	Enabled   bool            `json:"enabled"`
	Config    json.RawMessage `json:"config"`
	UpdatedBy uuid.UUID       `json:"updated_by"`
}

type EffectiveFeatureFlags struct {
	Flags map[string]bool `json:"flags"`
}

var FeatureFlagDefinitions = []FeatureFlagDefinition{
	{FlagAIMaster, "Master AI Switch", "Tắt/bật toàn bộ AI. Baseline UX vẫn hoạt động khi OFF.", "master"},
	{FlagCopilot, "Copilot Panel", "Trợ lý hội thoại theo vai trò.", "core"},
	{FlagBriefing, "Daily Briefing", "Tóm tắt điều phối/ngày làm việc.", "core"},
	{FlagVoice, "Voice Driver", "Lệnh giọng nói cho tài xế, luôn cần xác nhận.", "driver"},
	{FlagCamera, "Camera Extract", "Trích xuất thông tin từ ảnh, không auto-submit.", "driver"},
	{FlagSimulation, "Simulation Layer", "Mô phỏng trade-off trước khi áp dụng.", "decision"},
	{FlagIntent, "Intent Execution", "Cmd+K hiểu intent, có whitelist.", "core"},
	{FlagAutomationTier3, "Automation Tier 3", "Scheduled jobs read-only/idempotent.", "automation"},
	{FlagAutomationTier2, "Automation Tier 2", "Approval cards cho action cần người duyệt.", "automation"},
	{FlagGPSAnomaly, "GPS Anomaly", "Phát hiện bất thường GPS bằng AI/rules.", "safety"},
	{FlagDemandForecast, "Demand Forecast", "Dự báo nhu cầu cho OMS/DVKH.", "forecast"},
	{FlagCreditScore, "Credit Score", "Điểm rủi ro công nợ NPP.", "finance"},
	{FlagAdaptiveUI, "Adaptive UI", "Smart defaults và focus mode.", "ui"},
	{FlagTransparency, "Transparency Center", "Trạng thái model, automation log, cost.", "governance"},
	{FlagTrustLoop, "Trust Loop", "Promote/demote suggestion theo feedback.", "governance"},
	{FlagExplainability, "Explainability", "Vì sao? popover cho suggestion AI.", "governance"},
	{FlagFeedbackLoop, "Feedback Loop", "Feedback correct/wrong/not useful.", "governance"},
}

func validateFeatureFlagInput(input UpsertFeatureFlagInput) error {
	if !isKnownFlag(input.FlagKey) {
		return fmt.Errorf("unknown AI flag: %s", input.FlagKey)
	}
	if input.ScopeType != "org" && input.ScopeType != "role" && input.ScopeType != "user" {
		return fmt.Errorf("scope_type must be org, role, or user")
	}
	if input.ScopeID == "" {
		return fmt.Errorf("scope_id is required")
	}
	if len(input.Config) == 0 {
		input.Config = json.RawMessage(`{}`)
	}
	if !json.Valid(input.Config) {
		return fmt.Errorf("config must be valid JSON")
	}
	return nil
}

func isKnownFlag(flagKey string) bool {
	for _, def := range FeatureFlagDefinitions {
		if def.Key == flagKey {
			return true
		}
	}
	return false
}

func (s *Service) ListFeatureFlags(ctx context.Context) ([]FeatureFlagAdminItem, error) {
	states, err := s.repo.ListFeatureFlagStates(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]FeatureFlagAdminItem, 0, len(FeatureFlagDefinitions))
	for _, def := range FeatureFlagDefinitions {
		item := FeatureFlagAdminItem{Definition: def, Roles: []FeatureFlagState{}, Users: []FeatureFlagState{}}
		for _, state := range states {
			if state.FlagKey != def.Key {
				continue
			}
			switch state.ScopeType {
			case "org":
				if state.ScopeID == defaultOrgScopeID {
					copyState := state
					item.Org = &copyState
				}
			case "role":
				item.Roles = append(item.Roles, state)
			case "user":
				item.Users = append(item.Users, state)
			}
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Service) UpsertFeatureFlag(ctx context.Context, input UpsertFeatureFlagInput) (*FeatureFlagState, error) {
	if len(input.Config) == 0 {
		input.Config = json.RawMessage(`{}`)
	}
	if err := validateFeatureFlagInput(input); err != nil {
		return nil, err
	}
	return s.repo.UpsertFeatureFlag(ctx, input)
}

func (s *Service) GetEffectiveFeatureFlags(ctx context.Context, role string, userID uuid.UUID) (*EffectiveFeatureFlags, error) {
	states, err := s.repo.ListFeatureFlagStates(ctx)
	if err != nil {
		return nil, err
	}

	flags := map[string]bool{}
	for _, def := range FeatureFlagDefinitions {
		flags[def.Key] = resolveFlag(def.Key, states, role, userID)
	}

	if !flags[FlagAIMaster] {
		for key := range flags {
			flags[key] = false
		}
	}

	return &EffectiveFeatureFlags{Flags: flags}, nil
}

func resolveFlag(flagKey string, states []FeatureFlagState, role string, userID uuid.UUID) bool {
	value := false
	for _, state := range states {
		if state.FlagKey != flagKey || state.ScopeType != "org" || state.ScopeID != defaultOrgScopeID {
			continue
		}
		value = state.Enabled
	}
	for _, state := range states {
		if state.FlagKey == flagKey && state.ScopeType == "role" && state.ScopeID == role {
			value = state.Enabled
		}
	}
	for _, state := range states {
		if state.FlagKey == flagKey && state.ScopeType == "user" && state.ScopeID == userID.String() {
			value = state.Enabled
		}
	}
	return value
}
