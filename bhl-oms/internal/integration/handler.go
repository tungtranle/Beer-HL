package integration

import (
	"net/http"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler provides HTTP endpoints for integration webhooks and admin
type Handler struct {
	bravo      *BravoAdapter
	dms        *DMSAdapter
	zalo       *ZaloAdapter
	confirmSvc *ConfirmService
}

func NewHandler(bravo *BravoAdapter, dms *DMSAdapter, zalo *ZaloAdapter, confirmSvc *ConfirmService) *Handler {
	return &Handler{bravo: bravo, dms: dms, zalo: zalo, confirmSvc: confirmSvc}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	ig := r.Group("/integration")
	{
		// Bravo webhook (Task 3.3) — receives events from Bravo ERP
		ig.POST("/bravo/webhook", h.BravoWebhook)

		// Manual triggers for testing
		ig.POST("/bravo/push-document", h.PushBravoDocument)
		ig.POST("/bravo/reconcile", h.TriggerBravoReconcile)
		ig.POST("/dms/sync", h.PushDMSOrderStatus)
		ig.POST("/zalo/send", h.SendZaloZNS)

		// NPP Confirmation endpoints (Task 3.6)
		ig.POST("/confirm/send", h.SendConfirmation)
		ig.POST("/confirm/auto-confirm", h.TriggerAutoConfirm)
	}
}

// RegisterPublicRoutes registers unauthenticated routes (NPP portal)
func (h *Handler) RegisterPublicRoutes(r *gin.RouterGroup) {
	// NPP portal — no auth required (accessed via Zalo link)
	r.GET("/confirm/:token", h.GetConfirmation)
	r.POST("/confirm/:token/confirm", h.ConfirmDelivery)
	r.POST("/confirm/:token/dispute", h.DisputeDelivery)
}

// POST /v1/integration/bravo/webhook (Task 3.3)
func (h *Handler) BravoWebhook(c *gin.Context) {
	var payload BravoWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "Invalid webhook payload")
		return
	}

	if err := h.bravo.HandleWebhook(payload); err != nil {
		response.Err(c, http.StatusInternalServerError, "BRAVO_WEBHOOK_ERROR", err.Error())
		return
	}

	response.OK(c, gin.H{"status": "processed", "event": payload.Event})
}

// POST /v1/integration/bravo/push-document (Task 3.1 manual trigger)
func (h *Handler) PushBravoDocument(c *gin.Context) {
	var doc DeliveryDocument
	if err := c.ShouldBindJSON(&doc); err != nil {
		response.BadRequest(c, "Invalid document payload")
		return
	}

	result, err := h.bravo.PushDeliveryDocument(c.Request.Context(), doc)
	if err != nil {
		// Return 202 for integration errors — don't block user (error-codes instruction)
		c.JSON(http.StatusAccepted, gin.H{
			"success": false,
			"error":   gin.H{"code": "BRAVO_PUSH_ERROR", "message": err.Error()},
			"data":    result,
		})
		return
	}

	response.OK(c, result)
}

// POST /v1/integration/bravo/reconcile (Task 3.2 manual trigger)
func (h *Handler) TriggerBravoReconcile(c *gin.Context) {
	var req struct {
		CustomerCodes []string `json:"customer_codes" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	discrepancies, err := h.bravo.NightlyReconcile(c.Request.Context(), req.CustomerCodes)
	if err != nil {
		c.JSON(http.StatusAccepted, gin.H{
			"success": false,
			"error":   gin.H{"code": "BRAVO_RECONCILE_ERROR", "message": err.Error()},
		})
		return
	}

	response.OK(c, gin.H{"discrepancies": discrepancies, "total": len(discrepancies)})
}

// POST /v1/integration/dms/sync (Task 3.4 manual trigger)
func (h *Handler) PushDMSOrderStatus(c *gin.Context) {
	var order DMSOrderSync
	if err := c.ShouldBindJSON(&order); err != nil {
		response.BadRequest(c, "Invalid DMS sync payload")
		return
	}

	result, err := h.dms.PushOrderStatus(c.Request.Context(), order)
	if err != nil {
		c.JSON(http.StatusAccepted, gin.H{
			"success": false,
			"error":   gin.H{"code": "DMS_SYNC_ERROR", "message": err.Error()},
		})
		return
	}

	response.OK(c, result)
}

// POST /v1/integration/zalo/send (Task 3.5 manual trigger)
func (h *Handler) SendZaloZNS(c *gin.Context) {
	var msg ZNSMessage
	if err := c.ShouldBindJSON(&msg); err != nil {
		response.BadRequest(c, "Invalid ZNS message")
		return
	}

	result, err := h.zalo.SendZNS(c.Request.Context(), msg)
	if err != nil {
		c.JSON(http.StatusAccepted, gin.H{
			"success": false,
			"error":   gin.H{"code": "ZALO_SEND_ERROR", "message": err.Error()},
		})
		return
	}

	response.OK(c, result)
}

// POST /v1/integration/confirm/send (Task 3.6 — send confirmation to NPP)
func (h *Handler) SendConfirmation(c *gin.Context) {
	var req struct {
		OrderID      string  `json:"order_id" binding:"required"`
		CustomerID   string  `json:"customer_id" binding:"required"`
		StopID       string  `json:"stop_id"`
		Phone        string  `json:"phone" binding:"required"`
		TotalAmount  float64 `json:"total_amount" binding:"required"`
		OrderNumber  string  `json:"order_number" binding:"required"`
		CustomerName string  `json:"customer_name" binding:"required"`
		BaseURL      string  `json:"base_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	orderID, err := uuid.Parse(req.OrderID)
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}
	customerID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		response.BadRequest(c, "Invalid customer ID")
		return
	}

	var stopID *uuid.UUID
	if req.StopID != "" {
		id, err := uuid.Parse(req.StopID)
		if err == nil {
			stopID = &id
		}
	}

	baseURL := req.BaseURL
	if baseURL == "" {
		baseURL = "https://" + c.Request.Host
	}

	confirm, err := h.confirmSvc.SendConfirmation(c.Request.Context(), orderID, customerID, stopID, req.Phone, req.TotalAmount, req.OrderNumber, req.CustomerName, baseURL)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "ZALO_CONFIRM_ERROR", err.Error())
		return
	}

	response.Created(c, confirm)
}

// GET /v1/confirm/:token (NPP portal — public)
func (h *Handler) GetConfirmation(c *gin.Context) {
	token := c.Param("token")
	confirm, err := h.confirmSvc.GetByToken(c.Request.Context(), token)
	if err != nil {
		response.NotFound(c, "Không tìm thấy xác nhận giao hàng")
		return
	}
	response.OK(c, confirm)
}

// POST /v1/confirm/:token/confirm (NPP portal — public)
func (h *Handler) ConfirmDelivery(c *gin.Context) {
	token := c.Param("token")
	if err := h.confirmSvc.ConfirmDelivery(c.Request.Context(), token); err != nil {
		response.Err(c, http.StatusBadRequest, "CONFIRM_ERROR", err.Error())
		return
	}
	response.OK(c, gin.H{"status": "confirmed"})
}

// POST /v1/confirm/:token/dispute (NPP portal — public)
func (h *Handler) DisputeDelivery(c *gin.Context) {
	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Vui lòng nhập lý do")
		return
	}

	token := c.Param("token")
	if err := h.confirmSvc.DisputeDelivery(c.Request.Context(), token, req.Reason); err != nil {
		response.Err(c, http.StatusBadRequest, "DISPUTE_ERROR", err.Error())
		return
	}
	response.OK(c, gin.H{"status": "disputed"})
}

// POST /v1/integration/confirm/auto-confirm (Task 3.7 manual trigger)
func (h *Handler) TriggerAutoConfirm(c *gin.Context) {
	count, err := h.confirmSvc.AutoConfirmExpired(c.Request.Context())
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "AUTO_CONFIRM_ERROR", err.Error())
		return
	}
	response.OK(c, gin.H{"auto_confirmed": count})
}
