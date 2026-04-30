package oms

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

// ── Excel Export ─────────────────────────────────────

// GET /v1/orders/export
func (h *Handler) ExportOrders(c *gin.Context) {
	status := c.Query("status")
	deliveryDate := c.Query("delivery_date")
	cutoffGroup := c.Query("cutoff_group")

	warehouseID, allowed := middleware.ResolveWarehouseScope(c)
	if !allowed {
		response.Forbidden(c, "Không có quyền truy cập kho này")
		return
	}

	// Fetch all orders (no pagination for export)
	orders, _, err := h.svc.ListOrders(c.Request.Context(), warehouseID, status, c.Query("customer_id"), deliveryDate, c.Query("from"), c.Query("to"), cutoffGroup, 1, 10000)
	if err != nil {
		response.InternalError(c)
		return
	}

	f := excelize.NewFile()
	sheet := "Đơn hàng"
	f.SetSheetName("Sheet1", sheet)

	// Header style
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"F68634"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "DDDDDD", Style: 1},
			{Type: "right", Color: "DDDDDD", Style: 1},
			{Type: "top", Color: "DDDDDD", Style: 1},
			{Type: "bottom", Color: "DDDDDD", Style: 1},
		},
	})

	headers := []string{"STT", "Mã đơn", "Khách hàng", "Mã KH", "Ngày giao", "Trạng thái", "Tổng tiền", "Tiền cọc", "Tổng cộng", "Ghi chú"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	// Column widths
	widths := map[string]float64{"A": 6, "B": 20, "C": 25, "D": 12, "E": 14, "F": 18, "G": 15, "H": 15, "I": 15, "J": 30}
	for col, w := range widths {
		f.SetColWidth(sheet, col, col, w)
	}

	statusLabels := map[string]string{
		"pending_customer_confirm": "Chờ KH xác nhận",
		"pending_approval":         "Chờ duyệt",
		"confirmed":                "Đã xác nhận",
		"rejected":                 "Đã từ chối",
		"cancelled":                "Đã hủy",
		"in_transit":               "Đang giao",
		"delivered":                "Đã giao",
		"partially_delivered":      "Giao một phần",
	}

	for i, o := range orders {
		row := i + 2
		st := o.Status
		if label, ok := statusLabels[st]; ok {
			st = label
		}
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), o.OrderNumber)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), o.CustomerName)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), o.CustomerCode)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), o.DeliveryDate)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), st)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), o.TotalAmount)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), o.DepositAmount)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), o.GrandTotal)
		notes := ""
		if o.Notes != nil {
			notes = *o.Notes
		}
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), notes)
	}

	// Write to buffer
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		response.InternalError(c)
		return
	}

	filename := fmt.Sprintf("don-hang-%s.xlsx", time.Now().Format("20060102-150405"))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

// ── Import Template ─────────────────────────────────

// GET /v1/orders/import/template
func (h *Handler) DownloadImportTemplate(c *gin.Context) {
	f := excelize.NewFile()
	sheet := "Đơn hàng"
	f.SetSheetName("Sheet1", sheet)

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"2E7D32"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	noteStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Italic: true, Size: 10, Color: "888888"},
	})

	headers := []string{"Mã KH (*)", "Mã kho (*)", "Ngày giao (*)", "Mã SP (*)", "Số lượng (*)", "Ghi chú"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	// Example row
	f.SetCellValue(sheet, "A2", "KH-001")
	f.SetCellValue(sheet, "B2", "WH-001")
	f.SetCellValue(sheet, "C2", "2026-03-25")
	f.SetCellValue(sheet, "D2", "BHL-330-24")
	f.SetCellValue(sheet, "E2", 100)
	f.SetCellValue(sheet, "F2", "Đơn hàng mẫu")

	// Instructions sheet
	f.NewSheet("Hướng dẫn")
	notes := []string{
		"(*) Trường bắt buộc",
		"Mã KH: Mã khách hàng trong hệ thống (customer_code)",
		"Mã kho: Mã kho BHL",
		"Ngày giao: Định dạng YYYY-MM-DD",
		"Mã SP: Mã SKU sản phẩm",
		"Số lượng: Số nguyên dương",
		"Ghi chú: Tùy chọn, có thể để trống",
		"",
		"Nhiều sản phẩm cùng 1 đơn: dùng CÙNG Mã KH + Mã kho + Ngày giao",
		"Ví dụ: 3 dòng cùng KH-001 + WH-001 + 2026-03-25 sẽ tạo 1 đơn có 3 sản phẩm",
	}
	for i, n := range notes {
		f.SetCellValue("Hướng dẫn", fmt.Sprintf("A%d", i+1), n)
		if i == 0 {
			f.SetCellStyle("Hướng dẫn", "A1", "A1", noteStyle)
		}
	}

	widths := map[string]float64{"A": 15, "B": 12, "C": 14, "D": 15, "E": 12, "F": 30}
	for col, w := range widths {
		f.SetColWidth(sheet, col, col, w)
	}
	f.SetColWidth("Hướng dẫn", "A", "A", 60)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		response.InternalError(c)
		return
	}

	c.Header("Content-Disposition", `attachment; filename="mau-import-don-hang.xlsx"`)
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

// ── Import Orders ───────────────────────────────────

type ImportResult struct {
	TotalRows    int           `json:"total_rows"`
	SuccessCount int           `json:"success_count"`
	ErrorCount   int           `json:"error_count"`
	Orders       []ImportedRow `json:"orders"`
	Errors       []ImportError `json:"errors"`
}

type ImportedRow struct {
	Row          int    `json:"row"`
	OrderNumber  string `json:"order_number"`
	CustomerCode string `json:"customer_code"`
	ProductSKU   string `json:"product_sku"`
	Quantity     int    `json:"quantity"`
}

type ImportError struct {
	Row     int    `json:"row"`
	Column  string `json:"column"`
	Value   string `json:"value"`
	Message string `json:"message"`
}

// POST /v1/orders/import
func (h *Handler) ImportOrders(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "Vui lòng chọn file Excel")
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		response.BadRequest(c, "File không đúng định dạng Excel (.xlsx)")
		return
	}
	defer f.Close()

	sheet := f.GetSheetName(0)
	rows, err := f.GetRows(sheet)
	if err != nil || len(rows) < 2 {
		response.BadRequest(c, "File rỗng hoặc không có dữ liệu")
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	result := h.svc.ImportOrders(c.Request.Context(), rows[1:], uid, h.log) // skip header

	if result.ErrorCount > 0 && result.SuccessCount == 0 {
		response.Err(c, http.StatusUnprocessableEntity, "IMPORT_ERROR", fmt.Sprintf("%d lỗi, 0 thành công", result.ErrorCount))
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "data": result})
		return
	}

	response.OK(c, result)
}

// ── Import Logic in Service ─────────────────────────

func (s *Service) ImportOrders(ctx context.Context, rows [][]string, userID uuid.UUID, log logger.Logger) ImportResult {
	result := ImportResult{}
	result.TotalRows = len(rows)

	// Pre-load mappings
	customers, _ := s.repo.ListCustomers(ctx)
	customerByCode := make(map[string]domain.Customer)
	for _, c := range customers {
		customerByCode[c.Code] = c
	}

	products, _ := s.repo.ListProducts(ctx)
	productBySKU := make(map[string]domain.Product)
	for _, p := range products {
		productBySKU[p.SKU] = p
	}

	// Group rows by (customer_code, warehouse_id, delivery_date) → make 1 order per group
	type orderKey struct {
		CustomerCode string
		WarehouseID  string
		DeliveryDate string
		Notes        string
	}
	type itemEntry struct {
		ProductID uuid.UUID
		Quantity  int
		Row       int
		SKU       string
	}
	orderGroups := make(map[orderKey][]itemEntry)
	var groupOrder []orderKey // preserve insertion order

	for i, row := range rows {
		rowNum := i + 2 // Excel row number (1-indexed + header)

		if len(row) < 5 {
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Column: "—", Message: "Dòng thiếu cột (cần ít nhất 5 cột)"})
			result.ErrorCount++
			continue
		}

		custCode := strings.TrimSpace(row[0])
		whCode := strings.TrimSpace(row[1])
		delivDate := strings.TrimSpace(row[2])
		prodSKU := strings.TrimSpace(row[3])
		qtyStr := strings.TrimSpace(row[4])
		notes := ""
		if len(row) > 5 {
			notes = strings.TrimSpace(row[5])
		}

		// Validate customer
		if custCode == "" {
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Column: "Mã KH", Message: "Mã KH không được trống"})
			result.ErrorCount++
			continue
		}
		cust, ok := customerByCode[custCode]
		if !ok {
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Column: "Mã KH", Value: custCode, Message: "Mã KH không tồn tại"})
			result.ErrorCount++
			continue
		}

		// Validate warehouse
		if whCode == "" {
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Column: "Mã kho", Message: "Mã kho không được trống"})
			result.ErrorCount++
			continue
		}
		whID, err := uuid.Parse(whCode)
		if err != nil {
			// Try to look up by code — for now use as UUID
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Column: "Mã kho", Value: whCode, Message: "Mã kho không hợp lệ (cần UUID)"})
			result.ErrorCount++
			continue
		}

		// Validate date
		if _, err := time.Parse("2006-01-02", delivDate); err != nil {
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Column: "Ngày giao", Value: delivDate, Message: "Sai định dạng (cần YYYY-MM-DD)"})
			result.ErrorCount++
			continue
		}

		// Validate product
		prod, ok := productBySKU[prodSKU]
		if !ok {
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Column: "Mã SP", Value: prodSKU, Message: "Mã SP không tồn tại"})
			result.ErrorCount++
			continue
		}

		// Validate quantity
		qty := 0
		fmt.Sscanf(qtyStr, "%d", &qty)
		if qty <= 0 {
			result.Errors = append(result.Errors, ImportError{Row: rowNum, Column: "Số lượng", Value: qtyStr, Message: "Số lượng phải > 0"})
			result.ErrorCount++
			continue
		}

		key := orderKey{CustomerCode: custCode, WarehouseID: whID.String(), DeliveryDate: delivDate, Notes: notes}
		if _, exists := orderGroups[key]; !exists {
			groupOrder = append(groupOrder, key)
		}
		orderGroups[key] = append(orderGroups[key], itemEntry{
			ProductID: prod.ID,
			Quantity:  qty,
			Row:       rowNum,
			SKU:       prodSKU,
		})
		_ = cust // used below
	}

	// Create orders per group
	for _, key := range groupOrder {
		items := orderGroups[key]
		cust := customerByCode[key.CustomerCode]
		whID, _ := uuid.Parse(key.WarehouseID)

		orderItems := make([]OrderItemInput, len(items))
		for i, it := range items {
			orderItems[i] = OrderItemInput{ProductID: it.ProductID, Quantity: it.Quantity}
		}

		var notes *string
		if key.Notes != "" {
			notes = &key.Notes
		}

		req := CreateOrderRequest{
			CustomerID:   cust.ID,
			WarehouseID:  whID,
			DeliveryDate: key.DeliveryDate,
			Notes:        notes,
			Items:        orderItems,
		}

		order, err := s.CreateOrder(ctx, req, userID)
		if err != nil {
			for _, it := range items {
				result.Errors = append(result.Errors, ImportError{
					Row: it.Row, Column: "Tạo đơn", Value: key.CustomerCode,
					Message: fmt.Sprintf("Lỗi tạo đơn: %s", err.Error()),
				})
			}
			result.ErrorCount += len(items)
			continue
		}

		for _, it := range items {
			result.Orders = append(result.Orders, ImportedRow{
				Row:          it.Row,
				OrderNumber:  order.OrderNumber,
				CustomerCode: key.CustomerCode,
				ProductSKU:   it.SKU,
				Quantity:     it.Quantity,
			})
		}
		result.SuccessCount += len(items)
	}

	return result
}
