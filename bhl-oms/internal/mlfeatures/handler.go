package mlfeatures

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
	log logger.Logger
}

func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// RegisterRoutes mounts /v1/ml/* endpoints (read-only — no role guard, all
// authenticated users may call). Feedback POST is open for now (Sprint 2 wires
// real ML feedback persistence).
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/ml")
	{
		// F2 NPP Health
		g.GET("/npp/:code/health", h.GetNppHealth)
		g.GET("/npp/health", h.ListNppHealth) // ?risk_band=RED&limit=50

		// F3 Smart SKU Suggestions
		g.GET("/orders/suggestions", h.GetSuggestions) // ?items=SKU1,SKU2&limit=5

		// F15 Explainability feedback (stub — logs only until Sprint 2)
		g.POST("/feedback", h.PostFeedback)
	}
}

// GET /v1/ml/npp/:code/health
func (h *Handler) GetNppHealth(c *gin.Context) {
	code := c.Param("code")
	out, err := h.svc.GetNppHealth(c.Request.Context(), code)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(c, "NPP không có trong bảng health scores")
			return
		}
		h.log.Error(c.Request.Context(), "get_npp_health_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, out)
}

// GET /v1/ml/npp/health?risk_band=RED&limit=50
func (h *Handler) ListNppHealth(c *gin.Context) {
	rb := c.DefaultQuery("risk_band", "RED")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	out, err := h.svc.ListByRiskBand(c.Request.Context(), rb, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, out)
}

// GET /v1/ml/orders/suggestions?items=SKU%20A,SKU%20B&limit=5
func (h *Handler) GetSuggestions(c *gin.Context) {
	raw := c.Query("items")
	if strings.TrimSpace(raw) == "" {
		response.BadRequest(c, "items query param required (comma-separated)")
		return
	}
	parts := strings.Split(raw, ",")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5"))

	out, err := h.svc.SuggestForBasket(c.Request.Context(), parts, limit)
	if err != nil {
		h.log.Error(c.Request.Context(), "get_suggestions_failed", err)
		response.InternalError(c)
		return
	}

	// Enrich each rule with `auto_bundle` flag for UI.
	type enriched struct {
		BasketRule
		AutoBundle bool `json:"auto_bundle"`
	}
	enrichedOut := make([]enriched, 0, len(out))
	for _, r := range out {
		enrichedOut = append(enrichedOut, enriched{BasketRule: r, AutoBundle: r.Confidence >= AutoBundleConfidence})
	}
	response.OK(c, enrichedOut)
}

// POST /v1/ml/feedback — F15 Explainability "Báo cáo gợi ý sai"
// Body: { feature_id, recommendation_id, reason }
// Sprint 1: log only. Sprint 2: persist to ml_features.recommendation_feedback.
func (h *Handler) PostFeedback(c *gin.Context) {
	var body map[string]any
	_ = c.ShouldBindJSON(&body)

	h.log.Info(c.Request.Context(), "ml_feedback_received",
		logger.F("feature_id", body["feature_id"]),
		logger.F("recommendation_id", body["recommendation_id"]),
		logger.F("reason", body["reason"]),
	)
	c.JSON(http.StatusAccepted, gin.H{"status": "accepted"})
}
