package oms

import (
	"net/http"
	"strconv"

	"bhl-oms/internal/domain"
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

	var warehouseID *uuid.UUID
	if wh := c.Query("warehouse_id"); wh != "" {
		if id, err := uuid.Parse(wh); err == nil {
			warehouseID = &id
		}
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
