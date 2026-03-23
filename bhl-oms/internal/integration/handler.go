package integration

import (
	"context"
	"fmt"
	"net/http"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// OrderConfirmCallback allows the integration handler to call back into OMS
// for order status transitions without circular imports.
type OrderConfirmCallback interface {
	ConfirmOrderByCustomer(ctx context.Context, orderID uuid.UUID) error
	CancelOrderByCustomer(ctx context.Context, orderID uuid.UUID, reason string) error
}

// NotificationSender allows sending notifications without importing notification package.
type NotificationSender interface {
	SendToRole(ctx context.Context, role, title, body, category string, link *string) error
}

// Handler provides HTTP endpoints for integration webhooks and admin
type Handler struct {
	bravo        *BravoAdapter
	dms          *DMSAdapter
	zalo         *ZaloAdapter
	confirmSvc   *ConfirmService
	dlq          *DLQService
	orderConfirm OrderConfirmCallback
	notifSvc     NotificationSender
}

func NewHandler(bravo *BravoAdapter, dms *DMSAdapter, zalo *ZaloAdapter, confirmSvc *ConfirmService, dlq *DLQService) *Handler {
	return &Handler{bravo: bravo, dms: dms, zalo: zalo, confirmSvc: confirmSvc, dlq: dlq}
}

// SetOrderConfirmCallback injects OMS service for order confirm/reject flows.
func (h *Handler) SetOrderConfirmCallback(cb OrderConfirmCallback) {
	h.orderConfirm = cb
}

// SetNotificationSender injects notification service.
func (h *Handler) SetNotificationSender(ns NotificationSender) {
	h.notifSvc = ns
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

		// DLQ Admin (Task 3.8)
		ig.GET("/dlq", h.ListDLQ)
		ig.GET("/dlq/stats", h.DLQStats)
		ig.POST("/dlq/:id/retry", h.RetryDLQ)
		ig.POST("/dlq/:id/resolve", h.ResolveDLQ)
	}
}

// RegisterPublicRoutes registers unauthenticated routes (NPP portal)
func (h *Handler) RegisterPublicRoutes(r *gin.RouterGroup) {
	// NPP portal — no auth required (accessed via Zalo link)
	r.GET("/confirm/:token", h.GetConfirmation)
	r.POST("/confirm/:token/confirm", h.ConfirmDelivery)
	r.POST("/confirm/:token/dispute", h.DisputeDelivery)

	// Order confirmation — customer portal (accessed via Zalo link, 2h timeout)
	r.GET("/order-confirm/:token", h.GetOrderConfirmation)
	r.GET("/order-confirm/:token/pdf", h.GetOrderPDF)
	r.POST("/order-confirm/:token/confirm", h.ConfirmOrderByCustomer)
	r.POST("/order-confirm/:token/reject", h.RejectOrderByCustomer)
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

	// Notify DVKH (fire-and-forget)
	if h.notifSvc != nil {
		go func() {
			orderNum, custName, err := h.confirmSvc.GetDeliveryOrderInfo(context.Background(), token)
			if err == nil {
				title := "KH xác nhận giao hàng"
				body := fmt.Sprintf("Khách hàng %s đã XÁC NHẬN giao hàng đơn %s", custName, orderNum)
				link := "/orders"
				_ = h.notifSvc.SendToRole(context.Background(), "dvkh", title, body, "success", &link)
			}
		}()
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

	// Notify DVKH (fire-and-forget)
	if h.notifSvc != nil {
		go func() {
			orderNum, custName, err := h.confirmSvc.GetDeliveryOrderInfo(context.Background(), token)
			if err == nil {
				title := "KH tranh chấp giao hàng"
				body := fmt.Sprintf("Khách hàng %s TRANH CHẤP giao hàng đơn %s. Lý do: %s", custName, orderNum, req.Reason)
				link := "/orders"
				_ = h.notifSvc.SendToRole(context.Background(), "dvkh", title, body, "error", &link)
			}
		}()
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

// ===== DLQ Admin Endpoints (Task 3.8) =====

// GET /v1/integration/dlq
func (h *Handler) ListDLQ(c *gin.Context) {
	status := c.Query("status")
	adapter := c.Query("adapter")
	page := 1
	limit := 20
	if p := c.Query("page"); p != "" {
		if v, err := parseInt(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := parseInt(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}

	entries, total, err := h.dlq.List(c.Request.Context(), status, adapter, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OKWithMeta(c, entries, response.PaginationMeta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: int((total + int64(limit) - 1) / int64(limit)),
	})
}

// GET /v1/integration/dlq/stats
func (h *Handler) DLQStats(c *gin.Context) {
	stats, err := h.dlq.Stats(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, stats)
}

// POST /v1/integration/dlq/:id/retry
func (h *Handler) RetryDLQ(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid DLQ entry ID")
		return
	}
	if err := h.dlq.Retry(c.Request.Context(), id); err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"status": "retrying"})
}

// POST /v1/integration/dlq/:id/resolve
func (h *Handler) ResolveDLQ(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid DLQ entry ID")
		return
	}
	if err := h.dlq.Resolve(c.Request.Context(), id); err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"status": "resolved"})
}

// ===== Order Confirmation Public Endpoints (customer Zalo link, 2h timeout) =====

// GET /v1/order-confirm/:token
func (h *Handler) GetOrderConfirmation(c *gin.Context) {
	token := c.Param("token")
	confirm, err := h.confirmSvc.GetOrderConfirmByToken(c.Request.Context(), token)
	if err != nil {
		response.NotFound(c, "Không tìm thấy đơn hàng")
		return
	}
	response.OK(c, confirm)
}

// GET /v1/order-confirm/:token/pdf
func (h *Handler) GetOrderPDF(c *gin.Context) {
	token := c.Param("token")
	confirm, err := h.confirmSvc.GetOrderConfirmByToken(c.Request.Context(), token)
	if err != nil {
		response.NotFound(c, "Không tìm thấy đơn hàng")
		return
	}
	// Redirect to PDF URL
	if confirm.PDFURL != nil && *confirm.PDFURL != "" {
		c.Redirect(http.StatusFound, *confirm.PDFURL)
		return
	}
	response.NotFound(c, "Chưa có file PDF cho đơn hàng này")
}

// POST /v1/order-confirm/:token/confirm
func (h *Handler) ConfirmOrderByCustomer(c *gin.Context) {
	token := c.Param("token")

	// 1. Mark order_confirmations as confirmed
	if err := h.confirmSvc.ConfirmOrder(c.Request.Context(), token); err != nil {
		response.Err(c, http.StatusBadRequest, "CONFIRM_ERROR", err.Error())
		return
	}

	// 2. Get the confirmation to find order_id
	confirm, err := h.confirmSvc.GetOrderConfirmByToken(c.Request.Context(), token)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "CONFIRM_ERROR", err.Error())
		return
	}

	// 3. Transition order pending_customer_confirm → confirmed, create shipment + debit
	if h.orderConfirm != nil {
		if err := h.orderConfirm.ConfirmOrderByCustomer(c.Request.Context(), confirm.OrderID); err != nil {
			response.Err(c, http.StatusInternalServerError, "ORDER_CONFIRM_ERROR", err.Error())
			return
		}
	}

	// 4. Notify DVKH (fire-and-forget)
	if h.notifSvc != nil {
		go func() {
			title := "KH xác nhận đơn hàng"
			body := fmt.Sprintf("Khách hàng %s đã XÁC NHẬN đơn hàng %s", confirm.CustomerName, confirm.OrderNumber)
			link := "/orders"
			_ = h.notifSvc.SendToRole(context.Background(), "dvkh", title, body, "success", &link)
		}()
	}

	response.OK(c, gin.H{"status": "confirmed", "message": "Đơn hàng đã được xác nhận thành công"})
}

// POST /v1/order-confirm/:token/reject
func (h *Handler) RejectOrderByCustomer(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	token := c.Param("token")

	// 1. Mark order_confirmations as rejected
	reason := req.Reason
	if reason == "" {
		reason = "Khách hàng từ chối đơn hàng"
	}
	if err := h.confirmSvc.RejectOrder(c.Request.Context(), token, reason); err != nil {
		response.Err(c, http.StatusBadRequest, "REJECT_ERROR", err.Error())
		return
	}

	// 2. Get the confirmation to find order_id
	confirm, err := h.confirmSvc.GetOrderConfirmByToken(c.Request.Context(), token)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "REJECT_ERROR", err.Error())
		return
	}

	// 3. Cancel order + release stock
	if h.orderConfirm != nil {
		if err := h.orderConfirm.CancelOrderByCustomer(c.Request.Context(), confirm.OrderID, reason); err != nil {
			response.Err(c, http.StatusInternalServerError, "ORDER_CANCEL_ERROR", err.Error())
			return
		}
	}

	// 4. Notify DVKH (fire-and-forget)
	if h.notifSvc != nil {
		go func() {
			title := "KH từ chối đơn hàng"
			body := fmt.Sprintf("Khách hàng %s đã TỪ CHỐI đơn hàng %s. Lý do: %s", confirm.CustomerName, confirm.OrderNumber, reason)
			link := "/orders"
			_ = h.notifSvc.SendToRole(context.Background(), "dvkh", title, body, "warning", &link)
		}()
	}

	response.OK(c, gin.H{"status": "rejected", "message": "Đơn hàng đã bị từ chối"})
}

func parseInt(s string) (int, error) {
	v := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, fmt.Errorf("invalid number")
		}
		v = v*10 + int(c-'0')
	}
	return v, nil
}
