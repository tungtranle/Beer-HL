package integration

import (
	"net/http"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP endpoints for integration webhooks and admin
type Handler struct {
	bravo *BravoAdapter
	dms   *DMSAdapter
	zalo  *ZaloAdapter
}

func NewHandler(bravo *BravoAdapter, dms *DMSAdapter, zalo *ZaloAdapter) *Handler {
	return &Handler{bravo: bravo, dms: dms, zalo: zalo}
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
	}
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
