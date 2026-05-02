package notification

import (
	"net/http"
	"strconv"
	"time"

	"bhl-oms/internal/auth"
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Handler struct {
	svc     *Service
	hub     *Hub
	authSvc *auth.Service
	log     logger.Logger
}

func NewHandler(svc *Service, hub *Hub, authSvc *auth.Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, hub: hub, authSvc: authSvc, log: log}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	ng := r.Group("/notifications")
	{
		ng.GET("", h.List)
		ng.GET("/unread-count", h.UnreadCount)
		ng.GET("/grouped", h.ListGrouped)
		ng.POST("/:id/read", h.MarkRead)
		ng.POST("/read-all", h.MarkAllRead)
		ng.POST("/:id/acknowledge", h.Acknowledge)
	}
}

// RegisterWebSocket adds the notification WebSocket route (no auth middleware — token in query).
func (h *Handler) RegisterWebSocket(r *gin.RouterGroup) {
	r.GET("/ws/notifications", h.HandleWebSocket)
}

// GET /v1/notifications
func (h *Handler) List(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	unreadOnly := c.Query("unread") == "true"
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	results, total, err := h.svc.GetNotificationsPaginated(c.Request.Context(), uid, unreadOnly, category, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}
	response.OKWithMeta(c, results, response.PaginationMeta{
		Page: page, Limit: limit, Total: total, TotalPages: totalPages,
	})
}

// GET /v1/notifications/unread-count
func (h *Handler) UnreadCount(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	count, err := h.svc.UnreadCount(c.Request.Context(), uid)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"unread_count": count})
}

// GET /v1/notifications/grouped
func (h *Handler) ListGrouped(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	groups, err := h.svc.GetGroupedNotifications(c.Request.Context(), uid, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, groups)
}

// POST /v1/notifications/:id/read
func (h *Handler) MarkRead(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid notification ID")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	if err := h.svc.MarkRead(c.Request.Context(), id, uid); err != nil {
		response.NotFound(c, "Notification not found")
		return
	}
	response.OK(c, gin.H{"status": "read"})
}

// POST /v1/notifications/:id/acknowledge
// Marks a P0 notification as acknowledged (action taken). Stops escalation timer.
func (h *Handler) Acknowledge(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid notification ID")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	if err := h.svc.Acknowledge(c.Request.Context(), id, uid); err != nil {
		response.NotFound(c, "Notification not found")
		return
	}
	response.OK(c, gin.H{"status": "acknowledged"})
}

// POST /v1/notifications/read-all
func (h *Handler) MarkAllRead(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	count, err := h.svc.MarkAllRead(c.Request.Context(), uid)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"marked_read": count})
}

var notifUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// HandleWebSocket upgrades to WS for real-time notification push.
// Authenticates via ?token= query parameter.
func (h *Handler) HandleWebSocket(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		response.Unauthorized(c, "token required")
		return
	}

	claims, err := h.authSvc.ValidateToken(token)
	if err != nil {
		response.Unauthorized(c, "invalid token")
		return
	}

	conn, err := notifUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	userID := claims.UserID
	ch := make(chan []byte, 64)
	h.hub.Register(userID, ch)
	defer h.hub.Unregister(userID, ch)

	// Ping ticker
	ticker := time.NewTicker(50 * time.Second)
	defer ticker.Stop()

	// Read pump (just drain messages)
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				close(ch)
				return
			}
		}
	}()

	for {
		select {
		case msg, ok := <-ch:
			if !ok {
				return
			}
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
