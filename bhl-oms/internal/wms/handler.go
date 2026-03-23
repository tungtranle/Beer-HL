package wms

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"
)

type Handler struct {
	svc *Service
	log logger.Logger
}

func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	wh := r.Group("/warehouse")
	{
		wh.GET("/stock", h.GetStock)
		wh.POST("/inbound", h.CreateInbound)
		wh.GET("/picking-orders", h.GetPickingOrders)
		wh.GET("/picking-orders/:id", h.GetPickingOrderByID)
		wh.POST("/confirm-pick", h.ConfirmPick)
		wh.POST("/gate-check", h.PerformGateCheck)
		wh.GET("/gate-checks/:tripId", h.GetGateChecksByTrip)
		wh.GET("/gate-check-queue", h.GetGateCheckQueue)
		wh.POST("/barcode-scan", h.BarcodeScan)
		wh.GET("/expiry-alerts", h.GetExpiryAlerts)
		wh.GET("/locations", h.GetLocations)
		wh.POST("/locations", h.CreateLocation)

		// Return inbound (Task 3.12)
		wh.GET("/returns/pending", h.GetPendingReturns)
		wh.POST("/returns/inbound", h.ProcessReturnInbound)

		// Asset compensation (Task 3.13)
		wh.GET("/asset-compensation", h.GetAssetCompensation)
		wh.GET("/asset-compensation/trip/:tripId", h.GetTripCompensation)

		// Picking by Vehicle — Vehicle-grouped picking view (UX v5)
		wh.GET("/picking-by-vehicle", h.GetPickingByVehicle)

		// Workshop — Bottle classification (Task 6.4-6.5)
		wh.GET("/bottles/trip/:tripId", h.GetBottleClassification)
		wh.POST("/bottles/classify", h.ClassifyBottles)
		wh.GET("/bottles/summary", h.GetBottleSummary)
	}
}

// GET /v1/warehouse/stock
func (h *Handler) GetStock(c *gin.Context) {
	var warehouseID, productID, lotID *uuid.UUID

	if wid := c.Query("warehouse_id"); wid != "" {
		id, err := uuid.Parse(wid)
		if err != nil {
			response.BadRequest(c, "invalid warehouse_id")
			return
		}
		warehouseID = &id
	}
	if pid := c.Query("product_id"); pid != "" {
		id, err := uuid.Parse(pid)
		if err != nil {
			response.BadRequest(c, "invalid product_id")
			return
		}
		productID = &id
	}
	if lid := c.Query("lot_id"); lid != "" {
		id, err := uuid.Parse(lid)
		if err != nil {
			response.BadRequest(c, "invalid lot_id")
			return
		}
		lotID = &id
	}

	stock, err := h.svc.GetStock(c.Request.Context(), warehouseID, productID, lotID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, stock)
}

// POST /v1/warehouse/inbound
func (h *Handler) CreateInbound(c *gin.Context) {
	var req InboundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	uid, ok := userID.(uuid.UUID)
	if !ok {
		response.Unauthorized(c, "invalid user context")
		return
	}

	move, err := h.svc.CreateInbound(c.Request.Context(), req, uid)
	if err != nil {
		response.Err(c, http.StatusUnprocessableEntity, "WMS_ERROR", err.Error())
		return
	}
	response.OK(c, move)
}

// GET /v1/warehouse/picking-orders
func (h *Handler) GetPickingOrders(c *gin.Context) {
	status := c.Query("status")

	if whID := c.Query("warehouse_id"); whID != "" {
		warehouseID, err := uuid.Parse(whID)
		if err != nil {
			response.BadRequest(c, "invalid warehouse_id")
			return
		}
		orders, err := h.svc.GetPickingOrders(c.Request.Context(), warehouseID, status)
		if err != nil {
			response.InternalError(c)
			return
		}
		enriched := h.svc.EnrichPickingOrders(c.Request.Context(), orders)
		response.OK(c, enriched)
		return
	}

	// No warehouse_id → return all picking orders
	orders, err := h.svc.GetAllPickingOrders(c.Request.Context(), status)
	if err != nil {
		response.InternalError(c)
		return
	}
	enriched := h.svc.EnrichPickingOrders(c.Request.Context(), orders)
	response.OK(c, enriched)
}

// GET /v1/warehouse/picking-orders/:id
func (h *Handler) GetPickingOrderByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid picking order id")
		return
	}

	po, err := h.svc.GetPickingOrderByID(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "picking order not found")
		return
	}
	response.OK(c, po)
}

// POST /v1/warehouse/confirm-pick
func (h *Handler) ConfirmPick(c *gin.Context) {
	var req ConfirmPickRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	uid, ok := userID.(uuid.UUID)
	if !ok {
		response.Unauthorized(c, "invalid user context")
		return
	}

	po, err := h.svc.ConfirmPick(c.Request.Context(), req, uid)
	if err != nil {
		response.Err(c, http.StatusUnprocessableEntity, "WMS_ERROR", err.Error())
		return
	}
	response.OK(c, po)
}

// POST /v1/warehouse/gate-check
func (h *Handler) PerformGateCheck(c *gin.Context) {
	var req GateCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	uid, ok := userID.(uuid.UUID)
	if !ok {
		response.Unauthorized(c, "invalid user context")
		return
	}

	gc, err := h.svc.PerformGateCheck(c.Request.Context(), req, uid)
	if err != nil {
		response.Err(c, http.StatusUnprocessableEntity, "WMS_ERROR", err.Error())
		return
	}
	response.OK(c, gc)
}

// GET /v1/warehouse/gate-checks/:tripId
func (h *Handler) GetGateChecksByTrip(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("tripId"))
	if err != nil {
		response.BadRequest(c, "invalid trip_id")
		return
	}

	checks, err := h.svc.GetGateChecksByTrip(c.Request.Context(), tripID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, checks)
}

// GET /v1/warehouse/gate-check-queue
func (h *Handler) GetGateCheckQueue(c *gin.Context) {
	items, err := h.svc.GetGateCheckQueue(c.Request.Context())
	if err != nil {
		h.log.Error(c.Request.Context(), "get_gate_check_queue_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, items)
}

// POST /v1/warehouse/barcode-scan
func (h *Handler) BarcodeScan(c *gin.Context) {
	var req struct {
		Barcode     string    `json:"barcode" binding:"required"`
		WarehouseID uuid.UUID `json:"warehouse_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// Look up product by barcode prefix match
	stock, err := h.svc.GetStock(c.Request.Context(), &req.WarehouseID, nil, nil)
	if err != nil {
		response.InternalError(c)
		return
	}

	// Find matching product by barcode prefix
	for _, sq := range stock {
		if sq.ProductSKU == req.Barcode {
			response.OK(c, sq)
			return
		}
	}
	response.NotFound(c, "product not found for barcode")
}

// GET /v1/warehouse/expiry-alerts
func (h *Handler) GetExpiryAlerts(c *gin.Context) {
	var warehouseID *uuid.UUID
	if wid := c.Query("warehouse_id"); wid != "" {
		id, err := uuid.Parse(wid)
		if err != nil {
			response.BadRequest(c, "invalid warehouse_id")
			return
		}
		warehouseID = &id
	}

	alerts, err := h.svc.GetExpiringLots(c.Request.Context(), warehouseID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, alerts)
}

// GET /v1/warehouse/locations?parent_path=hl
func (h *Handler) GetLocations(c *gin.Context) {
	parentPath := c.Query("parent_path")
	if parentPath == "" {
		response.BadRequest(c, "parent_path required")
		return
	}

	locs, err := h.svc.GetLocationsByParent(c.Request.Context(), parentPath)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, locs)
}

// POST /v1/warehouse/locations
func (h *Handler) CreateLocation(c *gin.Context) {
	var req WarehouseLocation
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	id, err := h.svc.CreateLocation(c.Request.Context(), req)
	if err != nil {
		response.Err(c, http.StatusUnprocessableEntity, "CREATE_LOCATION_FAILED", err.Error())
		return
	}

	req.ID = id
	response.Created(c, req)
}

// GET /v1/warehouse/returns/pending — Task 3.12
func (h *Handler) GetPendingReturns(c *gin.Context) {
	whID := c.Query("warehouse_id")
	if whID == "" {
		response.BadRequest(c, "warehouse_id required")
		return
	}
	warehouseID, err := uuid.Parse(whID)
	if err != nil {
		response.BadRequest(c, "invalid warehouse_id")
		return
	}

	returns, err := h.svc.GetPendingReturnInbound(c.Request.Context(), warehouseID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, returns)
}

// POST /v1/warehouse/returns/inbound — Task 3.12
func (h *Handler) ProcessReturnInbound(c *gin.Context) {
	var req struct {
		ReturnCollectionID uuid.UUID `json:"return_collection_id" binding:"required"`
		WarehouseID        uuid.UUID `json:"warehouse_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	uid, ok := userID.(uuid.UUID)
	if !ok {
		response.Unauthorized(c, "invalid user context")
		return
	}

	move, err := h.svc.ProcessReturnInbound(c.Request.Context(), req.ReturnCollectionID, req.WarehouseID, uid)
	if err != nil {
		response.Err(c, http.StatusUnprocessableEntity, "RETURN_INBOUND_FAILED", err.Error())
		return
	}
	response.OK(c, move)
}

// GET /v1/warehouse/asset-compensation — Task 3.13
func (h *Handler) GetAssetCompensation(c *gin.Context) {
	whID := c.Query("warehouse_id")
	if whID == "" {
		response.BadRequest(c, "warehouse_id required")
		return
	}
	warehouseID, err := uuid.Parse(whID)
	if err != nil {
		response.BadRequest(c, "invalid warehouse_id")
		return
	}

	items, total, err := h.svc.CalculateAssetCompensation(c.Request.Context(), warehouseID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"items": items, "grand_total": total})
}

// GET /v1/warehouse/asset-compensation/trip/:tripId — Task 3.13
func (h *Handler) GetTripCompensation(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("tripId"))
	if err != nil {
		response.BadRequest(c, "invalid trip_id")
		return
	}

	items, total, err := h.svc.CalculateTripCompensation(c.Request.Context(), tripID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"items": items, "grand_total": total})
}

// ── Workshop — Bottle Classification (Tasks 6.4-6.5) ────

// GET /v1/warehouse/picking-by-vehicle?date=2026-03-23
func (h *Handler) GetPickingByVehicle(c *gin.Context) {
	dateStr := c.DefaultQuery("date", "")

	vehicles, err := h.svc.GetPickingByVehicle(c.Request.Context(), dateStr)
	if err != nil {
		h.log.Error(c.Request.Context(), "get_picking_by_vehicle_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, vehicles)
}

// GET /v1/warehouse/bottles/trip/:tripId
func (h *Handler) GetBottleClassification(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("tripId"))
	if err != nil {
		response.BadRequest(c, "invalid trip_id")
		return
	}

	items, err := h.svc.GetBottleClassification(c.Request.Context(), tripID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, items)
}

// POST /v1/warehouse/bottles/classify
func (h *Handler) ClassifyBottles(c *gin.Context) {
	var req struct {
		TripID              string `json:"trip_id" binding:"required"`
		TripNumber          string `json:"trip_number"`
		ProductID           string `json:"product_id" binding:"required"`
		ProductName         string `json:"product_name"`
		BottlesSent         int    `json:"bottles_sent"`
		BottlesReturnedGood int    `json:"bottles_returned_good"`
		BottlesReturnedDmg  int    `json:"bottles_returned_damaged"`
		Notes               string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu thông tin phân loại vỏ")
		return
	}

	tripID, err := uuid.Parse(req.TripID)
	if err != nil {
		response.BadRequest(c, "invalid trip_id")
		return
	}
	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		response.BadRequest(c, "invalid product_id")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	result, err := h.svc.ClassifyBottles(c.Request.Context(), tripID, req.TripNumber, productID, req.ProductName,
		req.BottlesSent, req.BottlesReturnedGood, req.BottlesReturnedDmg, req.Notes, uid)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "CLASSIFY_FAILED", err.Error())
		return
	}
	response.OK(c, result)
}

// GET /v1/warehouse/bottles/summary
func (h *Handler) GetBottleSummary(c *gin.Context) {
	summary, err := h.svc.GetBottleSummary(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, summary)
}
