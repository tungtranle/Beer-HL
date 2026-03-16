package admin

import (
	"net/http"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	admin := r.Group("/admin")
	admin.Use(middleware.RequireRole("admin"))

	users := admin.Group("/users")
	users.GET("", h.ListUsers)
	users.GET("/:id", h.GetUser)
	users.POST("", h.CreateUser)
	users.PUT("/:id", h.UpdateUser)
	users.DELETE("/:id", h.DeleteUser)
	users.PUT("/:id/reset-password", h.ResetPassword)

	admin.GET("/roles", h.ListRoles)
}

func (h *Handler) ListUsers(c *gin.Context) {
	users, err := h.svc.ListUsers(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, users)
}

func (h *Handler) GetUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}
	user, err := h.svc.GetUser(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Không tìm thấy người dùng")
		return
	}
	response.OK(c, user)
}

type createUserRequest struct {
	Username     string   `json:"username" binding:"required"`
	FullName     string   `json:"full_name" binding:"required"`
	Password     string   `json:"password" binding:"required,min=6"`
	Role         string   `json:"role" binding:"required"`
	Email        *string  `json:"email"`
	WarehouseIDs []string `json:"warehouse_ids"`
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu thông tin bắt buộc (username, full_name, password, role)")
		return
	}

	if !isValidRole(req.Role) {
		response.BadRequest(c, "Vai trò không hợp lệ")
		return
	}

	var warehouseIDs []uuid.UUID
	for _, wid := range req.WarehouseIDs {
		parsed, err := uuid.Parse(wid)
		if err != nil {
			response.BadRequest(c, "ID kho không hợp lệ: "+wid)
			return
		}
		warehouseIDs = append(warehouseIDs, parsed)
	}

	user, err := h.svc.CreateUser(c.Request.Context(), req.Username, req.FullName, req.Password, req.Role, req.Email, warehouseIDs)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "USER_CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, user)
}

type updateUserRequest struct {
	FullName     *string  `json:"full_name"`
	Role         *string  `json:"role"`
	Email        *string  `json:"email"`
	IsActive     *bool    `json:"is_active"`
	WarehouseIDs []string `json:"warehouse_ids"`
}

func (h *Handler) UpdateUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}

	if req.Role != nil && !isValidRole(*req.Role) {
		response.BadRequest(c, "Vai trò không hợp lệ")
		return
	}

	var warehouseIDs []uuid.UUID
	if req.WarehouseIDs != nil {
		for _, wid := range req.WarehouseIDs {
			parsed, err := uuid.Parse(wid)
			if err != nil {
				response.BadRequest(c, "ID kho không hợp lệ: "+wid)
				return
			}
			warehouseIDs = append(warehouseIDs, parsed)
		}
	}

	user, err := h.svc.UpdateUser(c.Request.Context(), id, req.FullName, req.Role, req.Email, req.IsActive, warehouseIDs)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "USER_UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, user)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}

	if err := h.svc.DeleteUser(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "USER_DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã xóa người dùng"})
}

type resetPasswordRequest struct {
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

func (h *Handler) ResetPassword(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}

	var req resetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Mật khẩu mới phải có ít nhất 6 ký tự")
		return
	}

	if err := h.svc.ResetPassword(c.Request.Context(), id, req.NewPassword); err != nil {
		response.Err(c, http.StatusBadRequest, "PASSWORD_RESET_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã đặt lại mật khẩu"})
}

func (h *Handler) ListRoles(c *gin.Context) {
	roles := []gin.H{
		{"code": "admin", "name": "Quản trị viên", "description": "Toàn quyền hệ thống"},
		{"code": "dvkh", "name": "Dịch vụ khách hàng", "description": "Tạo đơn, quản lý khách hàng, sản phẩm"},
		{"code": "dispatcher", "name": "Điều phối viên", "description": "Lập kế hoạch giao hàng, quản lý chuyến xe, tài xế, phương tiện"},
		{"code": "accountant", "name": "Kế toán", "description": "Duyệt đơn, đối soát, chốt sổ"},
		{"code": "driver", "name": "Tài xế", "description": "Giao hàng, xác nhận giao, thu tiền, thu hồi vỏ"},
		{"code": "warehouse", "name": "Thủ kho", "description": "Soạn hàng, kiểm tra cổng, quản lý kho"},
		{"code": "security", "name": "Bảo vệ", "description": "Kiểm tra xe ra/vào cổng"},
		{"code": "management", "name": "Ban giám đốc", "description": "Xem báo cáo KPI, phê duyệt đặc biệt"},
	}
	response.OK(c, roles)
}

func isValidRole(role string) bool {
	validRoles := map[string]bool{
		"admin": true, "dvkh": true, "dispatcher": true, "accountant": true,
		"driver": true, "warehouse": true, "security": true, "management": true,
	}
	return validRoles[role]
}
