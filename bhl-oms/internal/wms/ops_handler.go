package wms

// ops_handler.go — HTTP handlers for WMS Operations Center (Phase D).
// Routes: /warehouse/dashboard/kpis, /warehouse/exceptions, /warehouse/picker-stats

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"bhl-oms/pkg/response"
)

// RegisterOpsRoutes mounts Phase D operations endpoints.
func (h *Handler) RegisterOpsRoutes(wh *gin.RouterGroup) {
	wh.GET("/dashboard/kpis", h.GetWarehouseKPIs)
	wh.GET("/exceptions", h.GetExceptions)
	wh.POST("/exceptions/:id/resolve", h.ResolveException)
	wh.POST("/exceptions/:id/dismiss", h.DismissException)
	wh.GET("/picker-stats", h.GetPickerStats)
}

// GET /v1/warehouse/dashboard/kpis?warehouse_id=...
func (h *Handler) GetWarehouseKPIs(c *gin.Context) {
	whID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id required (UUID)")
		return
	}
	kpi, err := h.svc.repo.GetWarehouseKPIs(c.Request.Context(), whID)
	if err != nil {
		h.log.Error(c, "GetWarehouseKPIs failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, kpi)
}

// GET /v1/warehouse/exceptions?warehouse_id=...&status=open
func (h *Handler) GetExceptions(c *gin.Context) {
	whID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id required (UUID)")
		return
	}
	status := c.DefaultQuery("status", "")
	list, err := h.svc.repo.GetExceptions(c.Request.Context(), whID, status)
	if err != nil {
		h.log.Error(c, "GetExceptions failed", err)
		response.InternalError(c)
		return
	}
	if list == nil {
		list = []WMSException{}
	}
	response.OK(c, list)
}

// POST /v1/warehouse/exceptions/:id/resolve
// Body: { "note": "..." }
func (h *Handler) ResolveException(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid exception id")
		return
	}
	resolverID, ok := userIDFromCtx(c)
	if !ok {
		response.Unauthorized(c, "user required")
		return
	}
	var body struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&body)

	if err := h.svc.repo.ResolveException(c.Request.Context(), id, resolverID, body.Note); err != nil {
		h.log.Error(c, "ResolveException failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"status": "resolved"})
}

// POST /v1/warehouse/exceptions/:id/dismiss
func (h *Handler) DismissException(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid exception id")
		return
	}
	if err := h.svc.repo.DismissException(c.Request.Context(), id); err != nil {
		h.log.Error(c, "DismissException failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"status": "dismissed"})
}

// GET /v1/warehouse/picker-stats?warehouse_id=...
func (h *Handler) GetPickerStats(c *gin.Context) {
	whID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id required (UUID)")
		return
	}
	stats, err := h.svc.repo.GetPickerStats(c.Request.Context(), whID)
	if err != nil {
		h.log.Error(c, "GetPickerStats failed", err)
		response.InternalError(c)
		return
	}
	if stats == nil {
		stats = []PickerStat{}
	}
	response.OK(c, stats)
}
