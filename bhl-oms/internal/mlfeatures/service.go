package mlfeatures

import (
	"context"
	"errors"
	"strings"

	"bhl-oms/pkg/logger"
)

// Service applies business rules on top of Repository.
//
// F2 NPP Health: passthrough + null-safe defaults.
// F3 Smart Suggestions: enforces threshold from DATA_DICTIONARY (confidence ≥ 0.60, lift ≥ 1.20).
type Service struct {
	repo *Repository
	log  logger.Logger
}

func NewService(repo *Repository, log logger.Logger) *Service {
	return &Service{repo: repo, log: log}
}

const (
	// MinConfidence per docs/specs/DATA_DICTIONARY.md §7
	MinConfidence = 0.60
	MinLift       = 1.20
	// AutoBundleConfidence: rules at/above this are flagged as "Bundle" in UI.
	AutoBundleConfidence = 0.985
)

// GetNppHealth = F2 read by code.
func (s *Service) GetNppHealth(ctx context.Context, nppCode string) (*NppHealth, error) {
	code := strings.TrimSpace(nppCode)
	if code == "" {
		return nil, errors.New("npp_code required")
	}
	return s.repo.GetNppHealth(ctx, code)
}

// ListByRiskBand = F2 dashboard widget data.
func (s *Service) ListByRiskBand(ctx context.Context, riskBand string, limit int) ([]NppHealth, error) {
	rb := strings.ToUpper(strings.TrimSpace(riskBand))
	switch rb {
	case "GREEN", "YELLOW", "RED":
	default:
		return nil, errors.New("risk_band must be GREEN, YELLOW or RED")
	}
	return s.repo.ListNppHealthByRiskBand(ctx, rb, limit)
}

// SuggestForBasket = F3 Smart Suggestions for current order items.
//   - input items: SKU canonical names (matches basket_rules.antecedent)
//   - returns rules sorted by confidence desc
//   - dedup consequent (some SKU may appear from multiple antecedents)
func (s *Service) SuggestForBasket(ctx context.Context, items []string, limit int) ([]BasketRule, error) {
	clean := make([]string, 0, len(items))
	seen := make(map[string]bool, len(items))
	for _, it := range items {
		v := strings.TrimSpace(it)
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		clean = append(clean, v)
	}
	if len(clean) == 0 {
		return []BasketRule{}, nil
	}

	// Repo filters thresholds; we ask for more so we can dedup.
	raw, err := s.repo.SuggestForItems(ctx, clean, MinConfidence, MinLift, 50)
	if err != nil {
		return nil, err
	}

	// Dedup by consequent — keep first (highest confidence due to repo ORDER BY).
	deduped := make([]BasketRule, 0, len(raw))
	seenC := make(map[string]bool, len(raw))
	for _, r := range raw {
		if seenC[r.Consequent] {
			continue
		}
		seenC[r.Consequent] = true
		deduped = append(deduped, r)
	}

	if limit <= 0 || limit > len(deduped) {
		limit = len(deduped)
	}
	return deduped[:limit], nil
}
