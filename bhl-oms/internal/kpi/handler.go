package kpi

import (
	"net/http"
	"strconv"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	kg := r.Group("/kpi")
	{
		kg.GET("/report", h.GetReport)
		kg.POST("/snapshot", h.GenerateSnapshot)
	}
}

// GET /v1/kpi/report?warehouse_id=&from=&to=&limit=
func (h *Handler) GetReport(c *gin.Context) {
	var warehouseID *uuid.UUID
	if w := c.Query("warehouse_id"); w != "" {
		if id, err := uuid.Parse(w); err == nil {
			warehouseID = &id
		}
	}
	from := c.Query("from")
	to := c.Query("to")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))

	results, err := h.svc.GetKPIReport(c.Request.Context(), warehouseID, from, to, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, results)
}

// POST /v1/kpi/snapshot — Manual trigger for KPI snapshot generation
func (h *Handler) GenerateSnapshot(c *gin.Context) {
	var req struct {
		WarehouseID string `json:"warehouse_id" binding:"required"`
		Date        string `json:"date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "warehouse_id và date bắt buộc")
		return
	}

	warehouseID, err := uuid.Parse(req.WarehouseID)
	if err != nil {
		response.BadRequest(c, "Invalid warehouse_id")
		return
	}

	snap, err := h.svc.GenerateSnapshot(c.Request.Context(), warehouseID, req.Date)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "KPI_SNAPSHOT_FAILED", err.Error())
		return
	}
	response.OK(c, snap)
}
