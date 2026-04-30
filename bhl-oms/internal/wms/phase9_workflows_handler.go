package wms

// WMS Phase 9 — HTTP handlers for inbound, putaway, picking-by-pallet,
// loading scan-to-truck, cycle count, dashboard, traceability.

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"bhl-oms/pkg/response"
)

// RegisterPhase9WorkflowRoutes mounts Sprint 2-5 endpoints onto /warehouse group.
func (h *Handler) RegisterPhase9WorkflowRoutes(wh *gin.RouterGroup) {
	// 9.5 Inbound
	wh.POST("/inbound/receive", h.ReceivePallet)

	// 9.6 Putaway
	wh.POST("/inbound/suggest-bin", h.SuggestBins)
	wh.GET("/inbound/suggest-bin-preview", h.SuggestBinsPreview)
	wh.POST("/inbound/putaway", h.ConfirmPutaway)

	// 9.8 Picking-by-pallet
	wh.GET("/picking/:id/suggest-pallets", h.SuggestPickingPallets)
	wh.POST("/picking/scan-pick", h.ScanPick)

	// 9.9 Loading scan-to-truck
	wh.POST("/loading/start", h.StartLoading)
	wh.POST("/loading/scan", h.ScanLoad)
	wh.POST("/loading/complete", h.CompleteLoading)

	// 9.11 Cycle count
	wh.POST("/cycle-count/generate", h.GenerateCycleCount)
	wh.GET("/cycle-count/tasks", h.ListCycleCountTasks)
	wh.POST("/cycle-count/submit", h.SubmitCycleCount)

	// 9.12 Realtime dashboard
	wh.GET("/dashboard/alerts", h.GetDashboardAlerts)

	// 9.14 Traceability
	wh.GET("/lots/:id/distribution", h.GetLotDistribution)
}

// ── 9.5 Inbound ─────────────────────────────────────

func (h *Handler) ReceivePallet(c *gin.Context) {
	var req ReceivePalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	uid, ok := userIDFromCtx(c)
	if !ok {
		response.Unauthorized(c, "user required")
		return
	}
	res, err := h.svc.ReceivePallet(c, req, uid)
	if err != nil {
		if isUniqueViolation(err) {
			response.Err(c, http.StatusConflict, "PALLET_DUPLICATE", "LPN đã tồn tại")
			return
		}
		h.log.Error(c, "receive pallet failed", err)
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, res)
}

// ── 9.6 Putaway ─────────────────────────────────────

func (h *Handler) SuggestBins(c *gin.Context) {
	var req SuggestBinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	suggestions, err := h.svc.SuggestBins(c, req)
	if err != nil {
		h.log.Error(c, "suggest bins failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, suggestions)
}

// SuggestBinsPreview — gợi ý bin trước khi tạo lot (UX inbound: thủ kho thấy ngay
// "Cất vào A-03-02" khi chọn sản phẩm). Khác SuggestBins ở chỗ không cần lot_id.
// Query: warehouse_id, product_id, qty.
func (h *Handler) SuggestBinsPreview(c *gin.Context) {
	whID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id required")
		return
	}
	prodID, err := uuid.Parse(c.Query("product_id"))
	if err != nil {
		response.BadRequest(c, "product_id required")
		return
	}
	suggestions, err := h.svc.SuggestBinsPreview(c, whID, prodID)
	if err != nil {
		h.log.Error(c, "suggest bins preview failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, suggestions)
}

func (h *Handler) ConfirmPutaway(c *gin.Context) {
	var req PutawayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	uid, ok := userIDFromCtx(c)
	if !ok {
		response.Unauthorized(c, "user required")
		return
	}
	pal, err := h.svc.ConfirmPutaway(c, req, uid)
	if err != nil {
		switch {
		case errors.Is(err, ErrPalletNotFound), errors.Is(err, ErrBinNotFound):
			response.NotFound(c, err.Error())
		case errors.Is(err, ErrBinFull), errors.Is(err, ErrPalletNotInStock):
			response.BadRequest(c, err.Error())
		default:
			h.log.Error(c, "putaway failed", err)
			response.BadRequest(c, err.Error())
		}
		return
	}
	response.OK(c, pal)
}

// ── 9.8 Picking-by-pallet ───────────────────────────

func (h *Handler) SuggestPickingPallets(c *gin.Context) {
	pickID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid picking_order_id")
		return
	}
	productIDStr := c.Query("product_id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		response.BadRequest(c, "product_id required")
		return
	}
	qty, _ := strconv.Atoi(c.DefaultQuery("qty", "0"))
	if qty <= 0 {
		response.BadRequest(c, "qty > 0 required")
		return
	}
	// Resolve warehouse from picking order
	po, err := h.svc.GetPickingOrderByID(c, pickID)
	if err != nil {
		response.NotFound(c, "picking order not found")
		return
	}
	res, err := h.svc.SuggestPickingPallets(c, po.WarehouseID, productID, qty)
	if err != nil {
		h.log.Error(c, "suggest picking pallets failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, res)
}

func (h *Handler) ScanPick(c *gin.Context) {
	var req ScanPickRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	uid, ok := userIDFromCtx(c)
	if !ok {
		response.Unauthorized(c, "user required")
		return
	}
	pal, err := h.svc.ScanPick(c, req, uid)
	if err != nil {
		switch {
		case errors.Is(err, ErrPalletNotFound):
			response.NotFound(c, "Pallet không tồn tại")
		case errors.Is(err, ErrPickingNotMatchFEFO):
			response.Err(c, http.StatusUnprocessableEntity, "FEFO_MISMATCH", err.Error())
		default:
			response.BadRequest(c, err.Error())
		}
		return
	}
	response.OK(c, pal)
}

// ── 9.9 Loading ─────────────────────────────────────

func (h *Handler) StartLoading(c *gin.Context) {
	var req LoadingStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	uid, ok := userIDFromCtx(c)
	if !ok {
		response.Unauthorized(c, "user required")
		return
	}
	sess, err := h.svc.StartLoading(c, req, uid)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, sess)
}

func (h *Handler) ScanLoad(c *gin.Context) {
	var req ScanLoadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	uid, ok := userIDFromCtx(c)
	if !ok {
		response.Unauthorized(c, "user required")
		return
	}
	pal, err := h.svc.ScanLoad(c, req, uid)
	if err != nil {
		switch {
		case errors.Is(err, ErrPalletNotFound):
			response.NotFound(c, "Pallet không tồn tại")
		case errors.Is(err, ErrPalletWrongTrip):
			response.Err(c, http.StatusUnprocessableEntity, "WRONG_TRIP", err.Error())
		default:
			response.BadRequest(c, err.Error())
		}
		return
	}
	response.OK(c, pal)
}

func (h *Handler) CompleteLoading(c *gin.Context) {
	var req struct {
		TripID uuid.UUID `json:"trip_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	uid, _ := userIDFromCtx(c)
	n, err := h.svc.CompleteLoading(c, req.TripID, uid)
	if err != nil {
		h.log.Error(c, "complete loading failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"shipped_pallets": n})
}

// ── 9.11 Cycle count ────────────────────────────────

func (h *Handler) GenerateCycleCount(c *gin.Context) {
	var req GenerateCycleCountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	n, err := h.svc.GenerateCycleCountTasks(c, req)
	if err != nil {
		h.log.Error(c, "generate cycle count failed", err)
		response.InternalError(c)
		return
	}
	response.Created(c, gin.H{"created_tasks": n})
}

func (h *Handler) ListCycleCountTasks(c *gin.Context) {
	whIDStr := c.Query("warehouse_id")
	status := c.DefaultQuery("status", "")
	args := []interface{}{}
	where := "1=1"
	if whIDStr != "" {
		whID, err := uuid.Parse(whIDStr)
		if err != nil {
			response.BadRequest(c, "invalid warehouse_id")
			return
		}
		where += " AND t.warehouse_id = $1"
		args = append(args, whID)
	}
	if status != "" {
		where += " AND t.status::text = $" + strconv.Itoa(len(args)+1)
		args = append(args, status)
	}
	rows, err := h.svc.repo.db.Query(c, `SELECT t.id, t.warehouse_id, t.bin_id, b.bin_code,
		t.scheduled_date::text, t.assigned_to, t.status::text,
		t.expected_snapshot, t.counted_snapshot, t.variance, t.discrepancy_id,
		t.completed_at, t.created_at, t.updated_at
		FROM cycle_count_tasks t LEFT JOIN bin_locations b ON b.id = t.bin_id
		WHERE `+where+` ORDER BY t.scheduled_date DESC, t.created_at DESC LIMIT 200`, args...)
	if err != nil {
		h.log.Error(c, "list cycle count tasks failed", err)
		response.InternalError(c)
		return
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var id, whID, binID uuid.UUID
		var binCode *string
		var sched string
		var assigned, discID *uuid.UUID
		var status string
		var expected, counted, variance []byte
		var completed *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &whID, &binID, &binCode, &sched, &assigned, &status,
			&expected, &counted, &variance, &discID, &completed, &createdAt, &updatedAt); err != nil {
			h.log.Error(c, "scan cycle count task failed", err)
			continue
		}
		out = append(out, map[string]interface{}{
			"id": id, "warehouse_id": whID, "bin_id": binID, "bin_code": binCode,
			"scheduled_date": sched, "assigned_to": assigned, "status": status,
			"expected_snapshot": jsonRaw(expected), "counted_snapshot": jsonRaw(counted),
			"variance": jsonRaw(variance), "discrepancy_id": discID,
			"completed_at": completed, "created_at": createdAt, "updated_at": updatedAt,
		})
	}
	response.OK(c, out)
}

func (h *Handler) SubmitCycleCount(c *gin.Context) {
	var req CycleCountSubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	uid, ok := userIDFromCtx(c)
	if !ok {
		response.Unauthorized(c, "user required")
		return
	}
	task, err := h.svc.SubmitCycleCount(c, req, uid)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, task)
}

// ── 9.12 Dashboard ──────────────────────────────────

func (h *Handler) GetDashboardAlerts(c *gin.Context) {
	var whID *uuid.UUID
	if w := c.Query("warehouse_id"); w != "" {
		id, err := uuid.Parse(w)
		if err != nil {
			response.BadRequest(c, "invalid warehouse_id")
			return
		}
		whID = &id
	}
	alerts, err := h.svc.GetDashboardAlerts(c, whID)
	if err != nil {
		h.log.Error(c, "dashboard alerts failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, alerts)
}

// ── 9.14 Traceability ───────────────────────────────

func (h *Handler) GetLotDistribution(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid lot id")
		return
	}
	out, err := h.svc.GetLotDistribution(c, id)
	if err != nil {
		h.log.Error(c, "lot distribution failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, out)
}

// ── helpers ─────────────────────────────────────────

func jsonRaw(b []byte) interface{} {
	if len(b) == 0 {
		return nil
	}
	return string(b)
}
