package tms

import (
	"net/http"
	"strconv"

	"bhl-oms/internal/domain"
	"bhl-oms/internal/middleware"
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
	// Planning
	planning := r.Group("/planning")
	planning.POST("/run-vrp", middleware.RequireRole("admin", "dispatcher"), h.RunVRP)
	planning.GET("/jobs/:jobId", h.GetVRPResult)
	planning.POST("/approve", middleware.RequireRole("admin", "dispatcher"), h.ApprovePlan)

	// Shipments (pending for VRP)
	r.GET("/shipments/pending", h.ListPendingShipments)
	r.GET("/shipments/pending-dates", h.ListPendingDates)
	r.PUT("/shipments/:id/urgent", middleware.RequireRole("admin", "dispatcher"), h.ToggleUrgent)

	// Resources - Vehicles
	vehicles := r.Group("/vehicles")
	vehicles.GET("", h.ListAllVehicles)
	vehicles.GET("/available", h.ListAvailableVehicles)
	vehicles.GET("/:id", h.GetVehicle)
	vehicles.POST("", middleware.RequireRole("admin", "dispatcher"), h.CreateVehicle)
	vehicles.PUT("/:id", middleware.RequireRole("admin", "dispatcher"), h.UpdateVehicle)
	vehicles.DELETE("/:id", middleware.RequireRole("admin"), h.DeleteVehicle)

	// Resources - Drivers
	drivers := r.Group("/drivers")
	drivers.GET("", h.ListAllDrivers)
	drivers.GET("/available", h.ListAvailableDrivers)
	drivers.GET("/checkins", h.ListDriverCheckins)
	drivers.GET("/:id", h.GetDriver)
	drivers.POST("", middleware.RequireRole("admin", "dispatcher"), h.CreateDriver)
	drivers.PUT("/:id", middleware.RequireRole("admin", "dispatcher"), h.UpdateDriver)
	drivers.DELETE("/:id", middleware.RequireRole("admin"), h.DeleteDriver)

	// Trips
	trips := r.Group("/trips")
	trips.GET("", h.ListTrips)
	trips.GET("/:id", h.GetTrip)
	trips.PUT("/:id/status", middleware.RequireRole("admin", "dispatcher"), h.UpdateTripStatus)
	trips.PUT("/:id/stops/:stopId/status", middleware.RequireRole("admin", "dispatcher"), h.UpdateStopStatusDispatcher)

	// Driver endpoints
	driver := r.Group("/driver")
	driver.Use(middleware.RequireRole("driver"))
	driver.GET("/my-trips", h.GetMyTrips)
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

	// Return collection
	driver.POST("/trips/:id/stops/:stopId/returns", h.RecordReturns)
	driver.GET("/trips/:id/stops/:stopId/returns", h.GetReturns)
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

func (h *Handler) RunVRP(c *gin.Context) {
	var req RunVRPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "warehouse_id và delivery_date là bắt buộc")
		return
	}

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
		response.BadRequest(c, "job_id là bắt buộc")
		return
	}

	trips, err := h.svc.ApprovePlan(c.Request.Context(), req)
	if err != nil {
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

	var warehouseID *uuid.UUID
	if wh := c.Query("warehouse_id"); wh != "" {
		if id, err := uuid.Parse(wh); err == nil {
			warehouseID = &id
		}
	}

	trips, total, err := h.svc.ListTrips(c.Request.Context(), warehouseID, plannedDate, status, page, limit)
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
