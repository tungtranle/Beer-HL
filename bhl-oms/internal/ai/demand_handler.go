package ai

import (
	"strconv"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) DemandForecast(c *gin.Context) {
	customerID, err := uuid.Parse(c.Query("customer_id"))
	if err != nil {
		response.Err(c, 400, "INVALID_CUSTOMER", "customer_id không hợp lệ")
		return
	}
	productID, err := uuid.Parse(c.Query("product_id"))
	if err != nil {
		response.Err(c, 400, "INVALID_PRODUCT", "product_id không hợp lệ")
		return
	}
	warehouseID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.Err(c, 400, "INVALID_WAREHOUSE", "warehouse_id không hợp lệ")
		return
	}
	horizonWeeks, _ := strconv.Atoi(c.DefaultQuery("horizon_weeks", "4"))

	forecast, err := h.svc.GetDemandForecast(c.Request.Context(), customerID, productID, warehouseID, horizonWeeks)
	if err != nil {
		response.Err(c, 500, "AI_DEMAND_FORECAST_FAILED", err.Error())
		return
	}
	response.OK(c, forecast)
}

func (h *Handler) OutreachQueue(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "3"))
	items, err := h.svc.ListOutreachQueue(c.Request.Context(), limit)
	if err != nil {
		response.Err(c, 500, "AI_OUTREACH_QUEUE_FAILED", "Không tải được danh sách NPP cần liên hệ")
		return
	}
	response.OK(c, items)
}
