package fleet

import (
	"net/http"
	"strconv"

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
	fleet := r.Group("/fleet")
	fleet.Use(middleware.RequireRole("admin", "dispatcher", "workshop"))

	// Work Orders
	wo := fleet.Group("/work-orders")
	wo.GET("", h.ListWorkOrders)
	wo.POST("", h.CreateWorkOrder)
	wo.GET("/:id", h.GetWorkOrder)
	wo.PUT("/:id", h.UpdateWorkOrder)
	wo.POST("/:id/approve", h.ApproveWorkOrder)
	wo.POST("/:id/complete", h.CompleteWorkOrder)

	// Garages
	garages := fleet.Group("/garages")
	garages.GET("", h.ListGarages)
	garages.POST("", h.CreateGarage)
	garages.PUT("/:id", h.UpdateGarage)
	garages.POST("/:id/rate", h.RateGarage)
	garages.GET("/benchmark", h.GarageBenchmark)

	// Fuel Logs
	fuel := fleet.Group("/fuel-logs")
	fuel.GET("", h.ListFuelLogs)
	fuel.POST("", h.CreateFuelLog)
	fuel.GET("/anomalies", h.ListFuelAnomalies)
	fuel.PUT("/anomalies/:id/resolve", h.ResolveFuelAnomaly)

	// Tires
	tyres := fleet.Group("/tyres")
	tyres.GET("/:vehicle_id", h.ListTireSets)
	tyres.POST("", h.CreateTireSet)
	tyres.PUT("/:id", h.UpdateTireSet)

	// Health
	fleet.GET("/vehicles/:id/health", h.GetVehicleHealth)
	fleet.GET("/health-overview", h.HealthOverview)

	// TCO / Analytics
	fleet.GET("/tco/:vehicle_id", h.GetVehicleTCO)
	fleet.GET("/tco/summary", h.GetFleetTCOSummary)
	fleet.GET("/analytics/cost", h.GetCostAnalytics)

	// Driver endpoints (open to more roles)
	drivers := r.Group("/drivers")
	drivers.Use(middleware.RequireRole("admin", "dispatcher", "driver", "management"))

	drivers.GET("/:id/scorecard", h.GetDriverScorecard)
	drivers.GET("/leaderboard", h.GetLeaderboard)
	drivers.GET("/:id/badges", h.GetDriverBadges)
	drivers.GET("/gamification/bonus-report", h.GetBonusReport)
	drivers.POST("/:id/leave-requests", h.CreateLeaveRequest)
	drivers.GET("/:id/leave-requests", h.ListDriverLeaveRequests)
	drivers.PUT("/leave-requests/:id/approve", h.ApproveLeaveRequest)
	drivers.GET("/:id/fuel-logs", h.ListDriverFuelLogs)
}

// ─── Work Orders ───

func (h *Handler) CreateWorkOrder(c *gin.Context) {
	var req CreateWorkOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	wo, err := h.svc.CreateWorkOrder(c.Request.Context(), req, userID)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "WO_CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, wo)
}

func (h *Handler) GetWorkOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid work order ID")
		return
	}
	wo, err := h.svc.GetWorkOrder(c.Request.Context(), id)
	if err != nil {
		response.Err(c, http.StatusNotFound, "WO_NOT_FOUND", err.Error())
		return
	}
	response.OK(c, wo)
}

func (h *Handler) ListWorkOrders(c *gin.Context) {
	filter := WOFilter{
		Status:   c.Query("status"),
		Category: c.Query("category"),
	}
	if v := c.Query("vehicle_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.VehicleID = &id
		}
	}
	if v := c.Query("limit"); v != "" {
		filter.Limit, _ = strconv.Atoi(v)
	}
	if v := c.Query("offset"); v != "" {
		filter.Offset, _ = strconv.Atoi(v)
	}

	list, total, err := h.svc.ListWorkOrders(c.Request.Context(), filter)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "WO_LIST_FAILED", err.Error())
		return
	}
	response.OKWithMeta(c, list, gin.H{"total": total})
}

func (h *Handler) UpdateWorkOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid work order ID")
		return
	}
	var fields map[string]interface{}
	if err := c.ShouldBindJSON(&fields); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	if err := h.svc.UpdateWorkOrder(c.Request.Context(), id, fields); err != nil {
		response.Err(c, http.StatusInternalServerError, "WO_UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"updated": true})
}

func (h *Handler) ApproveWorkOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid work order ID")
		return
	}
	var req ApproveWORequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	if err := h.svc.ApproveWorkOrder(c.Request.Context(), id, userID, req); err != nil {
		response.Err(c, http.StatusBadRequest, "WO_APPROVE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"approved": req.Approved})
}

func (h *Handler) CompleteWorkOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid work order ID")
		return
	}
	var req CompleteWORequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	if err := h.svc.CompleteWorkOrder(c.Request.Context(), id, req); err != nil {
		response.Err(c, http.StatusBadRequest, "WO_COMPLETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"completed": true})
}

// ─── Garages ───

func (h *Handler) ListGarages(c *gin.Context) {
	includeBlacklisted := c.Query("include_blacklisted") == "true"
	list, err := h.svc.ListGarages(c.Request.Context(), includeBlacklisted)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "GARAGE_LIST_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

func (h *Handler) CreateGarage(c *gin.Context) {
	var req CreateGarageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	g, err := h.svc.CreateGarage(c.Request.Context(), req, userID)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "GARAGE_CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, g)
}

func (h *Handler) UpdateGarage(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid garage ID")
		return
	}
	var req UpdateGarageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	if err := h.svc.UpdateGarage(c.Request.Context(), id, req); err != nil {
		response.Err(c, http.StatusInternalServerError, "GARAGE_UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"updated": true})
}

func (h *Handler) RateGarage(c *gin.Context) {
	garageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid garage ID")
		return
	}
	var req RateGarageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	if err := h.svc.RateGarage(c.Request.Context(), garageID, req, userID); err != nil {
		response.Err(c, http.StatusInternalServerError, "RATE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"rated": true})
}

func (h *Handler) GarageBenchmark(c *gin.Context) {
	list, err := h.svc.GetGarageBenchmark(c.Request.Context())
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "BENCHMARK_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

// ─── Fuel Logs ───

func (h *Handler) ListFuelLogs(c *gin.Context) {
	filter := FuelLogFilter{
		AnomalyOnly: c.Query("anomaly_only") == "true",
	}
	if v := c.Query("vehicle_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.VehicleID = &id
		}
	}
	if v := c.Query("driver_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.DriverID = &id
		}
	}
	if v := c.Query("limit"); v != "" {
		filter.Limit, _ = strconv.Atoi(v)
	}
	if v := c.Query("offset"); v != "" {
		filter.Offset, _ = strconv.Atoi(v)
	}

	list, total, err := h.svc.ListFuelLogs(c.Request.Context(), filter)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "FUEL_LIST_FAILED", err.Error())
		return
	}
	response.OKWithMeta(c, list, gin.H{"total": total})
}

func (h *Handler) CreateFuelLog(c *gin.Context) {
	var req CreateFuelLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	fl, err := h.svc.CreateFuelLog(c.Request.Context(), req, userID)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "FUEL_CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, fl)
}

func (h *Handler) ListFuelAnomalies(c *gin.Context) {
	status := c.Query("status")
	list, err := h.svc.ListFuelAnomalies(c.Request.Context(), status)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "ANOMALY_LIST_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

func (h *Handler) ResolveFuelAnomaly(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid anomaly ID")
		return
	}
	var req ResolveFuelAnomalyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	if err := h.svc.ResolveFuelAnomaly(c.Request.Context(), id, req, userID); err != nil {
		response.Err(c, http.StatusInternalServerError, "RESOLVE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"resolved": true})
}

// ─── Tires ───

func (h *Handler) ListTireSets(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("vehicle_id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid vehicle ID")
		return
	}
	list, err := h.svc.ListTireSets(c.Request.Context(), vehicleID)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "TIRE_LIST_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

func (h *Handler) CreateTireSet(c *gin.Context) {
	var req CreateTireSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	ts, err := h.svc.CreateTireSet(c.Request.Context(), req, userID)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "TIRE_CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, ts)
}

func (h *Handler) UpdateTireSet(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid tire set ID")
		return
	}
	var req UpdateTireSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	if err := h.svc.UpdateTireSet(c.Request.Context(), id, req); err != nil {
		response.Err(c, http.StatusInternalServerError, "TIRE_UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"updated": true})
}

// ─── Health ───

func (h *Handler) GetVehicleHealth(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid vehicle ID")
		return
	}
	vhd, err := h.svc.GetVehicleHealth(c.Request.Context(), vehicleID)
	if err != nil {
		response.Err(c, http.StatusNotFound, "VEHICLE_NOT_FOUND", err.Error())
		return
	}
	response.OK(c, vhd)
}

func (h *Handler) HealthOverview(c *gin.Context) {
	list, err := h.svc.ListAllVehiclesHealth(c.Request.Context())
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "HEALTH_OVERVIEW_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

// ─── TCO / Analytics ───

func (h *Handler) GetVehicleTCO(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("vehicle_id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid vehicle ID")
		return
	}
	months, _ := strconv.Atoi(c.DefaultQuery("months", "12"))
	tco, err := h.svc.GetVehicleTCO(c.Request.Context(), vehicleID, months)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "TCO_FAILED", err.Error())
		return
	}
	response.OK(c, tco)
}

func (h *Handler) GetFleetTCOSummary(c *gin.Context) {
	months, _ := strconv.Atoi(c.DefaultQuery("months", "12"))
	list, err := h.svc.GetFleetTCOSummary(c.Request.Context(), months)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "TCO_SUMMARY_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetCostAnalytics(c *gin.Context) {
	months, _ := strconv.Atoi(c.DefaultQuery("months", "12"))
	data, err := h.svc.GetCostAnalytics(c.Request.Context(), months)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "ANALYTICS_FAILED", err.Error())
		return
	}
	response.OK(c, data)
}

// ─── Driver Endpoints ───

func (h *Handler) GetDriverScorecard(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid driver ID")
		return
	}
	sc, err := h.svc.GetDriverScorecard(c.Request.Context(), driverID)
	if err != nil {
		response.Err(c, http.StatusNotFound, "SCORECARD_NOT_FOUND", err.Error())
		return
	}
	response.OK(c, sc)
}

func (h *Handler) GetLeaderboard(c *gin.Context) {
	period := c.DefaultQuery("period", "week")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	list, err := h.svc.GetLeaderboard(c.Request.Context(), period, limit)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "LEADERBOARD_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetDriverBadges(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid driver ID")
		return
	}
	list, err := h.svc.GetDriverBadges(c.Request.Context(), driverID)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "BADGES_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetBonusReport(c *gin.Context) {
	month := c.Query("month")
	if month == "" {
		response.Err(c, http.StatusBadRequest, "MISSING_MONTH", "month parameter required (YYYY-MM-01)")
		return
	}
	list, err := h.svc.GetBonusReport(c.Request.Context(), month)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "BONUS_REPORT_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

func (h *Handler) CreateLeaveRequest(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid driver ID")
		return
	}
	var req CreateLeaveRequestReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	lr, err := h.svc.CreateLeaveRequest(c.Request.Context(), driverID, req)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "LEAVE_CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, lr)
}

func (h *Handler) ListDriverLeaveRequests(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid driver ID")
		return
	}
	status := c.Query("status")
	list, err := h.svc.ListLeaveRequests(c.Request.Context(), &driverID, status)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "LEAVE_LIST_FAILED", err.Error())
		return
	}
	response.OK(c, list)
}

func (h *Handler) ApproveLeaveRequest(c *gin.Context) {
	leaveID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid leave request ID")
		return
	}
	var req ApproveLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	if err := h.svc.ApproveLeaveRequest(c.Request.Context(), leaveID, userID, req); err != nil {
		response.Err(c, http.StatusInternalServerError, "LEAVE_APPROVE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"processed": true})
}

func (h *Handler) ListDriverFuelLogs(c *gin.Context) {
	driverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Err(c, http.StatusBadRequest, "INVALID_ID", "invalid driver ID")
		return
	}
	filter := FuelLogFilter{DriverID: &driverID}
	if v := c.Query("limit"); v != "" {
		filter.Limit, _ = strconv.Atoi(v)
	}
	if v := c.Query("offset"); v != "" {
		filter.Offset, _ = strconv.Atoi(v)
	}

	list, total, err := h.svc.ListFuelLogs(c.Request.Context(), filter)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "FUEL_LIST_FAILED", err.Error())
		return
	}
	response.OKWithMeta(c, list, gin.H{"total": total})
}
