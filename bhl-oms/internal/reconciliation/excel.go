package reconciliation

import (
	"bytes"
	"fmt"
	"net/http"
	"time"

	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// GET /v1/reconciliation/export
func (h *Handler) ExportReconciliations(c *gin.Context) {
	status := c.Query("status")

	results, _, err := h.svc.ListReconciliations(c.Request.Context(), status, 1, 10000)
	if err != nil {
		response.InternalError(c)
		return
	}

	f := excelize.NewFile()
	sheet := "Đối soát"
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

	headers := []string{"STT", "Mã chuyến", "Loại đối soát", "Trạng thái", "Giá trị kỳ vọng", "Giá trị thực tế", "Chênh lệch", "Ngày đối soát", "Ngày tạo"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	widths := map[string]float64{"A": 6, "B": 22, "C": 16, "D": 16, "E": 18, "F": 18, "G": 18, "H": 18, "I": 18}
	for col, w := range widths {
		f.SetColWidth(sheet, col, col, w)
	}

	typeLabels := map[string]string{
		"goods":   "Hàng hóa",
		"payment": "Thanh toán",
		"asset":   "Tài sản/Vỏ",
	}
	statusLabels := map[string]string{
		"matched":    "Khớp",
		"mismatched": "Sai lệch",
		"resolved":   "Đã xử lý",
		"pending":    "Chờ xử lý",
	}

	for i, r := range results {
		row := i + 2
		reconType := r.ReconType
		if label, ok := typeLabels[reconType]; ok {
			reconType = label
		}
		st := r.Status
		if label, ok := statusLabels[st]; ok {
			st = label
		}
		reconAt := ""
		if r.ReconciledAt != nil {
			reconAt = r.ReconciledAt.Format("02/01/2006 15:04")
		}

		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), r.TripNumber)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), reconType)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), st)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), r.ExpectedValue)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), r.ActualValue)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), r.Variance)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", row), reconAt)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", row), r.CreatedAt.Format("02/01/2006 15:04"))
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		response.InternalError(c)
		return
	}

	filename := fmt.Sprintf("doi-soat-%s.xlsx", time.Now().Format("20060102-150405"))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}
