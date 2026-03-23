package admin

import (
	"net/http"
	"strconv"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
	log logger.Logger
}

func NewHandler(svc *Service, log logger.Logger) *Handler {
	return &Handler{svc: svc, log: log}
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

	// System configs
	admin.GET("/configs", h.ListConfigs)
	admin.PUT("/configs", h.UpdateConfigs)

	// Credit limits
	cl := admin.Group("/credit-limits")
	cl.GET("", h.ListCreditLimits)
	cl.POST("", h.CreateCreditLimit)
	cl.PUT("/:id", h.UpdateCreditLimit)
	cl.DELETE("/:id", h.DeleteCreditLimit)

	// Audit log
	admin.GET("/audit-logs", h.ListAuditLogs)

	// Credit limit expiry check
	admin.GET("/credit-limits/expiring", h.ListExpiringCreditLimits)

	// DB monitoring
	admin.GET("/slow-queries", h.SlowQueries)
	admin.POST("/slow-queries/reset", h.ResetSlowQueries)

	// System health
	admin.GET("/health", h.SystemHealth)

	// Routes CRUD
	routes := admin.Group("/routes")
	routes.GET("", h.ListRoutes)
	routes.POST("", h.CreateRoute)
	routes.PUT("/:id", h.UpdateRoute)
	routes.DELETE("/:id", h.DeleteRoute)
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
		{"code": "workshop", "name": "Phân xưởng", "description": "Phân loại vỏ/két, đối chiếu vỏ theo chuyến"},
		{"code": "management", "name": "Ban giám đốc", "description": "Xem báo cáo KPI, phê duyệt đặc biệt"},
	}
	response.OK(c, roles)
}

func isValidRole(role string) bool {
	validRoles := map[string]bool{
		"admin": true, "dvkh": true, "dispatcher": true, "accountant": true,
		"driver": true, "warehouse": true, "security": true, "management": true,
		"workshop": true,
	}
	return validRoles[role]
}

// SlowQueries returns the top slow queries from pg_stat_statements
func (h *Handler) SlowQueries(c *gin.Context) {
	limit := 20
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	queries, err := h.svc.GetSlowQueries(c.Request.Context(), limit)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "SLOW_QUERY_FETCH_FAILED", err.Error())
		return
	}
	response.OK(c, queries)
}

// ResetSlowQueries resets pg_stat_statements counters
func (h *Handler) ResetSlowQueries(c *gin.Context) {
	if err := h.svc.ResetSlowQueries(c.Request.Context()); err != nil {
		response.Err(c, http.StatusInternalServerError, "SLOW_QUERY_RESET_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã reset thống kê slow queries"})
}

// ─── System Configs ──────────────────────────────────────────

func (h *Handler) ListConfigs(c *gin.Context) {
	configs, err := h.svc.ListConfigs(c.Request.Context())
	if err != nil {
		h.log.Error(c.Request.Context(), "list_configs_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, configs)
}

type updateConfigsRequest struct {
	Configs []ConfigEntry `json:"configs" binding:"required,min=1"`
}

func (h *Handler) UpdateConfigs(c *gin.Context) {
	var req updateConfigsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ — cần mảng configs [{key, value}]")
		return
	}

	userID := middleware.GetUserID(c)
	userName := middleware.GetFullName(c)
	if err := h.svc.UpdateConfigs(c.Request.Context(), req.Configs, userID, userName); err != nil {
		h.log.Error(c.Request.Context(), "update_configs_failed", err)
		response.Err(c, http.StatusBadRequest, "CONFIG_UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã cập nhật cấu hình"})
}

// ─── Credit Limits ───────────────────────────────────────────

func (h *Handler) ListCreditLimits(c *gin.Context) {
	customerID := c.Query("customer_id")
	var custID *uuid.UUID
	if customerID != "" {
		parsed, err := uuid.Parse(customerID)
		if err != nil {
			response.BadRequest(c, "customer_id không hợp lệ")
			return
		}
		custID = &parsed
	}

	limits, err := h.svc.ListCreditLimits(c.Request.Context(), custID)
	if err != nil {
		h.log.Error(c.Request.Context(), "list_credit_limits_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, limits)
}

type createCreditLimitRequest struct {
	CustomerID    string  `json:"customer_id" binding:"required"`
	CreditLimit   float64 `json:"credit_limit" binding:"required,gt=0"`
	EffectiveFrom string  `json:"effective_from" binding:"required"`
	EffectiveTo   *string `json:"effective_to"`
}

func (h *Handler) CreateCreditLimit(c *gin.Context) {
	var req createCreditLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Thiếu thông tin: customer_id, credit_limit, effective_from")
		return
	}

	custID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		response.BadRequest(c, "customer_id không hợp lệ")
		return
	}

	limit, err := h.svc.CreateCreditLimit(c.Request.Context(), custID, req.CreditLimit, req.EffectiveFrom, req.EffectiveTo)
	if err != nil {
		h.log.Error(c.Request.Context(), "create_credit_limit_failed", err)
		response.Err(c, http.StatusBadRequest, "CREDIT_LIMIT_CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, limit)
}

type updateCreditLimitRequest struct {
	CreditLimit *float64 `json:"credit_limit"`
	EffectiveTo *string  `json:"effective_to"`
}

func (h *Handler) UpdateCreditLimit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}

	var req updateCreditLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}

	limit, err := h.svc.UpdateCreditLimit(c.Request.Context(), id, req.CreditLimit, req.EffectiveTo)
	if err != nil {
		h.log.Error(c.Request.Context(), "update_credit_limit_failed", err)
		response.Err(c, http.StatusBadRequest, "CREDIT_LIMIT_UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, limit)
}

func (h *Handler) DeleteCreditLimit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID không hợp lệ")
		return
	}

	if err := h.svc.DeleteCreditLimit(c.Request.Context(), id); err != nil {
		h.log.Error(c.Request.Context(), "delete_credit_limit_failed", err)
		response.Err(c, http.StatusBadRequest, "CREDIT_LIMIT_DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã xóa hạn mức tín dụng"})
}

// ─── Audit Logs ──────────────────────────────────────────────

func (h *Handler) ListAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	entityType := c.Query("entity_type")
	eventType := c.Query("event_type")
	actorID := c.Query("actor_id")
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	logs, total, err := h.svc.ListAuditLogs(c.Request.Context(), entityType, eventType, actorID, dateFrom, dateTo, page, limit)
	if err != nil {
		h.log.Error(c.Request.Context(), "list_audit_logs_failed", err)
		response.InternalError(c)
		return
	}

	response.OK(c, gin.H{
		"data": logs,
		"pagination": gin.H{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": (total + limit - 1) / limit,
		},
	})
}

// ──── Routes CRUD ────

func (h *Handler) ListRoutes(c *gin.Context) {
	routes, err := h.svc.ListRoutes(c.Request.Context())
	if err != nil {
		h.log.Error(c.Request.Context(), "list_routes_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, routes)
}

func (h *Handler) ListExpiringCreditLimits(c *gin.Context) {
	expiring, err := h.svc.CheckCreditLimitExpiry(c.Request.Context())
	if err != nil {
		h.log.Error(c.Request.Context(), "list_expiring_credit_limits_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, expiring)
}

func (h *Handler) CreateRoute(c *gin.Context) {
	var body struct {
		Code        string      `json:"code" binding:"required"`
		Name        string      `json:"name" binding:"required"`
		WarehouseID uuid.UUID   `json:"warehouse_id" binding:"required"`
		CustomerIDs []uuid.UUID `json:"customer_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	route, err := h.svc.CreateRoute(c.Request.Context(), body.Code, body.Name, body.WarehouseID, body.CustomerIDs)
	if err != nil {
		h.log.Error(c.Request.Context(), "create_route_failed", err)
		response.InternalError(c)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": route})
}

func (h *Handler) UpdateRoute(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid route id")
		return
	}
	var body struct {
		Code        *string     `json:"code"`
		Name        *string     `json:"name"`
		WarehouseID *uuid.UUID  `json:"warehouse_id"`
		CustomerIDs []uuid.UUID `json:"customer_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	route, err := h.svc.UpdateRoute(c.Request.Context(), id, body.Code, body.Name, body.WarehouseID, body.CustomerIDs)
	if err != nil {
		h.log.Error(c.Request.Context(), "update_route_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{"data": route})
}

func (h *Handler) DeleteRoute(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid route id")
		return
	}
	if err := h.svc.DeleteRoute(c.Request.Context(), id); err != nil {
		h.log.Error(c.Request.Context(), "delete_route_failed", err)
		response.InternalError(c)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "route deleted"})
}

func (h *Handler) SystemHealth(c *gin.Context) {
	health, err := h.svc.SystemHealth(c.Request.Context())
	if err != nil {
		h.log.Error(c.Request.Context(), "system_health_failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, health)
}
