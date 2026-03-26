package reconciliation

import (
	"net/http"
	"strconv"

	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
	log logger.Logger
}

func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	rg := r.Group("/reconciliation")
	{
		// Auto-reconcile a specific trip (Task 3.9)
		rg.POST("/trips/:tripId/reconcile", h.ReconcileTrip)
		rg.GET("/trips/:tripId", h.GetTripReconciliation)

		// List reconciliations
		rg.GET("", h.ListReconciliations)
		rg.POST("/:id/resolve", h.ResolveReconciliation)

		// Discrepancies (Task 3.10)
		rg.GET("/discrepancies", h.ListDiscrepancies)
		rg.POST("/discrepancies/:id/resolve", h.ResolveDiscrepancy)
		rg.GET("/discrepancies/:id/history", h.GetDiscrepancyHistory)

		// Daily close (Task 3.11)
		rg.POST("/daily-close", h.GenerateDailyClose)
		rg.GET("/daily-close", h.ListDailyClose)
		rg.GET("/daily-close/:date", h.GetDailyClose)

		// Excel export
		rg.GET("/export", h.ExportReconciliations)
	}
}

// POST /v1/reconciliation/trips/:tripId/reconcile
func (h *Handler) ReconcileTrip(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("tripId"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}

	results, err := h.svc.AutoReconcileTrip(c.Request.Context(), tripID)
	if err != nil {
		response.Err(c, http.StatusUnprocessableEntity, "RECONCILIATION_TRIP_NOT_SETTLED", err.Error())
		return
	}
	response.OK(c, results)
}

// GET /v1/reconciliation/trips/:tripId
func (h *Handler) GetTripReconciliation(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("tripId"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}

	results, err := h.svc.GetReconciliationsByTrip(c.Request.Context(), tripID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, results)
}

// GET /v1/reconciliation
func (h *Handler) ListReconciliations(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	results, total, err := h.svc.ListReconciliations(c.Request.Context(), status, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OKWithMeta(c, results, response.PaginationMeta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int((total + int64(limit) - 1) / int64(limit)),
	})
}

// POST /v1/reconciliation/:id/resolve
func (h *Handler) ResolveReconciliation(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid reconciliation ID")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	if err := h.svc.ResolveReconciliation(c.Request.Context(), id, uid); err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"status": "resolved"})
}

// GET /v1/reconciliation/discrepancies
func (h *Handler) ListDiscrepancies(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	var tripID *uuid.UUID
	if t := c.Query("trip_id"); t != "" {
		if id, err := uuid.Parse(t); err == nil {
			tripID = &id
		}
	}

	results, total, err := h.svc.ListDiscrepancies(c.Request.Context(), tripID, status, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OKWithMeta(c, results, response.PaginationMeta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int((total + int64(limit) - 1) / int64(limit)),
	})
}

// POST /v1/reconciliation/discrepancies/:id/resolve
func (h *Handler) ResolveDiscrepancy(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid discrepancy ID")
		return
	}

	var req struct {
		Resolution string `json:"resolution" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Vui lòng nhập nội dung xử lý")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	// Action-level RBAC: check is_chief_accountant or admin role (Task 6.16)
	role, _ := c.Get("role")
	userRole, _ := role.(string)
	if userRole != "admin" {
		isChief, checkErr := h.svc.IsChiefAccountant(c.Request.Context(), uid)
		if checkErr != nil || !isChief {
			response.Err(c, http.StatusForbidden, "FORBIDDEN", "Chỉ Kế toán trưởng hoặc Admin mới được xử lý sai lệch")
			return
		}
	}

	if err := h.svc.ResolveDiscrepancy(c.Request.Context(), id, uid, req.Resolution); err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"status": "resolved"})
}

// POST /v1/reconciliation/daily-close
func (h *Handler) GenerateDailyClose(c *gin.Context) {
	var req struct {
		WarehouseID string `json:"warehouse_id" binding:"required"`
		Date        string `json:"date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Vui lòng nhập warehouse_id và date")
		return
	}

	warehouseID, err := uuid.Parse(req.WarehouseID)
	if err != nil {
		response.BadRequest(c, "Invalid warehouse ID")
		return
	}

	summary, err := h.svc.GenerateDailyClose(c.Request.Context(), warehouseID, req.Date)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	response.OK(c, summary)
}

// GET /v1/reconciliation/daily-close
func (h *Handler) ListDailyClose(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))

	var warehouseID *uuid.UUID
	if w := c.Query("warehouse_id"); w != "" {
		if id, err := uuid.Parse(w); err == nil {
			warehouseID = &id
		}
	}

	results, err := h.svc.ListDailyCloseSummaries(c.Request.Context(), warehouseID, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, results)
}

// GET /v1/reconciliation/daily-close/:date
func (h *Handler) GetDailyClose(c *gin.Context) {
	date := c.Param("date")
	warehouseID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id is required")
		return
	}

	summary, err := h.svc.GetDailyCloseSummary(c.Request.Context(), date, warehouseID)
	if err != nil {
		response.NotFound(c, "Không tìm thấy bản tổng kết ngày")
		return
	}
	response.OK(c, summary)
}

// GET /v1/reconciliation/discrepancies/:id/history (Task 6.3)
func (h *Handler) GetDiscrepancyHistory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid discrepancy ID")
		return
	}

	events, err := h.svc.GetDiscrepancyHistory(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, events)
}
