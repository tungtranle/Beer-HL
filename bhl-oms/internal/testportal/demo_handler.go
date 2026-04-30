package testportal

import (
	"strconv"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ListDemoScenarios(c *gin.Context) {
	response.OK(c, gin.H{
		"scenarios": h.demoSvc.ListScenarios(),
		"credentials": gin.H{
			"username": "qa.demo",
			"password": "demo123",
			"role":     "management",
		},
		"safety": gin.H{
			"mode":                    "scenario_run_scope_only",
			"historical_rows_touched": 0,
			"forbid_truncate":         true,
			"ownership_registry":      "qa_owned_entities",
		},
	})
}

func (h *Handler) ListDemoRuns(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	runs, err := h.demoSvc.ListRuns(c.Request.Context(), limit)
	if err != nil {
		h.log.Error(c.Request.Context(), "qa_demo_runs_list_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, runs)
}

func (h *Handler) LoadDemoScenario(c *gin.Context) {
	actor := DemoActor{UserID: middleware.GetUserID(c), FullName: middleware.GetFullName(c)}
	result, err := h.demoSvc.RunScenario(c.Request.Context(), c.Param("id"), actor)
	if err != nil {
		h.log.Warn(c.Request.Context(), "qa_demo_scenario_load_failed", logger.F("scenario", c.Param("id")), logger.F("err", err.Error()))
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, result)
}

func (h *Handler) CleanupDemoScenario(c *gin.Context) {
	result, err := h.demoSvc.CleanupScenario(c.Request.Context(), c.Param("id"))
	if err != nil {
		h.log.Warn(c.Request.Context(), "qa_demo_scenario_cleanup_failed", logger.F("scenario", c.Param("id")), logger.F("err", err.Error()))
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, result)
}
