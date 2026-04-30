package tms

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"bhl-oms/internal/domain"
	"bhl-oms/internal/middleware"
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
	// Planning
	planning := r.Group("/planning")
	planning.POST("/run-vrp", middleware.RequireRole("admin", "dispatcher"), h.RunVRP)
	planning.GET("/jobs/:jobId", h.GetVRPResult)
	planning.POST("/approve", middleware.RequireRole("admin", "dispatcher"), h.ApprovePlan)
	planning.GET("/cost-readiness", middleware.RequireRole("admin", "dispatcher"), h.GetCostReadiness)
	planning.POST("/scenarios", middleware.RequireRole("admin", "dispatcher"), h.SaveVRPScenario)
	planning.GET("/scenarios", middleware.RequireRole("admin", "dispatcher"), h.ListVRPScenarios)
	planning.GET("/scenarios/:id", middleware.RequireRole("admin", "dispatcher"), h.GetVRPScenario)
	planning.DELETE("/scenarios/:id", middleware.RequireRole("admin", "dispatcher"), h.DeleteVRPScenario)

	// Shipments (pending for VRP)
	r.GET("/shipments/pending", h.ListPendingShipments)
	r.GET("/shipments/pending-dates", h.ListPendingDates)
	r.PUT("/shipments/:id/urgent", middleware.RequireRole("admin", "dispatcher"), h.ToggleUrgent)

	// Resources - Vehicles
	vehicles := r.Group("/vehicles")
	vehicles.GET("", h.ListAllVehicles)
	vehicles.GET("/available", h.ListAvailableVehicles)
	vehicles.GET("/expiring-documents", middleware.RequireRole("admin", "dispatcher"), h.ListExpiringVehicleDocs)
	vehicles.GET("/:id", h.GetVehicle)
	vehicles.POST("", middleware.RequireRole("admin", "dispatcher"), h.CreateVehicle)
	vehicles.PUT("/:id", middleware.RequireRole("admin", "dispatcher"), h.UpdateVehicle)
	vehicles.DELETE("/:id", middleware.RequireRole("admin"), h.DeleteVehicle)
	vehicles.PUT("/:id/default-driver", middleware.RequireRole("admin", "dispatcher"), h.SetVehicleDriverMapping)
	vehicles.GET("/:id/documents", h.ListVehicleDocuments)
	vehicles.POST("/:id/documents", middleware.RequireRole("admin", "dispatcher"), h.CreateVehicleDocument)
	vehicles.PUT("/:id/documents/:docId", middleware.RequireRole("admin", "dispatcher"), h.UpdateVehicleDocument)
	vehicles.DELETE("/:id/documents/:docId", middleware.RequireRole("admin"), h.DeleteVehicleDocument)

	// Resources - Drivers
	drivers := r.Group("/drivers")
	drivers.GET("", h.ListAllDrivers)
	drivers.GET("/available", h.ListAvailableDrivers)
	drivers.GET("/checkins", h.ListDriverCheckins)
	drivers.GET("/expiring-documents", middleware.RequireRole("admin", "dispatcher"), h.ListExpiringDriverDocs)
	drivers.GET("/:id", h.GetDriver)
	drivers.POST("", middleware.RequireRole("admin", "dispatcher"), h.CreateDriver)
	drivers.PUT("/:id", middleware.RequireRole("admin", "dispatcher"), h.UpdateDriver)
	drivers.DELETE("/:id", middleware.RequireRole("admin"), h.DeleteDriver)
	drivers.GET("/:id/documents", h.ListDriverDocuments)
	drivers.POST("/:id/documents", middleware.RequireRole("admin", "dispatcher"), h.CreateDriverDocument)
	drivers.PUT("/:id/documents/:docId", middleware.RequireRole("admin", "dispatcher"), h.UpdateDriverDocument)
	drivers.DELETE("/:id/documents/:docId", middleware.RequireRole("admin"), h.DeleteDriverDocument)

	// Trips
	trips := r.Group("/trips")
	trips.GET("", h.ListTrips)
	trips.GET("/:id", h.GetTrip)
	trips.PUT("/:id/status", middleware.RequireRole("admin", "dispatcher"), h.UpdateTripStatus)
	trips.PUT("/:id/stops/:stopId/status", middleware.RequireRole("admin", "dispatcher"), h.UpdateStopStatusDispatcher)
	trips.POST("/:id/stops/:stopId/move", middleware.RequireRole("admin", "dispatcher"), h.MoveStop)
	trips.POST("/:id/cancel", middleware.RequireRole("admin", "dispatcher"), h.CancelTrip)
	trips.GET("/exceptions", middleware.RequireRole("admin", "dispatcher"), h.ListExceptions)
	trips.GET("/control-tower/stats", middleware.RequireRole("admin", "dispatcher", "management"), h.GetControlTowerStats)
	trips.GET("/export", middleware.RequireRole("admin", "dispatcher", "accountant", "management"), h.ExportTrips)

	// Driver endpoints
	driver := r.Group("/driver")
	driver.Use(middleware.RequireRole("driver"))
	driver.GET("/my-trips", h.GetMyTrips)
	driver.GET("/monthly-stats", h.GetDriverMonthlyStats)
	driver.POST("/checkin", h.DriverCheckin)
	driver.GET("/checkin", h.GetMyCheckin)
	driver.PUT("/trips/:id/start", h.StartTrip)
	driver.PUT("/trips/:id/stops/:stopId/update", h.UpdateStopStatus)
	driver.PUT("/trips/:id/complete", h.CompleteTrip)
	driver.POST("/trips/:id/checklist", h.SubmitChecklist)
	driver.GET("/trips/:id/checklist", h.GetChecklist)

	// ePOD (Electronic Proof of Delivery)
	driver.POST("/trips/:id/stops/:stopId/epod", h.SubmitEPOD)
	driver.GET("/trips/:id/stops/:stopId/epod", h.GetEPOD)

	// Payment
	driver.POST("/trips/:id/stops/:stopId/payment", h.RecordPayment)
	driver.GET("/trips/:id/stops/:stopId/payments", h.GetPayments)

	// Return collection
	driver.POST("/trips/:id/stops/:stopId/returns", h.RecordReturns)
	driver.GET("/trips/:id/stops/:stopId/returns", h.GetReturns)

	// End-of-Day (Kết ca) — Driver endpoints
	driver.POST("/trips/:id/eod/start", h.StartEOD)
	driver.GET("/trips/:id/eod", h.GetEODSession)
	driver.POST("/trips/:id/eod/checkpoint/:cpType/submit", h.SubmitCheckpointDriver)

	// End-of-Day — Receiver endpoints (warehouse_handler, accountant, dispatcher)
	eod := r.Group("/eod")
	// QW-005 / HIGH-002: EOD checkpoint là chốt kết ca tài xế, chỉ receiver hợp lệ được confirm/reject.
	eod.Use(middleware.RequireRole("admin", "warehouse_handler", "accountant", "dispatcher", "management"))
	eod.GET("/pending/:cpType", h.GetPendingCheckpoints)
	eod.POST("/checkpoint/:checkpointId/confirm", h.ConfirmCheckpointReceiver)
	eod.POST("/checkpoint/:checkpointId/reject", h.RejectCheckpointReceiver)

	// Offline sync — batch process queued actions
	driver.POST("/sync", h.OfflineSync)

	// Cost Engine Admin
	cost := r.Group("/cost")
	cost.Use(middleware.RequireRole("admin", "dispatcher"))
	// Toll stations
	cost.GET("/toll-stations", h.ListTollStations)
	cost.POST("/toll-stations", h.CreateTollStation)
	cost.PUT("/toll-stations/:id", h.UpdateTollStation)
	cost.DELETE("/toll-stations/:id", h.DeleteTollStation)
	// Toll expressways + gates
	cost.GET("/toll-expressways", h.ListTollExpressways)
	cost.POST("/toll-expressways", h.CreateTollExpressway)
	cost.PUT("/toll-expressways/:id", h.UpdateTollExpressway)
	cost.DELETE("/toll-expressways/:id", h.DeleteTollExpressway)
	cost.POST("/toll-expressways/:id/gates", h.CreateTollExpresswayGate)
	cost.DELETE("/toll-expressways/:id/gates/:gateId", h.DeleteTollExpresswayGate)
	// Vehicle type cost defaults
	cost.GET("/vehicle-type-defaults", h.ListVehicleTypeCostDefaults)
	cost.PUT("/vehicle-type-defaults/:id", h.UpdateVehicleTypeCostDefault)
	// Vehicle cost profiles (per-vehicle override)
	cost.GET("/vehicles/:id/profile", h.GetVehicleCostProfile)
	cost.PUT("/vehicles/:id/profile", h.UpsertVehicleCostProfile)
	cost.DELETE("/vehicles/:id/profile", h.DeleteVehicleCostProfile)
	// Driver cost rates
	cost.GET("/driver-rates", h.ListDriverCostRates)
	cost.POST("/driver-rates", h.CreateDriverCostRate)
	cost.PUT("/driver-rates/:id", h.UpdateDriverCostRate)
	cost.DELETE("/driver-rates/:id", h.DeleteDriverCostRate)
}

func (h *Handler) ListPendingDates(c *gin.Context) {
	warehouseID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id là bắt buộc")
		return
	}

	dates, err := h.svc.ListPendingDates(c.Request.Context(), warehouseID)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, dates)
}

func (h *Handler) ListPendingShipments(c *gin.Context) {
	warehouseID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id là bắt buộc")
		return
	}

	deliveryDate := c.Query("delivery_date")
	if deliveryDate == "" {
		response.BadRequest(c, "delivery_date là bắt buộc")
		return
	}

	shipments, err := h.svc.ListPendingShipments(c.Request.Context(), warehouseID, deliveryDate)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, shipments)
}

func (h *Handler) ToggleUrgent(c *gin.Context) {
	shipmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "shipment id không hợp lệ")
		return
	}

	var body struct {
		IsUrgent bool `json:"is_urgent"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "is_urgent là bắt buộc")
		return
	}

	if err := h.svc.ToggleUrgent(c.Request.Context(), shipmentID, body.IsUrgent); err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"id": shipmentID, "is_urgent": body.IsUrgent})
}

func (h *Handler) ListAllVehicles(c *gin.Context) {
	vehicles, err := h.svc.ListAllVehicles(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, vehicles)
}

func (h *Handler) ListAvailableVehicles(c *gin.Context) {
	warehouseID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id là bắt buộc")
		return
	}

	date := c.DefaultQuery("date", "")
	vehicles, err := h.svc.ListAvailableVehicles(c.Request.Context(), warehouseID, date)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, vehicles)
}

func (h *Handler) ListAllDrivers(c *gin.Context) {
	drivers, err := h.svc.ListAllDrivers(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, drivers)
}

func (h *Handler) ListAvailableDrivers(c *gin.Context) {
	warehouseID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id là bắt buộc")
		return
	}

	date := c.DefaultQuery("date", "")
	drivers, err := h.svc.ListAvailableDrivers(c.Request.Context(), warehouseID, date)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, drivers)
}

// ===== VEHICLE CRUD =====

func (h *Handler) GetVehicle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid vehicle ID")
		return
	}
	v, err := h.svc.GetVehicle(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Không tìm thấy phương tiện")
		return
	}
	response.OK(c, v)
}

func (h *Handler) CreateVehicle(c *gin.Context) {
	var v domain.Vehicle
	if err := c.ShouldBindJSON(&v); err != nil {
		response.BadRequest(c, "Dữ liệu phương tiện không hợp lệ")
		return
	}
	if v.Status == "" {
		v.Status = "active"
	}
	if err := h.svc.CreateVehicle(c.Request.Context(), &v); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, v)
}

func (h *Handler) UpdateVehicle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid vehicle ID")
		return
	}
	var v domain.Vehicle
	if err := c.ShouldBindJSON(&v); err != nil {
		response.BadRequest(c, "Dữ liệu phương tiện không hợp lệ")
		return
	}
	v.ID = id
	if err := h.svc.UpdateVehicle(c.Request.Context(), &v); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, v)
}

func (h *Handler) DeleteVehicle(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid vehicle ID")
		return
	}
	if err := h.svc.DeleteVehicle(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã vô hiệu hóa phương tiện"})
}

// ===== DRIVER CRUD =====

func (h *Handler) GetDriver(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid driver ID")
		return
	}
	d, err := h.svc.GetDriver(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Không tìm thấy tài xế")
		return
	}
	response.OK(c, d)
}

func (h *Handler) CreateDriver(c *gin.Context) {
	var d domain.Driver
	if err := c.ShouldBindJSON(&d); err != nil {
		response.BadRequest(c, "Dữ liệu tài xế không hợp lệ")
		return
	}
	if d.Status == "" {
		d.Status = "active"
	}
	if err := h.svc.CreateDriver(c.Request.Context(), &d); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, d)
}

func (h *Handler) UpdateDriver(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid driver ID")
		return
	}
	var d domain.Driver
	if err := c.ShouldBindJSON(&d); err != nil {
		response.BadRequest(c, "Dữ liệu tài xế không hợp lệ")
		return
	}
	d.ID = id
	if err := h.svc.UpdateDriver(c.Request.Context(), &d); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, d)
}

func (h *Handler) DeleteDriver(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid driver ID")
		return
	}
	if err := h.svc.DeleteDriver(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã vô hiệu hóa tài xế"})
}

// SetVehicleDriverMapping sets or clears the default driver for a vehicle (bidirectional 1:1)
func (h *Handler) SetVehicleDriverMapping(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid vehicle ID")
		return
	}
	var req struct {
		DriverID *uuid.UUID `json:"driver_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}
	if err := h.svc.SetVehicleDriverMapping(c.Request.Context(), vehicleID, req.DriverID); err != nil {
		response.Err(c, http.StatusBadRequest, "MAPPING_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã cập nhật tài xế mặc định"})
}

func (h *Handler) RunVRP(c *gin.Context) {
	var req RunVRPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "warehouse_id và delivery_date là bắt buộc")
		return
	}

	// Pass requesting user ID for real-time progress broadcast
	userID := middleware.GetUserID(c)
	req.RequestingUserID = &userID

	jobID, err := h.svc.RunVRP(c.Request.Context(), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"job_id":   jobID,
		"status":   "processing",
		"poll_url": "/v1/planning/jobs/" + jobID,
	})
}

func (h *Handler) GetVRPResult(c *gin.Context) {
	jobID := c.Param("jobId")
	result, err := h.svc.GetVRPResult(jobID)
	if err != nil {
		response.NotFound(c, "Job không tồn tại")
		return
	}
	response.OK(c, result)
}

func (h *Handler) ApprovePlan(c *gin.Context) {
	var req ApprovePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Error(c.Request.Context(), "approve_plan_bind_error", err)
		response.BadRequest(c, fmt.Sprintf("Dữ liệu không hợp lệ: %v", err))
		return
	}

	// Inject actor info from JWT
	userID := middleware.GetUserID(c)
	req.ActorID = &userID
	req.ActorName = c.GetString("user_name")
	if req.ActorName == "" {
		req.ActorName = "Điều phối viên"
	}

	h.log.Info(c.Request.Context(), "approve_plan_request",
		logger.F("job_id", req.JobID),
		logger.F("warehouse_id", req.WarehouseID.String()),
		logger.F("delivery_date", req.DeliveryDate),
		logger.F("trips_count", len(req.Trips)),
		logger.F("assignments_count", len(req.Assignments)),
	)

	trips, err := h.svc.ApprovePlan(c.Request.Context(), req)
	if err != nil {
		h.log.Error(c.Request.Context(), "approve_plan_service_error", err)
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, gin.H{
		"trips": trips,
		"total": len(trips),
	})
}

func (h *Handler) ListTrips(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	plannedDate := c.Query("planned_date")
	activeOnly := c.Query("active") == "true"

	warehouseID, allowed := middleware.ResolveWarehouseScope(c)
	if !allowed {
		response.Forbidden(c, "Không có quyền truy cập kho này")
		return
	}

	trips, total, err := h.svc.ListTrips(c.Request.Context(), warehouseID, plannedDate, status, activeOnly, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	response.OKWithMeta(c, trips, response.PaginationMeta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *Handler) GetTrip(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}

	trip, err := h.svc.GetTrip(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Không tìm thấy chuyến xe")
		return
	}
	response.OK(c, trip)
}

// ===== DISPATCHER TRIP STATUS =====

func (h *Handler) UpdateTripStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Status == "" {
		response.BadRequest(c, "status là bắt buộc")
		return
	}

	if err := h.svc.UpdateTripStatusDispatcher(c.Request.Context(), id, req.Status); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_TRIP_FAILED", err.Error())
		return
	}

	trip, _ := h.svc.GetTrip(c.Request.Context(), id)
	response.OK(c, trip)
}

func (h *Handler) UpdateStopStatusDispatcher(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "Invalid stop ID")
		return
	}

	var req UpdateStopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "action là bắt buộc (arrive/deliver/fail/skip)")
		return
	}

	if err := h.svc.UpdateStopStatusDispatcher(c.Request.Context(), tripID, stopID, req); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_STOP_FAILED", err.Error())
		return
	}

	trip, _ := h.svc.GetTrip(c.Request.Context(), tripID)
	response.OK(c, trip)
}

// ===== DRIVER HANDLERS =====

func (h *Handler) GetMyTrips(c *gin.Context) {
	userID := middleware.GetUserID(c)
	trips, err := h.svc.GetMyTrips(c.Request.Context(), userID)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "DRIVER_ERROR", err.Error())
		return
	}
	response.OK(c, trips)
}

// GET /v1/driver/monthly-stats — hiệu suất tháng này của driver
func (h *Handler) GetDriverMonthlyStats(c *gin.Context) {
	userID := middleware.GetUserID(c)
	stats, err := h.svc.GetDriverMonthlyStats(c.Request.Context(), userID)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "DRIVER_ERROR", err.Error())
		return
	}
	response.OK(c, stats)
}

func (h *Handler) StartTrip(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}

	userID := middleware.GetUserID(c)
	if err := h.svc.StartTrip(c.Request.Context(), userID, tripID); err != nil {
		response.Err(c, http.StatusBadRequest, "START_TRIP_FAILED", err.Error())
		return
	}

	trip, _ := h.svc.GetTrip(c.Request.Context(), tripID)
	response.OK(c, trip)
}

func (h *Handler) UpdateStopStatus(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "Invalid stop ID")
		return
	}

	var req UpdateStopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "action là bắt buộc (arrive/deliver/fail/skip)")
		return
	}

	userID := middleware.GetUserID(c)
	if err := h.svc.UpdateStopStatus(c.Request.Context(), userID, tripID, stopID, req); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_STOP_FAILED", err.Error())
		return
	}

	trip, _ := h.svc.GetTrip(c.Request.Context(), tripID)
	response.OK(c, trip)
}

func (h *Handler) CompleteTrip(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}

	userID := middleware.GetUserID(c)
	if err := h.svc.CompleteTrip(c.Request.Context(), userID, tripID); err != nil {
		response.Err(c, http.StatusBadRequest, "COMPLETE_TRIP_FAILED", err.Error())
		return
	}

	trip, _ := h.svc.GetTrip(c.Request.Context(), tripID)
	response.OK(c, trip)
}

// ===== CHECKLIST HANDLERS =====

func (h *Handler) SubmitChecklist(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}

	var req SubmitChecklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu checklist không hợp lệ")
		return
	}

	userID := middleware.GetUserID(c)
	cl, err := h.svc.SubmitChecklist(c.Request.Context(), userID, tripID, req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "CHECKLIST_FAILED", err.Error())
		return
	}

	response.Created(c, cl)
}

func (h *Handler) GetChecklist(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}

	cl, err := h.svc.GetChecklist(c.Request.Context(), tripID)
	if err != nil {
		response.NotFound(c, "Chưa có checklist cho chuyến xe này")
		return
	}
	response.OK(c, cl)
}

// ===== ePOD HANDLERS =====

func (h *Handler) SubmitEPOD(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "Invalid stop ID")
		return
	}

	var req SubmitEPODRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu ePOD không hợp lệ")
		return
	}

	userID := middleware.GetUserID(c)
	epod, err := h.svc.SubmitEPOD(c.Request.Context(), userID, tripID, stopID, req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "EPOD_FAILED", err.Error())
		return
	}
	response.Created(c, epod)
}

func (h *Handler) GetEPOD(c *gin.Context) {
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "Invalid stop ID")
		return
	}

	epod, err := h.svc.GetEPOD(c.Request.Context(), stopID)
	if err != nil {
		response.NotFound(c, "Chưa có ePOD cho điểm giao này")
		return
	}
	response.OK(c, epod)
}

// ===== PAYMENT HANDLERS =====

func (h *Handler) RecordPayment(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "Invalid stop ID")
		return
	}

	var req RecordPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu thanh toán không hợp lệ")
		return
	}

	userID := middleware.GetUserID(c)
	payment, err := h.svc.RecordPayment(c.Request.Context(), userID, tripID, stopID, req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "PAYMENT_FAILED", err.Error())
		return
	}
	response.Created(c, payment)
}

func (h *Handler) GetPayments(c *gin.Context) {
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "Invalid stop ID")
		return
	}

	payments, err := h.svc.GetPaymentsByStopID(c.Request.Context(), stopID)
	if err != nil {
		response.NotFound(c, "Chưa có thanh toán cho điểm giao này")
		return
	}
	response.OK(c, payments)
}

// ===== RETURN COLLECTION HANDLERS =====

func (h *Handler) RecordReturns(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "Invalid stop ID")
		return
	}

	var req RecordReturnsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu thu hồi không hợp lệ")
		return
	}

	userID := middleware.GetUserID(c)
	returns, err := h.svc.RecordReturns(c.Request.Context(), userID, tripID, stopID, req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "RETURN_FAILED", err.Error())
		return
	}
	response.Created(c, returns)
}

func (h *Handler) GetReturns(c *gin.Context) {
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "Invalid stop ID")
		return
	}

	returns, err := h.svc.GetReturns(c.Request.Context(), stopID)
	if err != nil {
		response.NotFound(c, "Chưa có thu hồi cho điểm giao này")
		return
	}
	response.OK(c, returns)
}

// ===== DRIVER CHECK-IN =====

func (h *Handler) DriverCheckin(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req struct {
		Status string  `json:"status" binding:"required"`
		Reason *string `json:"reason"`
		Note   *string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "status là bắt buộc (available hoặc off_duty)")
		return
	}
	if req.Status != "available" && req.Status != "off_duty" {
		response.BadRequest(c, "status phải là 'available' hoặc 'off_duty'")
		return
	}
	checkin, err := h.svc.DriverCheckin(c.Request.Context(), userID, req.Status, req.Reason, req.Note)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, checkin)
}

func (h *Handler) GetMyCheckin(c *gin.Context) {
	userID := middleware.GetUserID(c)
	checkin, err := h.svc.GetMyCheckin(c.Request.Context(), userID)
	if err != nil {
		response.OK(c, gin.H{"status": "not_checked_in"})
		return
	}
	response.OK(c, checkin)
}

func (h *Handler) ListDriverCheckins(c *gin.Context) {
	warehouseID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id là bắt buộc")
		return
	}
	date := c.Query("date")
	if date == "" {
		response.BadRequest(c, "date là bắt buộc")
		return
	}
	checkins, err := h.svc.ListDriverCheckinsForDate(c.Request.Context(), warehouseID, date)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, checkins)
}

// ===== VEHICLE DOCUMENT HANDLERS =====

func (h *Handler) ListVehicleDocuments(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid vehicle ID")
		return
	}
	docs, err := h.svc.ListVehicleDocuments(c.Request.Context(), vehicleID)
	if err != nil {
		response.InternalError(c)
		return
	}
	if docs == nil {
		docs = []domain.VehicleDocument{}
	}
	response.OK(c, docs)
}

func (h *Handler) CreateVehicleDocument(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid vehicle ID")
		return
	}
	var doc domain.VehicleDocument
	if err := c.ShouldBindJSON(&doc); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}
	doc.VehicleID = vehicleID
	userID := middleware.GetUserID(c)
	doc.CreatedBy = &userID

	if err := h.svc.CreateVehicleDocument(c.Request.Context(), &doc); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_DOC_FAILED", err.Error())
		return
	}
	response.Created(c, doc)
}

func (h *Handler) UpdateVehicleDocument(c *gin.Context) {
	_, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid vehicle ID")
		return
	}
	docID, err := uuid.Parse(c.Param("docId"))
	if err != nil {
		response.BadRequest(c, "Invalid document ID")
		return
	}
	var doc domain.VehicleDocument
	if err := c.ShouldBindJSON(&doc); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}
	doc.ID = docID
	if err := h.svc.UpdateVehicleDocument(c.Request.Context(), &doc); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_DOC_FAILED", err.Error())
		return
	}
	response.OK(c, doc)
}

func (h *Handler) DeleteVehicleDocument(c *gin.Context) {
	docID, err := uuid.Parse(c.Param("docId"))
	if err != nil {
		response.BadRequest(c, "Invalid document ID")
		return
	}
	if err := h.svc.DeleteVehicleDocument(c.Request.Context(), docID); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_DOC_FAILED", err.Error())
		return
	}
	response.OK(c, nil)
}

func (h *Handler) ListExpiringVehicleDocs(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 0 {
		days = 30
	}
	docs, err := h.svc.ListExpiringVehicleDocs(c.Request.Context(), days)
	if err != nil {
		response.InternalError(c)
		return
	}
	if docs == nil {
		docs = []domain.VehicleDocument{}
	}
	response.OK(c, docs)
}

// ===== DRIVER DOCUMENT HANDLERS =====

func (h *Handler) ListDriverDocuments(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid driver ID")
		return
	}
	docs, err := h.svc.ListDriverDocuments(c.Request.Context(), driverID)
	if err != nil {
		response.InternalError(c)
		return
	}
	if docs == nil {
		docs = []domain.DriverDocument{}
	}
	response.OK(c, docs)
}

func (h *Handler) CreateDriverDocument(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid driver ID")
		return
	}
	var doc domain.DriverDocument
	if err := c.ShouldBindJSON(&doc); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}
	doc.DriverID = driverID
	userID := middleware.GetUserID(c)
	doc.CreatedBy = &userID

	if err := h.svc.CreateDriverDocument(c.Request.Context(), &doc); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_DOC_FAILED", err.Error())
		return
	}
	response.Created(c, doc)
}

func (h *Handler) UpdateDriverDocument(c *gin.Context) {
	_, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid driver ID")
		return
	}
	docID, err := uuid.Parse(c.Param("docId"))
	if err != nil {
		response.BadRequest(c, "Invalid document ID")
		return
	}
	var doc domain.DriverDocument
	if err := c.ShouldBindJSON(&doc); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}
	doc.ID = docID
	if err := h.svc.UpdateDriverDocument(c.Request.Context(), &doc); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_DOC_FAILED", err.Error())
		return
	}
	response.OK(c, doc)
}

func (h *Handler) DeleteDriverDocument(c *gin.Context) {
	docID, err := uuid.Parse(c.Param("docId"))
	if err != nil {
		response.BadRequest(c, "Invalid document ID")
		return
	}
	if err := h.svc.DeleteDriverDocument(c.Request.Context(), docID); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_DOC_FAILED", err.Error())
		return
	}
	response.OK(c, nil)
}

func (h *Handler) ListExpiringDriverDocs(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 0 {
		days = 30
	}
	docs, err := h.svc.ListExpiringDriverDocs(c.Request.Context(), days)
	if err != nil {
		response.InternalError(c)
		return
	}
	if docs == nil {
		docs = []domain.DriverDocument{}
	}
	response.OK(c, docs)
}

// ─── Dispatcher Control Tower ────────────────────────

func (h *Handler) ListExceptions(c *gin.Context) {
	exceptions, err := h.svc.ListExceptions(c.Request.Context())
	if err != nil {
		h.log.Error(c.Request.Context(), "list_exceptions_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, exceptions)
}

func (h *Handler) GetControlTowerStats(c *gin.Context) {
	stats, err := h.svc.GetControlTowerStats(c.Request.Context())
	if err != nil {
		h.log.Error(c.Request.Context(), "control_tower_stats_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, stats)
}

func (h *Handler) MoveStop(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid trip id")
		return
	}
	stopID, err := uuid.Parse(c.Param("stopId"))
	if err != nil {
		response.BadRequest(c, "invalid stop id")
		return
	}
	var body struct {
		TargetTripID string `json:"target_trip_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	targetID, err := uuid.Parse(body.TargetTripID)
	if err != nil {
		response.BadRequest(c, "invalid target_trip_id")
		return
	}
	if err := h.svc.MoveStop(c.Request.Context(), tripID, stopID, targetID); err != nil {
		h.log.Error(c.Request.Context(), "move_stop_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"message": "stop moved"})
}

// ══════════════════════════════════════════════════════
// Offline Sync — batch process queued driver actions
// ══════════════════════════════════════════════════════

type syncAction struct {
	Type      string          `json:"type"`
	TripID    string          `json:"trip_id"`
	StopID    string          `json:"stop_id,omitempty"`
	Payload   json.RawMessage `json:"payload"`
	LocalID   string          `json:"local_id"`
	Timestamp string          `json:"timestamp"`
}

type syncResult struct {
	LocalID  string `json:"local_id"`
	Type     string `json:"type"`
	Status   string `json:"status"` // "ok", "conflict", "error"
	ServerID string `json:"server_id,omitempty"`
	Error    string `json:"error,omitempty"`
}

func (h *Handler) OfflineSync(c *gin.Context) {
	var req struct {
		Actions []syncAction `json:"actions" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID := middleware.GetUserID(c)
	results := make([]syncResult, 0, len(req.Actions))

	for _, action := range req.Actions {
		r := syncResult{LocalID: action.LocalID, Type: action.Type}

		tripID, err := uuid.Parse(action.TripID)
		if err != nil {
			r.Status = "error"
			r.Error = "invalid trip_id"
			results = append(results, r)
			continue
		}

		switch action.Type {
		case "epod":
			var epodReq SubmitEPODRequest
			if err := json.Unmarshal(action.Payload, &epodReq); err != nil {
				r.Status = "error"
				r.Error = "invalid epod payload"
				results = append(results, r)
				continue
			}
			stopID, _ := uuid.Parse(action.StopID)
			epod, err := h.svc.SubmitEPOD(c.Request.Context(), userID, tripID, stopID, epodReq)
			if err != nil {
				r.Status = "error"
				r.Error = err.Error()
			} else {
				r.Status = "ok"
				r.ServerID = epod.ID.String()
			}

		case "payment":
			var payReq RecordPaymentRequest
			if err := json.Unmarshal(action.Payload, &payReq); err != nil {
				r.Status = "error"
				r.Error = "invalid payment payload"
				results = append(results, r)
				continue
			}
			stopID, _ := uuid.Parse(action.StopID)
			payment, err := h.svc.RecordPayment(c.Request.Context(), userID, tripID, stopID, payReq)
			if err != nil {
				r.Status = "error"
				r.Error = err.Error()
			} else {
				r.Status = "ok"
				r.ServerID = payment.ID.String()
			}

		case "return_collection":
			var retReq RecordReturnsRequest
			if err := json.Unmarshal(action.Payload, &retReq); err != nil {
				r.Status = "error"
				r.Error = "invalid return_collection payload"
				results = append(results, r)
				continue
			}
			stopID, _ := uuid.Parse(action.StopID)
			returns, err := h.svc.RecordReturns(c.Request.Context(), userID, tripID, stopID, retReq)
			if err != nil {
				r.Status = "error"
				r.Error = err.Error()
			} else if len(returns) > 0 {
				r.Status = "ok"
				r.ServerID = returns[0].ID.String()
			} else {
				r.Status = "ok"
			}

		default:
			r.Status = "error"
			r.Error = "unknown action type: " + action.Type
		}
		results = append(results, r)
	}

	synced := 0
	for _, r := range results {
		if r.Status == "ok" {
			synced++
		}
	}

	response.OK(c, gin.H{
		"synced":  synced,
		"total":   len(req.Actions),
		"results": results,
	})
}

func (h *Handler) CancelTrip(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid trip id")
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.CancelTrip(c.Request.Context(), tripID, body.Reason); err != nil {
		h.log.Error(c.Request.Context(), "cancel_trip_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"message": "trip cancelled"})
}

// ===== END-OF-DAY (KẾT CA) HANDLERS =====

// POST /v1/driver/trips/:id/eod/start
func (h *Handler) StartEOD(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}
	userID := middleware.GetUserID(c)
	session, err := h.svc.StartEOD(c.Request.Context(), userID, tripID)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "START_EOD_FAILED", err.Error())
		return
	}
	response.Created(c, session)
}

// GET /v1/driver/trips/:id/eod
func (h *Handler) GetEODSession(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}
	userID := middleware.GetUserID(c)
	session, err := h.svc.GetEODSession(c.Request.Context(), userID, tripID)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, session)
}

// POST /v1/driver/trips/:id/eod/checkpoint/:cpType/submit
func (h *Handler) SubmitCheckpointDriver(c *gin.Context) {
	tripID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid trip ID")
		return
	}
	cpType := c.Param("cpType")

	var req SubmitCheckpointRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu checkpoint không hợp lệ")
		return
	}
	userID := middleware.GetUserID(c)
	cp, err := h.svc.SubmitCheckpoint(c.Request.Context(), userID, tripID, cpType, req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "SUBMIT_CHECKPOINT_FAILED", err.Error())
		return
	}
	response.OK(c, cp)
}

// GET /v1/eod/pending/:cpType
func (h *Handler) GetPendingCheckpoints(c *gin.Context) {
	cpType := c.Param("cpType")
	cps, err := h.svc.GetPendingCheckpointsByType(c.Request.Context(), cpType)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, cps)
}

// POST /v1/eod/checkpoint/:checkpointId/confirm
func (h *Handler) ConfirmCheckpointReceiver(c *gin.Context) {
	checkpointID, err := uuid.Parse(c.Param("checkpointId"))
	if err != nil {
		response.BadRequest(c, "Invalid checkpoint ID")
		return
	}
	var req ConfirmCheckpointRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu xác nhận không hợp lệ")
		return
	}
	userID := middleware.GetUserID(c)
	userName := c.GetString("user_name")
	if userName == "" {
		userName = "Người nhận"
	}
	cp, err := h.svc.ConfirmCheckpoint(c.Request.Context(), userID, checkpointID, userName, req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "CONFIRM_CHECKPOINT_FAILED", err.Error())
		return
	}
	response.OK(c, cp)
}

// POST /v1/eod/checkpoint/:checkpointId/reject
func (h *Handler) RejectCheckpointReceiver(c *gin.Context) {
	checkpointID, err := uuid.Parse(c.Param("checkpointId"))
	if err != nil {
		response.BadRequest(c, "Invalid checkpoint ID")
		return
	}
	var req RejectCheckpointRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Vui lòng nhập lý do từ chối")
		return
	}
	userID := middleware.GetUserID(c)
	cp, err := h.svc.RejectCheckpoint(c.Request.Context(), userID, checkpointID, req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "REJECT_CHECKPOINT_FAILED", err.Error())
		return
	}
	response.OK(c, cp)
}
