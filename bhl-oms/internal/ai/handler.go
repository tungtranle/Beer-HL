package ai

import (
	"strconv"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── Handler ──────────────────────────────────────────────────────────────────

type Handler struct {
	svc *Service
	log logger.Logger
}

func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// RegisterRoutes mounts AI endpoints under the protected router group.
//
//	GET  /v1/ai/dispatch-brief            — daily briefing for dispatcher/admin
//	GET  /v1/ai/anomaly/:id/explain       — LLM explanation for a GPS anomaly
//	GET  /v1/ai/customers/:id/risk-score  — credit risk score for a customer
//	POST /v1/ai/npp-zalo-draft            — generate Zalo draft message for NPP
//	GET  /v1/ai/vehicle-score             — real-time anomaly score for a vehicle
//	GET  /v1/ai/seasonal-alert            — seasonal demand alert for OMS order form
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/ai")
	{
		g.GET("/dispatch-brief", middleware.RequireRole("admin", "dispatcher", "management"), h.DispatchBrief)
		g.GET("/anomaly/:id/explain", middleware.RequireRole("admin", "dispatcher", "management"), h.ExplainAnomaly)
		g.GET("/customers/:id/risk-score", middleware.RequireRole("admin", "accountant", "management"), h.CreditRiskScore)
		g.POST("/npp-zalo-draft", middleware.RequireRole("admin", "dvkh", "dispatcher"), h.NPPZaloDraft)
		g.GET("/vehicle-score", middleware.RequireRole("admin", "dispatcher", "management"), h.VehicleScore)
		g.GET("/seasonal-alert", middleware.RequireRole("admin", "dvkh", "dispatcher"), h.SeasonalAlert)
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// DispatchBrief returns the AI-generated daily operational briefing.
// GET /v1/ai/dispatch-brief
func (h *Handler) DispatchBrief(c *gin.Context) {
	brief, err := h.svc.GetDispatchBrief(c.Request.Context())
	if err != nil {
		response.Err(c, 500, "AI_BRIEF_FAILED", "Không tạo được tóm tắt điều phối")
		return
	}
	response.OK(c, brief)
}

// ExplainAnomaly generates a human-readable explanation for a GPS anomaly.
// GET /v1/ai/anomaly/:id/explain
func (h *Handler) ExplainAnomaly(c *gin.Context) {
	idStr := c.Param("id")
	anomalyID, err := uuid.Parse(idStr)
	if err != nil {
		response.Err(c, 400, "INVALID_ID", "ID không hợp lệ")
		return
	}

	expl, err := h.svc.ExplainAnomaly(c.Request.Context(), anomalyID)
	if err != nil {
		h.log.Warn(c.Request.Context(), "ai.explain_anomaly_failed", logger.F("id", idStr), logger.F("err", err.Error()))
		response.Err(c, 500, "AI_EXPLAIN_FAILED", "Không tạo được giải thích")
		return
	}
	response.OK(c, expl)
}

// CreditRiskScore returns the credit risk score for a customer.
// GET /v1/ai/customers/:id/risk-score
func (h *Handler) CreditRiskScore(c *gin.Context) {
	idStr := c.Param("id")
	customerID, err := uuid.Parse(idStr)
	if err != nil {
		response.Err(c, 400, "INVALID_ID", "ID không hợp lệ")
		return
	}

	score, err := h.svc.GetCreditRiskScore(c.Request.Context(), customerID)
	if err != nil {
		h.log.Warn(c.Request.Context(), "ai.credit_risk_failed", logger.F("id", idStr), logger.F("err", err.Error()))
		response.Err(c, 500, "AI_RISK_FAILED", "Không tính được điểm rủi ro")
		return
	}
	response.OK(c, score)
}

// NPPZaloDraft generates a Zalo draft message for DVKH to review.
// POST /v1/ai/npp-zalo-draft  body: {"customer_id": "uuid"}
func (h *Handler) NPPZaloDraft(c *gin.Context) {
	var req struct {
		CustomerID string `json:"customer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, 400, "INVALID_REQUEST", "Thiếu customer_id")
		return
	}

	customerID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		response.Err(c, 400, "INVALID_ID", "customer_id không hợp lệ")
		return
	}

	draft, err := h.svc.GenerateNPPZaloDraft(c.Request.Context(), customerID)
	if err != nil {
		h.log.Warn(c.Request.Context(), "ai.zalo_draft_failed", logger.F("customer", req.CustomerID), logger.F("err", err.Error()))
		response.Err(c, 500, "AI_DRAFT_FAILED", "Không tạo được bản nháp Zalo")
		return
	}
	response.OK(c, draft)
}

// VehicleScore computes a real-time anomaly score from GPS signals.
// GET /v1/ai/vehicle-score?plate=&speed=&stop_min=&deviation_km=
func (h *Handler) VehicleScore(c *gin.Context) {
	plate := c.Query("plate")
	if plate == "" {
		response.Err(c, 400, "MISSING_PLATE", "Thiếu plate")
		return
	}

	speed := parseFloat(c.Query("speed"))
	stopMin := parseFloat(c.Query("stop_min"))
	deviationKm := parseFloat(c.Query("deviation_km"))

	score := h.svc.ComputeAnomalyScore(plate, speed, stopMin, deviationKm)
	response.OK(c, score)
}

// SeasonalAlert checks if an order quantity is below seasonal expectation.
// GET /v1/ai/seasonal-alert?sku=&warehouse=&qty=&avg_qty=
func (h *Handler) SeasonalAlert(c *gin.Context) {
	sku := c.Query("sku")
	warehouse := c.Query("warehouse")
	qty := parseFloat(c.Query("qty"))
	avgQty := parseFloat(c.Query("avg_qty"))

	if sku == "" || warehouse == "" {
		response.Err(c, 400, "MISSING_PARAMS", "Thiếu sku hoặc warehouse")
		return
	}

	alert, err := h.svc.CheckOrderSeasonalAlert(c.Request.Context(), sku, warehouse, qty, avgQty)
	if err != nil {
		response.Err(c, 500, "AI_SEASONAL_FAILED", "Không kiểm tra được chỉ số mùa vụ")
		return
	}
	response.OK(c, alert)
}

func parseFloat(s string) float64 {
	if s == "" {
		return 0
	}
	v, _ := strconv.ParseFloat(s, 64)
	return v
}
