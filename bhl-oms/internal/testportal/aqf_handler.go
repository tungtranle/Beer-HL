package testportal

// aqf_handler.go — HTTP handlers for AQF Command Center
//
// Routes (registered by handler.go):
//   GET  /v1/test-portal/aqf/status          Full AQF status (golden + health + brief)
//   POST /v1/test-portal/aqf/run             Run full QA and save evidence
//   GET  /v1/test-portal/aqf/health          Business health snapshot
//   GET  /v1/test-portal/aqf/golden          Golden dataset results only
//   GET  /v1/test-portal/aqf/evidence        Evidence log (last 20 runs)
//   GET  /v1/test-portal/aqf/questions       Open questions
//   POST /v1/test-portal/aqf/answer          Answer an open question

import (
	"time"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
)

// GET /v1/test-portal/aqf/status
// Returns the full AQF status snapshot including golden results, business health,
// decision brief, and recent evidence log. Uses cached results if < 5 minutes old.
func (h *Handler) AQFStatus(c *gin.Context) {
	ctx := c.Request.Context()

	goldenResults := h.RunGoldenValidation()
	health := h.GetBusinessHealth(ctx)
	brief := h.ComputeDecisionBrief(goldenResults, health)
	evidenceLog := h.LoadEvidenceLog(10)
	openQuestions := loadOpenQuestions()

	now := time.Now()
	resp := AQFStatusResponse{
		LastRunAt:     &now,
		Brief:         brief,
		GoldenResults: goldenResults,
		Health:        health,
		EvidenceLog:   evidenceLog,
		OpenQuestions: openQuestions,
	}

	response.OK(c, resp)
}

// POST /v1/test-portal/aqf/run
// Runs full QA suite, persists evidence, and returns the decision brief.
func (h *Handler) AQFRun(c *gin.Context) {
	ctx := c.Request.Context()

	goldenResults := h.RunGoldenValidation()
	health := h.GetBusinessHealth(ctx)
	brief := h.ComputeDecisionBrief(goldenResults, health)

	h.SaveEvidence(brief, goldenResults)

	resp := gin.H{
		"brief":          brief,
		"golden_results": goldenResults,
		"health":         health,
		"saved":          true,
	}

	response.OK(c, resp)
}

// GET /v1/test-portal/aqf/golden
// Runs and returns only the golden dataset validation results.
func (h *Handler) AQFGolden(c *gin.Context) {
	results := h.RunGoldenValidation()
	response.OK(c, results)
}

// GET /v1/test-portal/aqf/health
// Returns live business health metrics from DB and Redis.
func (h *Handler) AQFHealth(c *gin.Context) {
	ctx := c.Request.Context()
	health := h.GetBusinessHealth(ctx)
	response.OK(c, health)
}

// GET /v1/test-portal/aqf/evidence
// Returns the last 20 evidence records from aqf/evidence/.
func (h *Handler) AQFEvidence(c *gin.Context) {
	records := h.LoadEvidenceLog(20)
	response.OK(c, records)
}

// GET /v1/test-portal/aqf/questions
// Returns current open questions and their answers.
func (h *Handler) AQFQuestions(c *gin.Context) {
	qs := loadOpenQuestions()
	response.OK(c, qs)
}

// POST /v1/test-portal/aqf/answer
// Answer an open question. Body: {"id": "Q-BHL-001", "answer": "yes"}
func (h *Handler) AQFAnswer(c *gin.Context) {
	var req struct {
		ID     string `json:"id" binding:"required"`
		Answer string `json:"answer" binding:"required"` // yes | no | defer
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "id và answer là bắt buộc")
		return
	}

	validAnswers := map[string]bool{"yes": true, "no": true, "defer": true}
	if !validAnswers[req.Answer] {
		response.BadRequest(c, "answer phải là: yes | no | defer")
		return
	}

	qs := loadOpenQuestions()
	found := false
	now := time.Now()
	for i, q := range qs {
		if q.ID == req.ID {
			qs[i].Answer = req.Answer
			qs[i].AnsweredAt = &now
			found = true
			break
		}
	}

	if !found {
		response.BadRequest(c, "Không tìm thấy question ID: "+req.ID)
		return
	}

	if err := saveOpenQuestions(qs); err != nil {
		response.InternalError(c)
		return
	}

	response.OK(c, gin.H{"id": req.ID, "answer": req.Answer, "saved": true})
}
