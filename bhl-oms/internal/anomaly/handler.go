package anomaly

import (
	"errors"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler exposes /v1/anomalies/* endpoints.
type Handler struct {
	svc *Service
	log logger.Logger
}

func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// RegisterRoutes mounts under the protected (JWT) router group.
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/anomalies")
	{
		g.GET("", h.List)
		g.PATCH("/:id/ack", h.Acknowledge)
		g.PATCH("/:id/resolve", h.Resolve)
	}
}

// GET /v1/anomalies?status=open&limit=100
func (h *Handler) List(c *gin.Context) {
	status := c.Query("status")
	limit := 100
	if v := c.Query("limit"); v != "" {
		// best-effort
		if n, err := parseLimit(v); err == nil {
			limit = n
		}
	}

	items, err := h.svc.List(c.Request.Context(), status, limit)
	if err != nil {
		h.log.Error(c.Request.Context(), "anomalies_list_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, items)
}

// PATCH /v1/anomalies/:id/ack
func (h *Handler) Acknowledge(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}
	uid := middleware.GetUserID(c)
	if uid == uuid.Nil {
		response.Unauthorized(c, "Phiên không hợp lệ")
		return
	}
	if err := h.svc.Acknowledge(c.Request.Context(), id, uid); err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(c, "Không tìm thấy cảnh báo hoặc cảnh báo đã được xử lý")
			return
		}
		h.log.Error(c.Request.Context(), "anomaly_ack_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"acknowledged": true})
}

// PATCH /v1/anomalies/:id/resolve
type resolveReq struct {
	Note          string `json:"note"`
	FalsePositive bool   `json:"false_positive"`
}

func (h *Handler) Resolve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}
	uid := middleware.GetUserID(c)
	if uid == uuid.Nil {
		response.Unauthorized(c, "Phiên không hợp lệ")
		return
	}
	var req resolveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		// allow empty body
		req = resolveReq{}
	}
	if err := h.svc.Resolve(c.Request.Context(), id, uid, req.Note, req.FalsePositive); err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(c, "Không tìm thấy cảnh báo hoặc đã đóng")
			return
		}
		h.log.Error(c.Request.Context(), "anomaly_resolve_failed", err)
		response.InternalError(c)
		return
	}
	resolved := "resolved"
	if req.FalsePositive {
		resolved = "false_positive"
	}
	response.OK(c, gin.H{"status": resolved})
}

func parseLimit(v string) (int, error) {
	n := 0
	for _, ch := range v {
		if ch < '0' || ch > '9' {
			return 0, errors.New("invalid")
		}
		n = n*10 + int(ch-'0')
		if n > 500 {
			return 500, nil
		}
	}
	if n == 0 {
		return 100, nil
	}
	return n, nil
}
