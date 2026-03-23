package kpi

import (
	"net/http"
	"strconv"
	"time"

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
	kg := r.Group("/kpi")
	{
		kg.GET("/report", h.GetReport)
		kg.GET("/issues", h.GetIssuesReport)
		kg.GET("/cancellations", h.GetCancellationsReport)
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

// GET /v1/kpi/issues?from=&to=&limit=
func (h *Handler) GetIssuesReport(c *gin.Context) {
	from := c.DefaultQuery("from", time.Now().AddDate(0, 0, -7).Format("2006-01-02"))
	to := c.DefaultQuery("to", time.Now().Format("2006-01-02"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit > 200 {
		limit = 200
	}

	results, err := h.svc.GetIssuesReport(c.Request.Context(), from, to, limit)
	if err != nil {
		h.log.Error(c.Request.Context(), "issues_report_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, results)
}

// GET /v1/kpi/cancellations?from=&to=&limit=
func (h *Handler) GetCancellationsReport(c *gin.Context) {
	from := c.DefaultQuery("from", time.Now().AddDate(0, 0, -7).Format("2006-01-02"))
	to := c.DefaultQuery("to", time.Now().Format("2006-01-02"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit > 200 {
		limit = 200
	}

	results, err := h.svc.GetCancellationsReport(c.Request.Context(), from, to, limit)
	if err != nil {
		h.log.Error(c.Request.Context(), "cancellations_report_failed", err)
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
