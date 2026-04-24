package wms

// WMS Phase 9 — Service & Handler for Pallet/Bin/ScanLog (Sprint 1: tasks 9.3 + 9.4).
// Routes added in handler.go via RegisterPhase9Routes().

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/response"
)

// ── Service methods ─────────────────────────────────

type CreateBinRequest struct {
	WarehouseID          uuid.UUID `json:"warehouse_id" binding:"required"`
	BinCode              string    `json:"bin_code" binding:"required"`
	Zone                 *string   `json:"zone"`
	RowCode              *string   `json:"row_code"`
	LevelCode            *string   `json:"level_code"`
	BinType              string    `json:"bin_type" binding:"required,oneof=storage staging dock quarantine"`
	CapacityPallets      int       `json:"capacity_pallets" binding:"required,min=1"`
	AllowedSKUCategories []string  `json:"allowed_sku_categories"`
	IsPickable           *bool     `json:"is_pickable"`
	VelocityClass        *string   `json:"velocity_class" binding:"omitempty,oneof=A B C"`
	Notes                *string   `json:"notes"`
}

func (s *Service) CreateBin(ctx context.Context, req CreateBinRequest) (*domain.BinLocation, error) {
	pickable := true
	if req.IsPickable != nil {
		pickable = *req.IsPickable
	}
	bin := &domain.BinLocation{
		WarehouseID:          req.WarehouseID,
		BinCode:              strings.TrimSpace(req.BinCode),
		Zone:                 req.Zone,
		RowCode:              req.RowCode,
		LevelCode:            req.LevelCode,
		BinType:              req.BinType,
		CapacityPallets:      req.CapacityPallets,
		AllowedSKUCategories: req.AllowedSKUCategories,
		IsPickable:           pickable,
		VelocityClass:        req.VelocityClass,
		Notes:                req.Notes,
	}
	bin.QRPayload = BuildBinPayload(bin.BinCode)
	if err := s.repo.CreateBin(ctx, bin); err != nil {
		return nil, err
	}
	return bin, nil
}

func (s *Service) ListBins(ctx context.Context, f BinFilter) ([]domain.BinLocation, int64, error) {
	return s.repo.ListBins(ctx, f)
}

func (s *Service) GetBinByCode(ctx context.Context, code string) (*domain.BinLocation, error) {
	return s.repo.GetBinByCode(ctx, code)
}

func (s *Service) GetBinContents(ctx context.Context, binID uuid.UUID) ([]domain.Pallet, error) {
	return s.repo.GetBinContents(ctx, binID)
}

func (s *Service) GetPalletByLPN(ctx context.Context, lpn string) (*domain.Pallet, error) {
	return s.repo.GetPalletByLPN(ctx, lpn)
}

func (s *Service) GetPalletHistory(ctx context.Context, lpn string, limit int) ([]domain.QRScanLog, error) {
	return s.repo.GetPalletHistory(ctx, lpn, limit)
}

func (s *Service) LogScan(ctx context.Context, in ScanLogInput) (int64, error) {
	return s.repo.InsertScanLog(ctx, in)
}

// ── Handler ─────────────────────────────────────────

// RegisterPhase9Routes mounts WMS Phase 9 endpoints onto the same /warehouse group.
func (h *Handler) RegisterPhase9Routes(wh *gin.RouterGroup) {
	// Bins
	wh.GET("/bins", h.ListBins)
	wh.POST("/bins", h.CreateBin)
	wh.GET("/bins/:code", h.GetBinByCode)
	wh.GET("/bins/:code/contents", h.GetBinContents)
	wh.GET("/bins/:code/label.zpl", h.GetBinLabelZPL)

	// Pallets
	wh.GET("/pallets/:lpn", h.GetPalletByLPN)
	wh.GET("/pallets/:lpn/history", h.GetPalletHistory)
	wh.GET("/pallets/:lpn/label.zpl", h.GetPalletLabelZPL)

	// Scan log (manual lookup endpoint — also used internally by other workflows)
	wh.POST("/scans", h.LogScan)
}

// ── Bin handlers ────────────────────────────────────

func (h *Handler) ListBins(c *gin.Context) {
	f := BinFilter{}
	if wid := c.Query("warehouse_id"); wid != "" {
		id, err := uuid.Parse(wid)
		if err != nil {
			response.BadRequest(c, "invalid warehouse_id")
			return
		}
		f.WarehouseID = &id
	}
	if bt := c.Query("bin_type"); bt != "" {
		f.BinType = &bt
	}
	if pk := c.Query("is_pickable"); pk != "" {
		v := pk == "true"
		f.IsPickable = &v
	}
	f.Limit, _ = strconv.Atoi(c.DefaultQuery("limit", "50"))
	f.Offset, _ = strconv.Atoi(c.DefaultQuery("offset", "0"))

	bins, total, err := h.svc.ListBins(c, f)
	if err != nil {
		h.log.Error(c, "list bins failed", err)
		response.InternalError(c)
		return
	}
	page := (f.Offset / max(f.Limit, 1)) + 1
	totalPages := int((total + int64(f.Limit) - 1) / int64(max(f.Limit, 1)))
	response.OKWithMeta(c, bins, response.PaginationMeta{
		Page: page, Limit: f.Limit, Total: total, TotalPages: totalPages,
	})
}

func (h *Handler) CreateBin(c *gin.Context) {
	var req CreateBinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	bin, err := h.svc.CreateBin(c, req)
	if err != nil {
		// Unique violation → bin_code đã tồn tại
		if isUniqueViolation(err) {
			response.Err(c, http.StatusConflict, "BIN_DUPLICATE", "bin_code đã tồn tại")
			return
		}
		h.log.Error(c, "create bin failed", err)
		response.InternalError(c)
		return
	}
	response.Created(c, bin)
}

func (h *Handler) GetBinByCode(c *gin.Context) {
	code := strings.TrimSpace(c.Param("code"))
	bin, err := h.svc.GetBinByCode(c, code)
	if errors.Is(err, ErrBinNotFound) {
		response.NotFound(c, "Bin không tồn tại")
		return
	}
	if err != nil {
		h.log.Error(c, "get bin failed", err)
		response.InternalError(c)
		return
	}
	// Log lookup scan (best-effort, không block)
	if uid, ok := userIDFromCtx(c); ok {
		_, _ = h.svc.LogScan(c, ScanLogInput{
			ScanType: "bin", QRCode: bin.BinCode, Action: "lookup",
			UserID: uid, WarehouseID: &bin.WarehouseID, Result: "ok",
		})
	}
	response.OK(c, bin)
}

func (h *Handler) GetBinContents(c *gin.Context) {
	code := strings.TrimSpace(c.Param("code"))
	bin, err := h.svc.GetBinByCode(c, code)
	if errors.Is(err, ErrBinNotFound) {
		response.NotFound(c, "Bin không tồn tại")
		return
	}
	if err != nil {
		response.InternalError(c)
		return
	}
	pallets, err := h.svc.GetBinContents(c, bin.ID)
	if err != nil {
		h.log.Error(c, "get bin contents failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, gin.H{
		"bin":      bin,
		"pallets":  pallets,
		"occupied": len(pallets),
		"capacity": bin.CapacityPallets,
	})
}

func (h *Handler) GetBinLabelZPL(c *gin.Context) {
	code := strings.TrimSpace(c.Param("code"))
	bin, err := h.svc.GetBinByCode(c, code)
	if errors.Is(err, ErrBinNotFound) {
		response.NotFound(c, "Bin không tồn tại")
		return
	}
	if err != nil {
		response.InternalError(c)
		return
	}
	zpl := BinLabelZPL(bin.BinCode, bin.QRPayload)
	c.Header("Content-Type", "application/zpl; charset=utf-8")
	c.Header("Content-Disposition", "inline; filename=\"bin-"+bin.BinCode+".zpl\"")
	c.String(http.StatusOK, zpl)
}

// ── Pallet handlers ─────────────────────────────────

func (h *Handler) GetPalletByLPN(c *gin.Context) {
	lpn := strings.TrimSpace(c.Param("lpn"))
	if lpn == "" {
		response.BadRequest(c, "lpn required")
		return
	}
	p, err := h.svc.GetPalletByLPN(c, lpn)
	if errors.Is(err, ErrPalletNotFound) {
		// log scan failure
		if uid, ok := userIDFromCtx(c); ok {
			msg := "pallet not found"
			_, _ = h.svc.LogScan(c, ScanLogInput{
				ScanType: "pallet", QRCode: lpn, Action: "lookup",
				UserID: uid, Result: "error_invalid", ErrorMsg: &msg,
			})
		}
		response.NotFound(c, "Pallet không tồn tại")
		return
	}
	if err != nil {
		h.log.Error(c, "get pallet failed", err)
		response.InternalError(c)
		return
	}
	if uid, ok := userIDFromCtx(c); ok {
		_, _ = h.svc.LogScan(c, ScanLogInput{
			ScanType: "pallet", QRCode: p.LPNCode, Action: "lookup",
			UserID: uid, WarehouseID: &p.WarehouseID, Result: "ok",
		})
	}
	response.OK(c, p)
}

func (h *Handler) GetPalletHistory(c *gin.Context) {
	lpn := strings.TrimSpace(c.Param("lpn"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	logs, err := h.svc.GetPalletHistory(c, lpn, limit)
	if err != nil {
		h.log.Error(c, "get pallet history failed", err)
		response.InternalError(c)
		return
	}
	response.OK(c, logs)
}

func (h *Handler) GetPalletLabelZPL(c *gin.Context) {
	lpn := strings.TrimSpace(c.Param("lpn"))
	p, err := h.svc.GetPalletByLPN(c, lpn)
	if errors.Is(err, ErrPalletNotFound) {
		response.NotFound(c, "Pallet không tồn tại")
		return
	}
	if err != nil {
		response.InternalError(c)
		return
	}
	sku := ""
	if p.ProductSKU != nil {
		sku = *p.ProductSKU
	}
	name := ""
	if p.ProductName != nil {
		name = *p.ProductName
	}
	batch := ""
	if p.BatchNumber != nil {
		batch = *p.BatchNumber
	}
	exp := ""
	if p.ExpiryDate != nil {
		exp = *p.ExpiryDate
	}
	zpl := PalletLabelZPL(p.LPNCode, sku, name, batch, exp, p.Qty, p.QRPayload)
	c.Header("Content-Type", "application/zpl; charset=utf-8")
	c.Header("Content-Disposition", "inline; filename=\"pallet-"+p.LPNCode+".zpl\"")
	c.String(http.StatusOK, zpl)
}

// ── Scan log handler ────────────────────────────────

type LogScanRequest struct {
	ScanType    string          `json:"scan_type" binding:"required,oneof=pallet bin asset product"`
	QRCode      string          `json:"qr_code" binding:"required"`
	Action      string          `json:"action" binding:"required"`
	ContextType *string         `json:"context_type"`
	ContextID   *uuid.UUID      `json:"context_id"`
	WarehouseID *uuid.UUID      `json:"warehouse_id"`
	DeviceInfo  json.RawMessage `json:"device_info"`
	Result      string          `json:"result" binding:"required,oneof=ok error_invalid error_duplicate error_mismatch"`
	ErrorMsg    *string         `json:"error_msg"`
}

func (h *Handler) LogScan(c *gin.Context) {
	var req LogScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	uid, ok := userIDFromCtx(c)
	if !ok {
		response.Unauthorized(c, "user required")
		return
	}
	id, err := h.svc.LogScan(c, ScanLogInput{
		ScanType: req.ScanType, QRCode: req.QRCode, Action: req.Action,
		ContextType: req.ContextType, ContextID: req.ContextID,
		UserID: uid, WarehouseID: req.WarehouseID,
		DeviceInfo: req.DeviceInfo, Result: req.Result, ErrorMsg: req.ErrorMsg,
	})
	if err != nil {
		h.log.Error(c, "insert scan log failed", err)
		response.InternalError(c)
		return
	}
	response.Created(c, gin.H{"id": id})
}

// ── Helpers ─────────────────────────────────────────

func userIDFromCtx(c *gin.Context) (uuid.UUID, bool) {
	v, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "unq_") || strings.Contains(msg, "unique constraint")
}
