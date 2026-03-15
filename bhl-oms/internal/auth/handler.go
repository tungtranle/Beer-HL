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

	user, tokens, err := h.svc.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
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
