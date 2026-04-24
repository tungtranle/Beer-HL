package tms

import (
	"net/http"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ===== TOLL STATIONS =====

func (h *Handler) ListTollStations(c *gin.Context) {
	stations, err := h.svc.repo.ListTollStations(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, stations)
}

func (h *Handler) CreateTollStation(c *gin.Context) {
	var s domain.TollStation
	if err := c.ShouldBindJSON(&s); err != nil {
		response.BadRequest(c, "Dữ liệu trạm thu phí không hợp lệ")
		return
	}
	if err := h.svc.repo.CreateTollStation(c.Request.Context(), &s); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, s)
}

func (h *Handler) UpdateTollStation(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID trạm thu phí không hợp lệ")
		return
	}
	var s domain.TollStation
	if err := c.ShouldBindJSON(&s); err != nil {
		response.BadRequest(c, "Dữ liệu trạm thu phí không hợp lệ")
		return
	}
	s.ID = id
	if err := h.svc.repo.UpdateTollStation(c.Request.Context(), &s); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, s)
}

func (h *Handler) DeleteTollStation(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID trạm thu phí không hợp lệ")
		return
	}
	if err := h.svc.repo.DeleteTollStation(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã xoá trạm thu phí"})
}

// ===== TOLL EXPRESSWAYS =====

func (h *Handler) ListTollExpressways(c *gin.Context) {
	expressways, err := h.svc.repo.ListTollExpressways(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, expressways)
}

func (h *Handler) CreateTollExpressway(c *gin.Context) {
	var e domain.TollExpressway
	if err := c.ShouldBindJSON(&e); err != nil {
		response.BadRequest(c, "Dữ liệu cao tốc không hợp lệ")
		return
	}
	if err := h.svc.repo.CreateTollExpressway(c.Request.Context(), &e); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, e)
}

func (h *Handler) UpdateTollExpressway(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID cao tốc không hợp lệ")
		return
	}
	var e domain.TollExpressway
	if err := c.ShouldBindJSON(&e); err != nil {
		response.BadRequest(c, "Dữ liệu cao tốc không hợp lệ")
		return
	}
	e.ID = id
	if err := h.svc.repo.UpdateTollExpressway(c.Request.Context(), &e); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, e)
}

func (h *Handler) DeleteTollExpressway(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID cao tốc không hợp lệ")
		return
	}
	if err := h.svc.repo.DeleteTollExpressway(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã xoá cao tốc"})
}

// ===== TOLL EXPRESSWAY GATES =====

func (h *Handler) CreateTollExpresswayGate(c *gin.Context) {
	ewID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID cao tốc không hợp lệ")
		return
	}
	var g domain.TollExpresswayGate
	if err := c.ShouldBindJSON(&g); err != nil {
		response.BadRequest(c, "Dữ liệu cổng thu phí không hợp lệ")
		return
	}
	g.ExpresswayID = ewID
	if g.GateType == "" {
		g.GateType = "entry_exit"
	}
	if g.DetectionRadiusM == 0 {
		g.DetectionRadiusM = 300
	}
	g.IsActive = true
	if err := h.svc.repo.CreateTollExpresswayGate(c.Request.Context(), &g); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, g)
}

func (h *Handler) DeleteTollExpresswayGate(c *gin.Context) {
	gateID, err := uuid.Parse(c.Param("gateId"))
	if err != nil {
		response.BadRequest(c, "ID cổng thu phí không hợp lệ")
		return
	}
	if err := h.svc.repo.DeleteTollExpresswayGate(c.Request.Context(), gateID); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã xoá cổng thu phí"})
}

// ===== VEHICLE TYPE COST DEFAULTS =====

func (h *Handler) ListVehicleTypeCostDefaults(c *gin.Context) {
	defaults, err := h.svc.repo.ListVehicleTypeCostDefaults(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, defaults)
}

func (h *Handler) UpdateVehicleTypeCostDefault(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}
	var d domain.VehicleTypeCostDefault
	if err := c.ShouldBindJSON(&d); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}
	d.ID = id
	if err := h.svc.repo.UpdateVehicleTypeCostDefault(c.Request.Context(), &d); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, d)
}

// ===== VEHICLE COST PROFILES =====

func (h *Handler) GetVehicleCostProfile(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID phương tiện không hợp lệ")
		return
	}
	profile, err := h.svc.repo.GetVehicleCostProfile(c.Request.Context(), vehicleID)
	if err != nil {
		response.NotFound(c, "Chưa có cấu hình chi phí riêng")
		return
	}
	response.OK(c, profile)
}

func (h *Handler) UpsertVehicleCostProfile(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID phương tiện không hợp lệ")
		return
	}
	var p domain.VehicleCostProfile
	if err := c.ShouldBindJSON(&p); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}
	p.VehicleID = vehicleID
	if err := h.svc.repo.UpsertVehicleCostProfile(c.Request.Context(), &p); err != nil {
		response.Err(c, http.StatusBadRequest, "UPSERT_FAILED", err.Error())
		return
	}
	response.OK(c, p)
}

func (h *Handler) DeleteVehicleCostProfile(c *gin.Context) {
	vehicleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID phương tiện không hợp lệ")
		return
	}
	if err := h.svc.repo.DeleteVehicleCostProfile(c.Request.Context(), vehicleID); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã xoá cấu hình chi phí riêng"})
}

// ===== DRIVER COST RATES =====

func (h *Handler) ListDriverCostRates(c *gin.Context) {
	rates, err := h.svc.repo.ListDriverCostRates(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, rates)
}

func (h *Handler) CreateDriverCostRate(c *gin.Context) {
	var rate domain.DriverCostRate
	if err := c.ShouldBindJSON(&rate); err != nil {
		response.BadRequest(c, "Dữ liệu phụ phí tài xế không hợp lệ")
		return
	}
	if err := h.svc.repo.CreateDriverCostRate(c.Request.Context(), &rate); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, rate)
}

func (h *Handler) UpdateDriverCostRate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}
	var rate domain.DriverCostRate
	if err := c.ShouldBindJSON(&rate); err != nil {
		response.BadRequest(c, "Dữ liệu phụ phí tài xế không hợp lệ")
		return
	}
	rate.ID = id
	if err := h.svc.repo.UpdateDriverCostRate(c.Request.Context(), &rate); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, rate)
}

func (h *Handler) DeleteDriverCostRate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}
	if err := h.svc.repo.DeleteDriverCostRate(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã xoá phụ phí tài xế"})
}

// ===== COST READINESS CHECK =====

// GetCostReadiness returns cost data availability for the planning page.
// Frontend uses this to: auto-select cost optimization mode, show readiness status.
func (h *Handler) GetCostReadiness(c *gin.Context) {
	ctx := c.Request.Context()

	tollStations, _ := h.svc.repo.ListActiveTollStations(ctx)
	expressways, _ := h.svc.repo.ListActiveTollExpressways(ctx)
	vehicleDefaults, _ := h.svc.repo.ListVehicleTypeCostDefaults(ctx)
	driverRates, _ := h.svc.repo.ListDriverCostRates(ctx)

	tollCount := len(tollStations)
	expresswayCount := len(expressways)
	vehicleDefaultCount := 0
	for _, d := range vehicleDefaults {
		if d.FuelConsumptionPerKm > 0 {
			vehicleDefaultCount++
		}
	}
	driverRateCount := len(driverRates)

	// Cost optimization is ready if we have at least vehicle fuel data
	ready := vehicleDefaultCount > 0

	response.OK(c, gin.H{
		"ready":                 ready,
		"toll_station_count":    tollCount,
		"expressway_count":      expresswayCount,
		"vehicle_default_count": vehicleDefaultCount,
		"driver_rate_count":     driverRateCount,
		"details": gin.H{
			"has_toll_data":    tollCount > 0 || expresswayCount > 0,
			"has_vehicle_cost": vehicleDefaultCount > 0,
			"has_driver_rates": driverRateCount > 0,
		},
	})
}
