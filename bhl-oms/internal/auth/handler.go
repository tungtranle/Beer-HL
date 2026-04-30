package auth

import (
	"net/http"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	auth := r.Group("/auth")
	auth.POST("/login", h.Login)
	auth.POST("/refresh", h.Refresh)
	auth.POST("/logout", h.Logout)
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Username và password là bắt buộc")
		return
	}

	// HIGH-004: pass client IP for rate-limit
	clientIP := c.ClientIP()
	user, tokens, err := h.svc.Login(c.Request.Context(), req.Username, req.Password, clientIP)
	if err != nil {
		if err.Error() == "too many failed attempts, account temporarily locked" {
			response.Err(c, http.StatusTooManyRequests, "LOGIN_LOCKED", "Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút")
			return
		}
		response.Err(c, http.StatusUnauthorized, "AUTH_FAILED", "Sai tên đăng nhập hoặc mật khẩu")
		return
	}

	response.OK(c, gin.H{
		"tokens": tokens,
		"user": gin.H{
			"id":            user.ID,
			"username":      user.Username,
			"full_name":     user.FullName,
			"role":          user.Role,
			"permissions":   user.Permissions,
			"warehouse_ids": user.WarehouseIDs,
		},
	})
}

// Logout invalidates the caller's access token by adding its JTI to Redis denylist.
// HIGH-006: client must send the access token in Authorization: Bearer <token>.
func (h *Handler) Logout(c *gin.Context) {
	token := extractBearerToken(c)
	if token == "" {
		response.BadRequest(c, "Missing Authorization header")
		return
	}
	if err := h.svc.Logout(c.Request.Context(), token); err != nil {
		// Treat invalid token as success (idempotent logout)
	}
	response.OK(c, gin.H{"message": "Đăng xuất thành công"})
}

func extractBearerToken(c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if len(header) > 7 && header[:7] == "Bearer " {
		return header[7:]
	}
	return ""
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *Handler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Refresh token là bắt buộc")
		return
	}

	tokens, err := h.svc.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, "Refresh token không hợp lệ")
		return
	}

	response.OK(c, tokens)
}
