package ai

import (
	"encoding/json"
	"strconv"
	"strings"

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
//	GET  /v1/ai/features                  — effective AI flags for current user
//	GET  /v1/admin/ai-flags               — admin flag management list
//	PUT  /v1/admin/ai-flags               — admin flag upsert
//	GET  /v1/ai/anomaly/:id/explain       — LLM explanation for a GPS anomaly
//	GET  /v1/ai/customers/:id/risk-score  — credit risk score for a customer
//	POST /v1/ai/npp-zalo-draft            — generate Zalo draft message for NPP
//	GET  /v1/ai/vehicle-score             — real-time anomaly score for a vehicle
//	GET  /v1/ai/seasonal-alert            — seasonal demand alert for OMS order form
//	GET  /v1/ai/demand-forecast           — 4-week NPP x SKU demand forecast
//	GET  /v1/ai/outreach-queue            — top NPPs DVKH should contact today
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/ai")
	{
		g.GET("/features", h.EffectiveFeatures)
		g.GET("/transparency", h.Transparency)
		g.POST("/privacy/route", h.RoutePrivacy)
		g.GET("/inbox", h.AIInbox)
		g.PATCH("/inbox/:id/action", h.AckInboxItem)
		g.POST("/chat", h.Chat)
		g.GET("/intents", h.MatchIntent)
		g.POST("/voice/parse", h.ParseVoiceCommand)
		g.POST("/simulations", h.CreateSimulation)
		g.GET("/simulations/:id", h.GetSimulation)
		g.POST("/simulations/:id/apply", h.ApplySimulation)
		g.GET("/trust-suggestions", middleware.RequireRole("admin", "management"), h.TrustSuggestions)
		g.GET("/dispatch-brief", middleware.RequireRole("admin", "dispatcher", "management"), h.DispatchBrief)
		g.GET("/anomaly/:id/explain", middleware.RequireRole("admin", "dispatcher", "management"), h.ExplainAnomaly)
		g.GET("/customers/:id/risk-score", middleware.RequireRole("admin", "accountant", "management", "dvkh"), h.CreditRiskScore)
		g.POST("/npp-zalo-draft", middleware.RequireRole("admin", "dvkh", "dispatcher"), h.NPPZaloDraft)
		g.GET("/vehicle-score", middleware.RequireRole("admin", "dispatcher", "management"), h.VehicleScore)
		g.GET("/seasonal-alert", middleware.RequireRole("admin", "dvkh", "dispatcher"), h.SeasonalAlert)
		g.GET("/demand-forecast", middleware.RequireRole("admin", "dvkh", "dispatcher", "management"), h.DemandForecast)
		g.GET("/outreach-queue", middleware.RequireRole("admin", "dvkh", "management"), h.OutreachQueue)
	}

	admin := r.Group("/admin")
	admin.Use(middleware.RequireRole("admin"))
	admin.GET("/ai-flags", h.ListFeatureFlags)
	admin.PUT("/ai-flags", h.UpsertFeatureFlag)
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func (h *Handler) Transparency(c *gin.Context) {
	snapshot, err := h.svc.GetTransparencySnapshot(c.Request.Context(), middleware.GetRole(c), middleware.GetUserID(c))
	if err != nil {
		response.Err(c, 500, "AI_TRANSPARENCY_FAILED", "Không tải được trạng thái AI")
		return
	}
	response.OK(c, snapshot)
}

func (h *Handler) RoutePrivacy(c *gin.Context) {
	var req struct {
		Input string `json:"input" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu input")
		return
	}
	response.OK(c, aiRoutePrivacyForResponse(req.Input))
}

func aiRoutePrivacyForResponse(input string) PrivacyDecision {
	decision := RoutePrivacy(input)
	decision.SanitizedInput = ""
	return decision
}

func (h *Handler) AIInbox(c *gin.Context) {
	items, err := h.svc.ListInbox(c.Request.Context(), middleware.GetRole(c), middleware.GetUserID(c))
	if err != nil {
		response.Err(c, 500, "AI_INBOX_FAILED", "Không tải được AI Inbox")
		return
	}
	response.OK(c, items)
}

func (h *Handler) MatchIntent(c *gin.Context) {
	query := c.Query("q")
	aiEnabled := h.svc.IsFeatureEnabled(c.Request.Context(), FlagIntent, middleware.GetRole(c), middleware.GetUserID(c))
	response.OK(c, MatchIntent(query, middleware.GetRole(c), aiEnabled))
}

func (h *Handler) ParseVoiceCommand(c *gin.Context) {
	var req struct {
		Transcript string `json:"transcript" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu transcript")
		return
	}
	if !h.svc.IsFeatureEnabled(c.Request.Context(), FlagVoice, middleware.GetRole(c), middleware.GetUserID(c)) {
		response.OK(c, VoiceCommandResult{Transcript: req.Transcript, Allowed: false, ConfirmRequired: true, AutoCancelSecond: 10, Reasons: []string{"ai.voice flag is off"}})
		return
	}
	response.OK(c, ParseVoiceCommand(req.Transcript, middleware.GetRole(c)))
}

func (h *Handler) CreateSimulation(c *gin.Context) {
	var req struct {
		Type    string          `json:"type" binding:"required"`
		Context json.RawMessage `json:"context"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu type")
		return
	}
	if !h.svc.IsFeatureEnabled(c.Request.Context(), FlagSimulation, middleware.GetRole(c), middleware.GetUserID(c)) {
		response.OK(c, gin.H{"status": "disabled", "message": "ai.simulation đang tắt; dispatcher dùng flow thủ công."})
		return
	}
	snapshot, err := h.svc.CreateSimulation(c.Request.Context(), req.Type, req.Context, middleware.GetUserID(c))
	if err != nil {
		response.Err(c, 400, "AI_SIMULATION_INVALID", err.Error())
		return
	}
	response.OK(c, snapshot)
}

func (h *Handler) GetSimulation(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, 400, "INVALID_ID", "simulation id không hợp lệ")
		return
	}
	snapshot, err := h.svc.GetSimulation(c.Request.Context(), id)
	if err != nil {
		response.Err(c, 404, "AI_SIMULATION_NOT_FOUND", "Không tìm thấy simulation")
		return
	}
	response.OK(c, snapshot)
}

func (h *Handler) ApplySimulation(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, 400, "INVALID_ID", "simulation id không hợp lệ")
		return
	}
	var req struct {
		OptionID string `json:"option_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu option_id")
		return
	}
	snapshot, err := h.svc.ApplySimulation(c.Request.Context(), id, req.OptionID, middleware.GetUserID(c))
	if err != nil {
		response.Err(c, 400, "AI_SIMULATION_APPLY_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"simulation": snapshot, "approval_required": true, "undo_ttl_seconds": 30, "core_tables_mutated": false})
}

func (h *Handler) TrustSuggestions(c *gin.Context) {
	suggestions, err := h.svc.ListTrustSuggestions(c.Request.Context())
	if err != nil {
		response.Err(c, 500, "AI_TRUST_FAILED", "Không tải được Trust Loop")
		return
	}
	response.OK(c, suggestions)
}

// DispatchBrief returns the AI-generated daily operational briefing.
// GET /v1/ai/dispatch-brief
func (h *Handler) DispatchBrief(c *gin.Context) {
	refresh := c.Query("refresh") == "1" || c.Query("refresh") == "true"
	var brief *DispatchBrief
	var err error
	if refresh {
		brief, err = h.svc.RefreshDispatchBrief(c.Request.Context())
	} else {
		brief, err = h.svc.GetDispatchBrief(c.Request.Context())
	}
	if err != nil {
		response.Err(c, 500, "AI_BRIEF_FAILED", "Không tạo được tóm tắt điều phối")
		return
	}
	response.OK(c, brief)
}

func (h *Handler) EffectiveFeatures(c *gin.Context) {
	flags, err := h.svc.GetEffectiveFeatureFlags(c.Request.Context(), middleware.GetRole(c), middleware.GetUserID(c))
	if err != nil {
		response.Err(c, 500, "AI_FLAGS_FAILED", "Không tải được trạng thái AI")
		return
	}
	response.OK(c, flags)
}

func (h *Handler) ListFeatureFlags(c *gin.Context) {
	flags, err := h.svc.ListFeatureFlags(c.Request.Context())
	if err != nil {
		response.Err(c, 500, "AI_FLAGS_FAILED", "Không tải được danh sách AI flags")
		return
	}
	response.OK(c, flags)
}

func (h *Handler) UpsertFeatureFlag(c *gin.Context) {
	var req struct {
		FlagKey   string          `json:"flag_key" binding:"required"`
		ScopeType string          `json:"scope_type" binding:"required"`
		ScopeID   string          `json:"scope_id" binding:"required"`
		Enabled   bool            `json:"enabled"`
		Config    json.RawMessage `json:"config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu flag_key, scope_type hoặc scope_id")
		return
	}

	state, err := h.svc.UpsertFeatureFlag(c.Request.Context(), UpsertFeatureFlagInput{
		FlagKey:   req.FlagKey,
		ScopeType: req.ScopeType,
		ScopeID:   req.ScopeID,
		Enabled:   req.Enabled,
		Config:    req.Config,
		UpdatedBy: middleware.GetUserID(c),
	})
	if err != nil {
		response.Err(c, 400, "AI_FLAG_INVALID", err.Error())
		return
	}
	response.OK(c, state)
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
	if !h.svc.IsFeatureEnabled(c.Request.Context(), FlagCreditScore, middleware.GetRole(c), middleware.GetUserID(c)) {
		response.OK(c, nil)
		return
	}

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

// AckInboxItem marks an AI inbox item as done or dismissed.
// PATCH /v1/ai/inbox/:id/action  body: {"status":"done"|"dismissed"}
func (h *Handler) AckInboxItem(c *gin.Context) {
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.Status != "done" && req.Status != "dismissed") {
		response.BadRequest(c, "status phải là 'done' hoặc 'dismissed'")
		return
	}
	idParam := c.Param("id")
	if strings.HasPrefix(idParam, "rules-") {
		response.OK(c, map[string]any{"id": idParam, "status": req.Status, "synthetic": true})
		return
	}
	id, err := uuid.Parse(idParam)
	if err != nil {
		response.Err(c, 400, "INVALID_ID", "ID không hợp lệ")
		return
	}
	if err := h.svc.AckInboxItem(c.Request.Context(), id, req.Status, middleware.GetUserID(c)); err != nil {
		response.Err(c, 500, "ACK_FAILED", "Không cập nhật được item")
		return
	}
	response.OK(c, map[string]string{"id": id.String(), "status": req.Status})
}

// Chat handles a free-text chat message from the user.
// POST /v1/ai/chat  body: {"message":"..."}
func (h *Handler) Chat(c *gin.Context) {
	var req struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu message")
		return
	}
	reply, intents, err := h.svc.ChatWithAI(c.Request.Context(), req.Message, middleware.GetRole(c), middleware.GetUserID(c))
	if err != nil {
		response.Err(c, 500, "CHAT_FAILED", "AI chat không khả dụng")
		return
	}
	response.OK(c, map[string]any{"reply": reply, "intents": intents})
}
