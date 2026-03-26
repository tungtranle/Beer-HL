package oms

import (
	"net/http"
	"strconv"

	"bhl-oms/internal/domain"
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
	// Master data - Products
	products := r.Group("/products")
	products.GET("", h.ListProducts)
	products.GET("/:id", h.GetProduct)
	products.POST("", middleware.RequireRole("admin", "dispatcher"), h.CreateProduct)
	products.PUT("/:id", middleware.RequireRole("admin", "dispatcher"), h.UpdateProduct)
	products.DELETE("/:id", middleware.RequireRole("admin"), h.DeleteProduct)

	// Master data - Customers
	customers := r.Group("/customers")
	customers.GET("", h.ListCustomers)
	customers.GET("/:id", h.GetCustomer)
	customers.POST("", middleware.RequireRole("admin", "dispatcher"), h.CreateCustomer)
	customers.PUT("/:id", middleware.RequireRole("admin", "dispatcher"), h.UpdateCustomer)
	customers.DELETE("/:id", middleware.RequireRole("admin"), h.DeleteCustomer)

	// ATP
	r.GET("/atp", h.CheckATP)
	r.POST("/atp/batch", h.CheckATPBatch)

	// Orders
	orders := r.Group("/orders")
	orders.POST("", h.CreateOrder)
	orders.GET("", h.ListOrders)
	orders.GET("/:id", h.GetOrder)
	orders.PUT("/:id", h.UpdateOrder)
	orders.POST("/:id/cancel", h.CancelOrder)
	orders.POST("/:id/approve", middleware.RequireRole("admin", "accountant", "management"), h.ApproveOrder)
	orders.POST("/:id/split", middleware.RequireRole("admin", "dispatcher"), h.SplitOrder)
	orders.POST("/consolidate", middleware.RequireRole("admin", "dispatcher"), h.ConsolidateOrders)

	// Pending approvals with credit details
	orders.GET("/pending-approvals", middleware.RequireRole("admin", "accountant", "management"), h.ListPendingApprovals)

	// Excel import/export
	orders.GET("/export", middleware.RequireRole("admin", "dispatcher", "accountant", "management"), h.ExportOrders)
	orders.GET("/import/template", h.DownloadImportTemplate)
	orders.POST("/import", middleware.RequireRole("admin", "dispatcher"), h.ImportOrders)

	// Re-delivery
	orders.POST("/:id/redelivery", middleware.RequireRole("admin", "dispatcher", "dvkh"), h.CreateRedelivery)
	orders.GET("/:id/delivery-attempts", h.ListDeliveryAttempts)

	// Control Desk (Task 5.9, 5.10, 5.11)
	orders.GET("/control-desk/stats", middleware.RequireRole("admin", "dvkh", "dispatcher", "management"), h.GetControlDeskStats)
	orders.GET("/search", h.SearchOrders)
}

func (h *Handler) ListProducts(c *gin.Context) {
	products, err := h.svc.ListProducts(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, products)
}

func (h *Handler) GetProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}
	product, err := h.svc.GetProduct(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Không tìm thấy sản phẩm")
		return
	}
	response.OK(c, product)
}

func (h *Handler) CreateProduct(c *gin.Context) {
	var p domain.Product
	if err := c.ShouldBindJSON(&p); err != nil {
		response.BadRequest(c, "Dữ liệu sản phẩm không hợp lệ")
		return
	}
	p.IsActive = true
	if err := h.svc.CreateProduct(c.Request.Context(), &p); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, p)
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}
	var p domain.Product
	if err := c.ShouldBindJSON(&p); err != nil {
		response.BadRequest(c, "Dữ liệu sản phẩm không hợp lệ")
		return
	}
	p.ID = id
	if err := h.svc.UpdateProduct(c.Request.Context(), &p); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, p)
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}
	if err := h.svc.DeleteProduct(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã vô hiệu hóa sản phẩm"})
}

func (h *Handler) ListCustomers(c *gin.Context) {
	customers, err := h.svc.ListCustomers(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, customers)
}

func (h *Handler) GetCustomer(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid customer ID")
		return
	}

	customer, err := h.svc.GetCustomerWithCredit(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Không tìm thấy khách hàng")
		return
	}
	response.OK(c, customer)
}

func (h *Handler) CreateCustomer(c *gin.Context) {
	var cust domain.Customer
	if err := c.ShouldBindJSON(&cust); err != nil {
		response.BadRequest(c, "Dữ liệu khách hàng không hợp lệ")
		return
	}
	cust.IsActive = true
	if err := h.svc.CreateCustomer(c.Request.Context(), &cust); err != nil {
		response.Err(c, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	response.Created(c, cust)
}

func (h *Handler) UpdateCustomer(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid customer ID")
		return
	}
	var cust domain.Customer
	if err := c.ShouldBindJSON(&cust); err != nil {
		response.BadRequest(c, "Dữ liệu khách hàng không hợp lệ")
		return
	}
	cust.ID = id
	if err := h.svc.UpdateCustomer(c.Request.Context(), &cust); err != nil {
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	response.OK(c, cust)
}

func (h *Handler) DeleteCustomer(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid customer ID")
		return
	}
	if err := h.svc.DeleteCustomer(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã vô hiệu hóa khách hàng"})
}

func (h *Handler) CheckATP(c *gin.Context) {
	productID, err := uuid.Parse(c.Query("product_id"))
	if err != nil {
		response.BadRequest(c, "product_id là bắt buộc")
		return
	}

	warehouseID, err := uuid.Parse(c.Query("warehouse_id"))
	if err != nil {
		response.BadRequest(c, "warehouse_id là bắt buộc")
		return
	}

	result, err := h.svc.CheckATP(c.Request.Context(), productID, warehouseID)
	if err != nil {
		response.NotFound(c, "Không tìm thấy tồn kho")
		return
	}
	response.OK(c, result)
}

type batchATPRequest struct {
	WarehouseID uuid.UUID   `json:"warehouse_id" binding:"required"`
	ProductIDs  []uuid.UUID `json:"product_ids" binding:"required"`
}

func (h *Handler) CheckATPBatch(c *gin.Context) {
	var req batchATPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "warehouse_id và product_ids là bắt buộc")
		return
	}

	results, err := h.svc.CheckATPBatch(c.Request.Context(), req.WarehouseID, req.ProductIDs)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, results)
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu đơn hàng không hợp lệ")
		return
	}

	if len(req.Items) == 0 {
		response.BadRequest(c, "Đơn hàng phải có ít nhất 1 sản phẩm")
		return
	}

	userID := middleware.GetUserID(c)
	order, err := h.svc.CreateOrder(c.Request.Context(), req, userID)
	if err != nil {
		if err.Error() == "ATP_INSUFFICIENT: không đủ tồn kho cho một hoặc nhiều sản phẩm" {
			response.ErrWithDetails(c, http.StatusUnprocessableEntity, "ATP_INSUFFICIENT", err.Error(), nil)
			return
		}
		response.Err(c, http.StatusBadRequest, "ORDER_FAILED", err.Error())
		return
	}

	status := http.StatusCreated
	if order.Status == "pending_approval" {
		status = http.StatusOK
	}

	c.JSON(status, map[string]interface{}{
		"success": true,
		"data":    order,
	})
}

func (h *Handler) UpdateOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu đơn hàng không hợp lệ")
		return
	}

	if len(req.Items) == 0 {
		response.BadRequest(c, "Đơn hàng phải có ít nhất 1 sản phẩm")
		return
	}

	userID := middleware.GetUserID(c)
	order, err := h.svc.UpdateOrder(c.Request.Context(), id, req, userID)
	if err != nil {
		if err.Error() == "ATP_INSUFFICIENT: không đủ tồn kho cho một hoặc nhiều sản phẩm" {
			response.ErrWithDetails(c, http.StatusUnprocessableEntity, "ATP_INSUFFICIENT", err.Error(), nil)
			return
		}
		response.Err(c, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}

	response.OK(c, order)
}

func (h *Handler) ListOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")
	deliveryDate := c.Query("delivery_date")
	cutoffGroup := c.Query("cutoff_group")

	warehouseID, allowed := middleware.ResolveWarehouseScope(c)
	if !allowed {
		response.Forbidden(c, "Không có quyền truy cập kho này")
		return
	}

	orders, total, err := h.svc.ListOrders(c.Request.Context(), warehouseID, status, deliveryDate, cutoffGroup, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	response.OKWithMeta(c, orders, response.PaginationMeta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *Handler) GetOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	order, err := h.svc.GetOrder(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Không tìm thấy đơn hàng")
		return
	}
	response.OK(c, order)
}

func (h *Handler) CancelOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	if err := h.svc.CancelOrder(c.Request.Context(), id); err != nil {
		response.Err(c, http.StatusBadRequest, "CANCEL_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã hủy đơn hàng"})
}

func (h *Handler) ApproveOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	userID := middleware.GetUserID(c)
	if err := h.svc.ApproveOrder(c.Request.Context(), id, userID); err != nil {
		response.Err(c, http.StatusBadRequest, "APPROVE_FAILED", err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Đã duyệt đơn hàng"})
}

func (h *Handler) ConsolidateOrders(c *gin.Context) {
	var req ConsolidateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}

	shipment, err := h.svc.ConsolidateOrders(c.Request.Context(), req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "CONSOLIDATE_FAILED", err.Error())
		return
	}
	response.OK(c, shipment)
}

func (h *Handler) SplitOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	var req SplitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}

	shipments, err := h.svc.SplitOrder(c.Request.Context(), id, req)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "SPLIT_FAILED", err.Error())
		return
	}
	response.OK(c, shipments)
}

func (h *Handler) ListPendingApprovals(c *gin.Context) {
	orders, err := h.svc.ListPendingApprovals(c.Request.Context())
	if err != nil {
		response.InternalError(c)
		return
	}
	response.OK(c, orders)
}

// ===== RE-DELIVERY =====

func (h *Handler) CreateRedelivery(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Dữ liệu không hợp lệ")
		return
	}
	if req.Reason == "" {
		response.BadRequest(c, "Lý do giao lại là bắt buộc")
		return
	}

	userID := middleware.GetUserID(c)
	attempt, err := h.svc.CreateRedelivery(c.Request.Context(), id, req.Reason, userID)
	if err != nil {
		response.Err(c, http.StatusBadRequest, "REDELIVERY_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    attempt,
	})
}

func (h *Handler) ListDeliveryAttempts(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	attempts, err := h.svc.ListDeliveryAttempts(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c)
		return
	}
	if attempts == nil {
		attempts = []domain.DeliveryAttempt{}
	}
	response.OK(c, attempts)
}

// ===== CONTROL DESK (Task 5.9, 5.10, 5.11) =====

func (h *Handler) GetControlDeskStats(c *gin.Context) {
	var warehouseID *uuid.UUID
	if wid := c.Query("warehouse_id"); wid != "" {
		parsed, err := uuid.Parse(wid)
		if err != nil {
			response.BadRequest(c, "Invalid warehouse_id")
			return
		}
		warehouseID = &parsed
	}

	stats, err := h.svc.GetControlDeskStats(c.Request.Context(), warehouseID)
	if err != nil {
		h.log.Error(c.Request.Context(), "GetControlDeskStats failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, stats)
}

func (h *Handler) SearchOrders(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		response.BadRequest(c, "Tham số tìm kiếm 'q' là bắt buộc")
		return
	}
	if len(q) < 2 {
		response.BadRequest(c, "Từ khóa tìm kiếm cần ít nhất 2 ký tự")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	orders, total, err := h.svc.SearchOrders(c.Request.Context(), q, page, limit)
	if err != nil {
		h.log.Error(c.Request.Context(), "SearchOrders failed", err)
		response.InternalError(c)
		return
	}
	if orders == nil {
		orders = []domain.SalesOrder{}
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}
	response.OKWithMeta(c, orders, response.PaginationMeta{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	})
}
