package events

import (
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	recorder *Recorder
	log      logger.Logger
}

func NewHandler(recorder *Recorder, log logger.Logger) *Handler {
	return &Handler{recorder: recorder, log: log}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// Order timeline
	r.GET("/orders/:id/timeline", h.GetOrderTimeline)
	r.GET("/orders/:id/notes", h.GetOrderNotes)
	r.POST("/orders/:id/notes", h.AddOrderNote)
	r.PUT("/orders/:id/notes/:noteId/pin", h.PinNote)
	r.DELETE("/orders/:id/notes/:noteId/pin", h.UnpinNote)
}

// GET /v1/orders/:id/timeline
func (h *Handler) GetOrderTimeline(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	events, err := h.recorder.GetTimeline(c.Request.Context(), "order", orderID, 100)
	if err != nil {
		h.log.Error(c.Request.Context(), "get_timeline_failed", err, logger.F("order_id", orderID.String()))
		response.InternalError(c)
		return
	}

	response.OK(c, events)
}

// GET /v1/orders/:id/notes
func (h *Handler) GetOrderNotes(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	notes, err := h.recorder.GetNotes(c.Request.Context(), orderID)
	if err != nil {
		h.log.Error(c.Request.Context(), "get_notes_failed", err, logger.F("order_id", orderID.String()))
		response.InternalError(c)
		return
	}

	response.OK(c, notes)
}

// POST /v1/orders/:id/notes
func (h *Handler) AddOrderNote(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	var body struct {
		Content  string `json:"content"`
		NoteType string `json:"note_type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Content == "" {
		response.BadRequest(c, "Nội dung ghi chú không được để trống")
		return
	}

	// Validate note_type
	validTypes := map[string]bool{"internal": true, "npp_feedback": true, "driver_note": true, "system": true}
	if body.NoteType == "" {
		body.NoteType = "internal"
	}
	if !validTypes[body.NoteType] {
		response.BadRequest(c, "Loại ghi chú không hợp lệ")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)
	fullName, _ := c.Get("full_name")
	userName, _ := fullName.(string)
	if userName == "" {
		userName = "System"
	}

	note, err := h.recorder.AddNote(c.Request.Context(), orderID, uid, userName, body.Content, body.NoteType)
	if err != nil {
		h.log.Error(c.Request.Context(), "add_note_failed", err, logger.F("order_id", orderID.String()))
		response.InternalError(c)
		return
	}

	// Also record as an event in the timeline
	h.recorder.RecordAsync(OrderNoteEvent(orderID, &uid, userName, body.Content, body.NoteType))

	response.Created(c, note)
}

// PUT /v1/orders/:id/notes/:noteId/pin
func (h *Handler) PinNote(c *gin.Context) {
	noteID, err := uuid.Parse(c.Param("noteId"))
	if err != nil {
		response.BadRequest(c, "Invalid note ID")
		return
	}
	if err := h.recorder.SetNotePin(c.Request.Context(), noteID, true); err != nil {
		h.log.Error(c.Request.Context(), "pin_note_failed", err, logger.F("note_id", noteID.String()))
		response.InternalError(c)
		return
	}
	response.OK(c, map[string]bool{"pinned": true})
}

// DELETE /v1/orders/:id/notes/:noteId/pin
func (h *Handler) UnpinNote(c *gin.Context) {
	noteID, err := uuid.Parse(c.Param("noteId"))
	if err != nil {
		response.BadRequest(c, "Invalid note ID")
		return
	}
	if err := h.recorder.SetNotePin(c.Request.Context(), noteID, false); err != nil {
		h.log.Error(c.Request.Context(), "unpin_note_failed", err, logger.F("note_id", noteID.String()))
		response.InternalError(c)
		return
	}
	response.OK(c, map[string]bool{"pinned": false})
}
