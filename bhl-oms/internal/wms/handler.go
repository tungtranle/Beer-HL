package wms

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"bhl-oms/pkg/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
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
		wh.POST("/barcode-scan", h.BarcodeScan)
		wh.GET("/expiry-alerts", h.GetExpiryAlerts)
		wh.GET("/locations", h.GetLocations)
		wh.POST("/locations", h.CreateLocation)
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

	status := c.Query("status")
	orders, err := h.svc.GetPickingOrders(c.Request.Context(), warehouseID, status)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, orders)
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
