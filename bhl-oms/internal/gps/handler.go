package gps

import (
	"net/http"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler provides REST endpoints for GPS.
type Handler struct {
	hub *Hub
}

// NewHandler creates a GPS REST handler.
func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

// RegisterRoutes registers GPS-related REST endpoints.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Driver batch GPS upload
	driver := r.Group("/driver")
	driver.Use(middleware.RequireRole("driver"))
	driver.POST("/gps/batch", h.BatchGPS)

	// Dispatcher: get latest positions
	r.GET("/gps/latest", h.GetLatestPositions)
}

// batchGPSRequest is the request body for batch GPS upload.
type batchGPSRequest struct {
	Points []GPSPoint `json:"points" binding:"required"`
}

// BatchGPS handles POST /v1/driver/gps/batch.
func (h *Handler) BatchGPS(c *gin.Context) {
	var req batchGPSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu GPS không hợp lệ")
		return
	}

	if len(req.Points) == 0 {
		response.BadRequest(c, "Cần ít nhất 1 điểm GPS")
		return
	}

	if len(req.Points) > 1000 {
		response.BadRequest(c, "Tối đa 1000 điểm GPS mỗi batch")
		return
	}

	driverID := middleware.GetUserID(c)
	if driverID == uuid.Nil {
		response.Unauthorized(c, "Không xác định được tài xế")
		return
	}

	if err := h.hub.PublishBatch(c.Request.Context(), driverID, req.Points); err != nil {
		response.Err(c, http.StatusInternalServerError, "GPS_FAILED", "Không thể gửi GPS: "+err.Error())
		return
	}

	response.OK(c, gin.H{
		"received": len(req.Points),
		"message":  "GPS data received",
	})
}

// GetLatestPositions handles GET /v1/gps/latest - returns latest position of all vehicles.
func (h *Handler) GetLatestPositions(c *gin.Context) {
	positions, err := h.hub.GetLatestPositions(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, positions)
}
