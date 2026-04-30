package tms

import (
	"bytes"
	"fmt"
	"net/http"
	"time"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// GET /v1/trips/export
func (h *Handler) ExportTrips(c *gin.Context) {
	plannedDate := c.Query("planned_date")
	status := c.Query("status")

	warehouseID, allowed := middleware.ResolveWarehouseScope(c)
	if !allowed {
		response.Forbidden(c, "Không có quyền truy cập kho này")
		return
	}

	trips, _, err := h.svc.ListTrips(c.Request.Context(), warehouseID, plannedDate, status, c.Query("active") == "true", 1, 10000)
	if err != nil {
		response.InternalError(c)
		return
	}

	f := excelize.NewFile()
	sheet := "Chuyến xe"
	f.SetSheetName("Sheet1", sheet)

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

	headers := []string{"STT", "Mã chuyến", "Biển số xe", "Tài xế", "SĐT tài xế", "Ngày kế hoạch", "Trạng thái", "Số điểm giao", "Tải trọng (kg)", "Quãng đường (km)", "Giờ xuất bến", "Giờ hoàn thành"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	widths := map[string]float64{"A": 6, "B": 22, "C": 14, "D": 20, "E": 14, "F": 14, "G": 16, "H": 12, "I": 14, "J": 14, "K": 18, "L": 18}
	for col, w := range widths {
		f.SetColWidth(sheet, col, col, w)
	}

	statusLabels := map[string]string{
		"planned":    "Kế hoạch",
		"assigned":   "Đã phân công",
		"in_transit": "Đang giao",
		"completed":  "Hoàn thành",
		"cancelled":  "Đã hủy",
	}

	for i, t := range trips {
		row := i + 2
		st := t.Status
		if label, ok := statusLabels[st]; ok {
			st = label
		}
		startedAt := ""
		if t.StartedAt != nil {
			startedAt = t.StartedAt.Format("02/01/2006 15:04")
		}
		completedAt := ""
		if t.CompletedAt != nil {
			completedAt = t.CompletedAt.Format("02/01/2006 15:04")
		}

		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), t.TripNumber)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), t.VehiclePlate)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), t.DriverName)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), t.DriverPhone)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), t.PlannedDate)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), st)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), t.TotalStops)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), t.TotalWeightKg)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", row), t.TotalDistanceKm)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", row), startedAt)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", row), completedAt)
	}

	// Second sheet: Stops detail
	stopSheet := "Điểm giao"
	f.NewSheet(stopSheet)

	stopHeaders := []string{"STT", "Mã chuyến", "Thứ tự", "Khách hàng", "Địa chỉ", "SĐT", "Trạng thái", "Mã đơn", "Giá trị đơn", "Giờ đến", "Giờ rời"}
	for i, h := range stopHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(stopSheet, cell, h)
		f.SetCellStyle(stopSheet, cell, cell, headerStyle)
	}

	stopWidths := map[string]float64{"A": 6, "B": 22, "C": 8, "D": 25, "E": 35, "F": 14, "G": 16, "H": 20, "I": 15, "J": 18, "K": 18}
	for col, w := range stopWidths {
		f.SetColWidth(stopSheet, col, col, w)
	}

	stopStatusLabels := map[string]string{
		"pending":             "Chờ giao",
		"arrived":             "Đã đến",
		"delivering":          "Đang giao",
		"delivered":           "Đã giao",
		"partially_delivered": "Giao một phần",
		"failed":              "Thất bại",
		"skipped":             "Bỏ qua",
	}

	stopRow := 2
	for _, t := range trips {
		for _, s := range t.Stops {
			st := s.Status
			if label, ok := stopStatusLabels[st]; ok {
				st = label
			}
			arrival := ""
			if s.ActualArrival != nil {
				arrival = s.ActualArrival.Format("02/01/2006 15:04")
			}
			departure := ""
			if s.ActualDeparture != nil {
				departure = s.ActualDeparture.Format("02/01/2006 15:04")
			}

			f.SetCellValue(stopSheet, fmt.Sprintf("A%d", stopRow), stopRow-1)
			f.SetCellValue(stopSheet, fmt.Sprintf("B%d", stopRow), t.TripNumber)
			f.SetCellValue(stopSheet, fmt.Sprintf("C%d", stopRow), s.StopOrder)
			f.SetCellValue(stopSheet, fmt.Sprintf("D%d", stopRow), s.CustomerName)
			f.SetCellValue(stopSheet, fmt.Sprintf("E%d", stopRow), s.CustomerAddress)
			f.SetCellValue(stopSheet, fmt.Sprintf("F%d", stopRow), s.CustomerPhone)
			f.SetCellValue(stopSheet, fmt.Sprintf("G%d", stopRow), st)
			f.SetCellValue(stopSheet, fmt.Sprintf("H%d", stopRow), s.OrderNumber)
			f.SetCellValue(stopSheet, fmt.Sprintf("I%d", stopRow), s.OrderAmount)
			f.SetCellValue(stopSheet, fmt.Sprintf("J%d", stopRow), arrival)
			f.SetCellValue(stopSheet, fmt.Sprintf("K%d", stopRow), departure)
			stopRow++
		}
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		response.InternalError(c)
		return
	}

	filename := fmt.Sprintf("chuyen-xe-%s.xlsx", time.Now().Format("20060102-150405"))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}
