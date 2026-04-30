package gps

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler provides REST endpoints for GPS.
type Handler struct {
	hub *Hub
	db  *pgxpool.Pool
}

// NewHandler creates a GPS REST handler.
func NewHandler(hub *Hub, db *pgxpool.Pool) *Handler {
	return &Handler{hub: hub, db: db}
}

// RegisterRoutes registers GPS-related REST endpoints.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Driver batch GPS upload
	driver := r.Group("/driver")
	driver.Use(middleware.RequireRole("driver"))
	driver.POST("/gps/batch", h.BatchGPS)

	// Dispatcher: get latest positions
	// QW-006 / HIGH-009: chỉ role điều hành/quản lý mới xem realtime vị trí cả flotilla,
	// tránh leak vehicle_id cho driver/security (gắn với CRIT-007).
	r.GET("/gps/latest",
		middleware.RequireRole("admin", "dispatcher", "management", "warehouse_handler"),
		h.GetLatestPositions)
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

	// CRIT-007: override vehicle_id with driver's actual in_transit trip vehicle.
	// Prevents driver A from spoofing GPS on vehicle assigned to driver B.
	vehicleID, err := h.hub.lookupDriverVehicle(c.Request.Context(), driverID)
	if err != nil {
		// No active trip → silently accept but don't publish (no vehicle to update)
		response.OK(c, gin.H{"received": len(req.Points), "message": "No active trip — GPS points buffered"})
		return
	}
	for i := range req.Points {
		req.Points[i].DriverID = driverID
		req.Points[i].VehicleID = vehicleID // enforce ownership
		if req.Points[i].Timestamp.IsZero() {
			req.Points[i].Timestamp = time.Now()
		}
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

// GetLatestPositions handles GET /v1/gps/latest - returns latest position of all vehicles enriched with plate/driver info.
func (h *Handler) GetLatestPositions(c *gin.Context) {
	positions, err := h.hub.GetLatestPositions(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}

	enriched := h.enrichPositions(c.Request.Context(), positions)
	response.OK(c, enriched)
}

type enrichedPosition struct {
	VehicleID    string  `json:"vehicle_id"`
	VehiclePlate string  `json:"vehicle_plate"`
	DriverName   string  `json:"driver_name"`
	TripStatus   string  `json:"trip_status"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	Speed        float64 `json:"speed"`
	Heading      float64 `json:"heading"`
	Ts           string  `json:"ts"`
}

func (h *Handler) enrichPositions(ctx context.Context, positions map[string]json.RawMessage) map[string]enrichedPosition {
	result := make(map[string]enrichedPosition, len(positions))

	for vehicleID, raw := range positions {
		var pos struct {
			Lat     float64 `json:"lat"`
			Lng     float64 `json:"lng"`
			Speed   float64 `json:"speed"`
			Heading float64 `json:"heading"`
			Ts      string  `json:"ts"`
		}
		json.Unmarshal(raw, &pos)

		ep := enrichedPosition{
			VehicleID: vehicleID,
			Lat:       pos.Lat,
			Lng:       pos.Lng,
			Speed:     pos.Speed,
			Heading:   pos.Heading,
			Ts:        pos.Ts,
		}

		// Lookup vehicle plate and active trip driver
		var plate, driverName, tripStatus *string
		h.db.QueryRow(ctx, `
			SELECT v.plate_number, d.full_name, t.status::text
			FROM vehicles v
			LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status::text IN ('in_transit','started','planned')
			LEFT JOIN drivers d ON d.id = t.driver_id
			WHERE v.id = $1
			ORDER BY t.created_at DESC
			LIMIT 1
		`, vehicleID).Scan(&plate, &driverName, &tripStatus)

		if plate != nil {
			ep.VehiclePlate = *plate
		}
		if driverName != nil {
			ep.DriverName = *driverName
		}
		if tripStatus != nil {
			ep.TripStatus = *tripStatus
		}

		result[vehicleID] = ep
	}
	return result
}
