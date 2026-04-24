package tms

import (
	"encoding/json"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type saveScenarioRequest struct {
	WarehouseID  uuid.UUID       `json:"warehouse_id" binding:"required"`
	DeliveryDate string          `json:"delivery_date" binding:"required"`
	ScenarioName string          `json:"scenario_name"`
	JobID        string          `json:"job_id" binding:"required"`
	CriteriaJSON json.RawMessage `json:"criteria_json"`
	Notes        *string         `json:"notes"`
}

func (h *Handler) SaveVRPScenario(c *gin.Context) {
	var req saveScenarioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request: "+err.Error())
		return
	}

	// Load VRP result from job cache
	result, err := h.svc.GetVRPResult(req.JobID)
	if err != nil {
		response.NotFound(c, "VRP result not found — run VRP first")
		return
	}

	// Serialize full result
	resultBytes, _ := json.Marshal(result)
	resultRaw := json.RawMessage(resultBytes)

	// Get user from context
	userID, _ := c.Get("user_id")
	var createdBy *uuid.UUID
	if uid, ok := userID.(string); ok {
		if parsed, err := uuid.Parse(uid); err == nil {
			createdBy = &parsed
		}
	}

	summary := result.Summary
	assigned := summary.TotalShipmentsAssigned
	total := assigned + summary.TotalUnassigned
	servicePct := 100.0
	if total > 0 {
		servicePct = float64(assigned) / float64(total) * 100
	}

	scenario := &domain.VRPScenario{
		ID:                    uuid.New(),
		WarehouseID:           req.WarehouseID,
		DeliveryDate:          req.DeliveryDate,
		ScenarioName:          req.ScenarioName,
		VehicleCount:          summary.TotalVehicles,
		ShipmentCount:         total,
		CriteriaJSON:          req.CriteriaJSON,
		TotalTrips:            summary.TotalTrips,
		TotalDistanceKm:       summary.TotalDistanceKm,
		TotalDurationMin:      summary.TotalDurationMin,
		TotalWeightKg:         summary.TotalWeightKg,
		TotalCostVND:          summary.TotalCostVND,
		TotalFuelCostVND:      summary.TotalFuelCostVND,
		TotalTollCostVND:      summary.TotalTollCostVND,
		TotalDriverCostVND:    summary.TotalDriverCost,
		AvgCapacityUtilPct:    summary.AvgCapacityUtil,
		AvgCostPerTonVND:      summary.AvgCostPerTonVND,
		AvgCostPerKmVND:       summary.AvgCostPerKmVND,
		AvgCostPerShipmentVND: summary.AvgCostPerShipment,
		TollCostRatioPct:      summary.TollCostRatioPct,
		UnassignedCount:       summary.TotalUnassigned,
		SolveTimeMs:           summary.SolveTimeMs,
		ServiceLevelPct:       servicePct,
		ResultJSON:            &resultRaw,
		CreatedBy:             createdBy,
		Notes:                 req.Notes,
	}

	if err := h.svc.repo.SaveVRPScenario(c.Request.Context(), scenario); err != nil {
		response.Err(c, 500, "SAVE_FAILED", "save failed: "+err.Error())
		return
	}

	// Return without result_json (too large for list)
	scenario.ResultJSON = nil
	response.OK(c, scenario)
}

func (h *Handler) ListVRPScenarios(c *gin.Context) {
	whID := c.Query("warehouse_id")
	date := c.Query("delivery_date")
	if whID == "" || date == "" {
		response.BadRequest(c, "warehouse_id and delivery_date required")
		return
	}
	wid, err := uuid.Parse(whID)
	if err != nil {
		response.BadRequest(c, "invalid warehouse_id")
		return
	}

	scenarios, err := h.svc.repo.ListVRPScenarios(c.Request.Context(), wid, date)
	if err != nil {
		response.Err(c, 500, "DB_ERROR", err.Error())
		return
	}
	if scenarios == nil {
		scenarios = []domain.VRPScenario{}
	}
	response.OK(c, scenarios)
}

func (h *Handler) GetVRPScenario(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid id")
		return
	}
	s, err := h.svc.repo.GetVRPScenario(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "scenario not found")
		return
	}
	response.OK(c, s)
}

func (h *Handler) DeleteVRPScenario(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid id")
		return
	}
	if err := h.svc.repo.DeleteVRPScenario(c.Request.Context(), id); err != nil {
		response.Err(c, 500, "DB_ERROR", err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": true})
}
