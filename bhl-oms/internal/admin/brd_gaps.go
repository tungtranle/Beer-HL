package admin

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ══════════════════════════════════════════════════════
// DTOs
// ══════════════════════════════════════════════════════

type CompensationPrice struct {
	ID             uuid.UUID  `json:"id"`
	AssetType      string     `json:"asset_type"`
	UnitPrice      float64    `json:"unit_price"`
	EffectiveFrom  string     `json:"effective_from"`
	EffectiveUntil *string    `json:"effective_until,omitempty"`
	Notes          *string    `json:"notes,omitempty"`
	CreatedBy      *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt      string     `json:"created_at"`
}

type ForbiddenHour struct {
	ID           uuid.UUID `json:"id"`
	ZoneName     string    `json:"zone_name"`
	DayOfWeek    *int      `json:"day_of_week,omitempty"`
	StartTime    string    `json:"start_time"`
	EndTime      string    `json:"end_time"`
	VehicleTypes []string  `json:"vehicle_types,omitempty"`
	Reason       *string   `json:"reason,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    string    `json:"created_at"`
}

type DeliveryWindowConfig struct {
	ID              uuid.UUID `json:"id"`
	WindowName      string    `json:"window_name"`
	DurationMinutes int       `json:"duration_minutes"`
	EffectiveFrom   string    `json:"effective_from"`
	EffectiveUntil  *string   `json:"effective_until,omitempty"`
	Description     *string   `json:"description,omitempty"`
	CreatedAt       string    `json:"created_at"`
}

type MaintenanceSchedule struct {
	ID             uuid.UUID `json:"id"`
	VehicleID      uuid.UUID `json:"vehicle_id"`
	VehiclePlate   string    `json:"vehicle_plate"`
	ScheduleType   string    `json:"schedule_type"`
	IntervalKm     *int      `json:"interval_km,omitempty"`
	IntervalMonths *int      `json:"interval_months,omitempty"`
	Description    *string   `json:"description,omitempty"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      string    `json:"created_at"`
}

type MaintenanceRecord struct {
	ID                  uuid.UUID  `json:"id"`
	VehicleID           uuid.UUID  `json:"vehicle_id"`
	VehiclePlate        string     `json:"vehicle_plate"`
	ScheduleID          *uuid.UUID `json:"schedule_id,omitempty"`
	MaintenanceType     string     `json:"maintenance_type"`
	LastMaintenanceDate *string    `json:"last_maintenance_date,omitempty"`
	LastMaintenanceKm   *int       `json:"last_maintenance_km,omitempty"`
	NextDueDate         *string    `json:"next_due_date,omitempty"`
	NextDueKm           *int       `json:"next_due_km,omitempty"`
	AlertDaysBefore     int        `json:"alert_days_before"`
	Status              string     `json:"status"`
	Notes               *string    `json:"notes,omitempty"`
	CompletedAt         *string    `json:"completed_at,omitempty"`
	CreatedAt           string     `json:"created_at"`
}

// ══════════════════════════════════════════════════════
// Repository methods
// ══════════════════════════════════════════════════════

type BRDGapRepo struct {
	db *pgxpool.Pool
}

func NewBRDGapRepo(db *pgxpool.Pool) *BRDGapRepo {
	return &BRDGapRepo{db: db}
}

// ── Compensation Prices ──────────────────────────────

func (r *BRDGapRepo) ListCompensationPrices(ctx context.Context) ([]CompensationPrice, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, asset_type, unit_price, effective_from::text, effective_until::text, notes, created_by, created_at::text
		FROM asset_compensation_prices
		ORDER BY asset_type, effective_from DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []CompensationPrice
	for rows.Next() {
		var p CompensationPrice
		if err := rows.Scan(&p.ID, &p.AssetType, &p.UnitPrice, &p.EffectiveFrom, &p.EffectiveUntil, &p.Notes, &p.CreatedBy, &p.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	if items == nil {
		items = []CompensationPrice{}
	}
	return items, nil
}

func (r *BRDGapRepo) CreateCompensationPrice(ctx context.Context, assetType string, unitPrice float64, effectiveFrom string, effectiveUntil *string, notes *string, createdBy uuid.UUID) (*CompensationPrice, error) {
	var p CompensationPrice
	err := r.db.QueryRow(ctx, `
		INSERT INTO asset_compensation_prices (asset_type, unit_price, effective_from, effective_until, notes, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, asset_type, unit_price, effective_from::text, effective_until::text, notes, created_by, created_at::text
	`, assetType, unitPrice, effectiveFrom, effectiveUntil, notes, createdBy).Scan(
		&p.ID, &p.AssetType, &p.UnitPrice, &p.EffectiveFrom, &p.EffectiveUntil, &p.Notes, &p.CreatedBy, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *BRDGapRepo) UpdateCompensationPrice(ctx context.Context, id uuid.UUID, unitPrice float64, effectiveUntil *string, notes *string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE asset_compensation_prices
		SET unit_price = $2, effective_until = $3, notes = $4, updated_at = NOW()
		WHERE id = $1
	`, id, unitPrice, effectiveUntil, notes)
	return err
}

func (r *BRDGapRepo) DeleteCompensationPrice(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM asset_compensation_prices WHERE id = $1`, id)
	return err
}

// GetActiveCompensationPrice returns the currently effective price for an asset type
func (r *BRDGapRepo) GetActiveCompensationPrice(ctx context.Context, assetType string) (*CompensationPrice, error) {
	var p CompensationPrice
	err := r.db.QueryRow(ctx, `
		SELECT id, asset_type, unit_price, effective_from::text, effective_until::text, notes, created_by, created_at::text
		FROM asset_compensation_prices
		WHERE asset_type = $1 AND effective_from <= CURRENT_DATE
		  AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
		ORDER BY effective_from DESC LIMIT 1
	`, assetType).Scan(&p.ID, &p.AssetType, &p.UnitPrice, &p.EffectiveFrom, &p.EffectiveUntil, &p.Notes, &p.CreatedBy, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ── Forbidden Load Hours ─────────────────────────────

func (r *BRDGapRepo) ListForbiddenHours(ctx context.Context) ([]ForbiddenHour, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, zone_name, day_of_week, start_time::text, end_time::text, vehicle_types, reason, is_active, created_at::text
		FROM forbidden_load_hours
		ORDER BY zone_name, start_time
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ForbiddenHour
	for rows.Next() {
		var f ForbiddenHour
		if err := rows.Scan(&f.ID, &f.ZoneName, &f.DayOfWeek, &f.StartTime, &f.EndTime, &f.VehicleTypes, &f.Reason, &f.IsActive, &f.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, f)
	}
	if items == nil {
		items = []ForbiddenHour{}
	}
	return items, nil
}

func (r *BRDGapRepo) CreateForbiddenHour(ctx context.Context, zoneName string, dayOfWeek *int, startTime, endTime string, vehicleTypes []string, reason *string, createdBy uuid.UUID) (*ForbiddenHour, error) {
	var f ForbiddenHour
	err := r.db.QueryRow(ctx, `
		INSERT INTO forbidden_load_hours (zone_name, day_of_week, start_time, end_time, vehicle_types, reason, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, zone_name, day_of_week, start_time::text, end_time::text, vehicle_types, reason, is_active, created_at::text
	`, zoneName, dayOfWeek, startTime, endTime, vehicleTypes, reason, createdBy).Scan(
		&f.ID, &f.ZoneName, &f.DayOfWeek, &f.StartTime, &f.EndTime, &f.VehicleTypes, &f.Reason, &f.IsActive, &f.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *BRDGapRepo) UpdateForbiddenHour(ctx context.Context, id uuid.UUID, zoneName string, dayOfWeek *int, startTime, endTime string, vehicleTypes []string, reason *string, isActive bool) error {
	_, err := r.db.Exec(ctx, `
		UPDATE forbidden_load_hours
		SET zone_name = $2, day_of_week = $3, start_time = $4, end_time = $5,
		    vehicle_types = $6, reason = $7, is_active = $8, updated_at = NOW()
		WHERE id = $1
	`, id, zoneName, dayOfWeek, startTime, endTime, vehicleTypes, reason, isActive)
	return err
}

func (r *BRDGapRepo) DeleteForbiddenHour(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM forbidden_load_hours WHERE id = $1`, id)
	return err
}

// ── Delivery Window Configs ──────────────────────────

func (r *BRDGapRepo) ListDeliveryWindows(ctx context.Context) ([]DeliveryWindowConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, window_name, duration_minutes, effective_from::text, effective_until::text, description, created_at::text
		FROM delivery_window_configs
		ORDER BY window_name, effective_from DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []DeliveryWindowConfig
	for rows.Next() {
		var d DeliveryWindowConfig
		if err := rows.Scan(&d.ID, &d.WindowName, &d.DurationMinutes, &d.EffectiveFrom, &d.EffectiveUntil, &d.Description, &d.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, d)
	}
	if items == nil {
		items = []DeliveryWindowConfig{}
	}
	return items, nil
}

func (r *BRDGapRepo) CreateDeliveryWindow(ctx context.Context, windowName string, durationMinutes int, effectiveFrom string, effectiveUntil *string, description *string, createdBy uuid.UUID) (*DeliveryWindowConfig, error) {
	var d DeliveryWindowConfig
	err := r.db.QueryRow(ctx, `
		INSERT INTO delivery_window_configs (window_name, duration_minutes, effective_from, effective_until, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, window_name, duration_minutes, effective_from::text, effective_until::text, description, created_at::text
	`, windowName, durationMinutes, effectiveFrom, effectiveUntil, description, createdBy).Scan(
		&d.ID, &d.WindowName, &d.DurationMinutes, &d.EffectiveFrom, &d.EffectiveUntil, &d.Description, &d.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *BRDGapRepo) UpdateDeliveryWindow(ctx context.Context, id uuid.UUID, durationMinutes int, effectiveUntil *string, description *string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE delivery_window_configs
		SET duration_minutes = $2, effective_until = $3, description = $4, updated_at = NOW()
		WHERE id = $1
	`, id, durationMinutes, effectiveUntil, description)
	return err
}

func (r *BRDGapRepo) DeleteDeliveryWindow(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM delivery_window_configs WHERE id = $1`, id)
	return err
}

// ── Vehicle Maintenance ──────────────────────────────

func (r *BRDGapRepo) ListMaintenanceSchedules(ctx context.Context, vehicleID *uuid.UUID) ([]MaintenanceSchedule, error) {
	query := `
		SELECT ms.id, ms.vehicle_id, COALESCE(v.plate_number, ''), ms.schedule_type,
		       ms.interval_km, ms.interval_months, ms.description, ms.is_active, ms.created_at::text
		FROM vehicle_maintenance_schedules ms
		LEFT JOIN vehicles v ON v.id = ms.vehicle_id
		WHERE 1=1`
	args := []interface{}{}
	if vehicleID != nil {
		query += " AND ms.vehicle_id = $1"
		args = append(args, *vehicleID)
	}
	query += " ORDER BY ms.created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []MaintenanceSchedule
	for rows.Next() {
		var m MaintenanceSchedule
		if err := rows.Scan(&m.ID, &m.VehicleID, &m.VehiclePlate, &m.ScheduleType, &m.IntervalKm, &m.IntervalMonths, &m.Description, &m.IsActive, &m.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	if items == nil {
		items = []MaintenanceSchedule{}
	}
	return items, nil
}

func (r *BRDGapRepo) CreateMaintenanceSchedule(ctx context.Context, vehicleID uuid.UUID, scheduleType string, intervalKm *int, intervalMonths *int, description *string, createdBy uuid.UUID) (*MaintenanceSchedule, error) {
	var m MaintenanceSchedule
	err := r.db.QueryRow(ctx, `
		INSERT INTO vehicle_maintenance_schedules (vehicle_id, schedule_type, interval_km, interval_months, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, vehicle_id, schedule_type, interval_km, interval_months, description, is_active, created_at::text
	`, vehicleID, scheduleType, intervalKm, intervalMonths, description, createdBy).Scan(
		&m.ID, &m.VehicleID, &m.ScheduleType, &m.IntervalKm, &m.IntervalMonths, &m.Description, &m.IsActive, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *BRDGapRepo) ListMaintenanceRecords(ctx context.Context, vehicleID *uuid.UUID, status string) ([]MaintenanceRecord, error) {
	query := `
		SELECT mr.id, mr.vehicle_id, COALESCE(v.plate_number, ''), mr.schedule_id,
		       mr.maintenance_type, mr.last_maintenance_date::text, mr.last_maintenance_km,
		       mr.next_due_date::text, mr.next_due_km, mr.alert_days_before, mr.status::text,
		       mr.notes, mr.completed_at::text, mr.created_at::text
		FROM vehicle_maintenance_records mr
		LEFT JOIN vehicles v ON v.id = mr.vehicle_id
		WHERE 1=1`
	args := []interface{}{}
	argIdx := 1
	if vehicleID != nil {
		query += fmt.Sprintf(" AND mr.vehicle_id = $%d", argIdx)
		args = append(args, *vehicleID)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND mr.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	query += " ORDER BY mr.next_due_date ASC NULLS LAST"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []MaintenanceRecord
	for rows.Next() {
		var m MaintenanceRecord
		if err := rows.Scan(&m.ID, &m.VehicleID, &m.VehiclePlate, &m.ScheduleID, &m.MaintenanceType,
			&m.LastMaintenanceDate, &m.LastMaintenanceKm, &m.NextDueDate, &m.NextDueKm,
			&m.AlertDaysBefore, &m.Status, &m.Notes, &m.CompletedAt, &m.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	if items == nil {
		items = []MaintenanceRecord{}
	}
	return items, nil
}

func (r *BRDGapRepo) CreateMaintenanceRecord(ctx context.Context, vehicleID uuid.UUID, scheduleID *uuid.UUID, maintenanceType string, nextDueDate *string, nextDueKm *int, alertDaysBefore int, notes *string, createdBy uuid.UUID) (*MaintenanceRecord, error) {
	var m MaintenanceRecord
	err := r.db.QueryRow(ctx, `
		INSERT INTO vehicle_maintenance_records (vehicle_id, schedule_id, maintenance_type, next_due_date, next_due_km, alert_days_before, notes, completed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, vehicle_id, schedule_id, maintenance_type, last_maintenance_date::text, last_maintenance_km,
		          next_due_date::text, next_due_km, alert_days_before, status::text, notes, completed_at::text, created_at::text
	`, vehicleID, scheduleID, maintenanceType, nextDueDate, nextDueKm, alertDaysBefore, notes, createdBy).Scan(
		&m.ID, &m.VehicleID, &m.ScheduleID, &m.MaintenanceType, &m.LastMaintenanceDate, &m.LastMaintenanceKm,
		&m.NextDueDate, &m.NextDueKm, &m.AlertDaysBefore, &m.Status, &m.Notes, &m.CompletedAt, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *BRDGapRepo) CompleteMaintenanceRecord(ctx context.Context, id uuid.UUID, completedBy uuid.UUID, notes *string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE vehicle_maintenance_records
		SET status = 'completed', completed_at = NOW(), completed_by = $2,
		    last_maintenance_date = CURRENT_DATE, notes = COALESCE($3, notes), updated_at = NOW()
		WHERE id = $1
	`, id, completedBy, notes)
	return err
}

// ── Overdue check ────────────────────────────────────

func (r *BRDGapRepo) ListOverdueMaintenanceRecords(ctx context.Context) ([]MaintenanceRecord, error) {
	return r.ListMaintenanceRecords(ctx, nil, "overdue")
}

func (r *BRDGapRepo) MarkOverdueRecords(ctx context.Context) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE vehicle_maintenance_records
		SET status = 'overdue', updated_at = NOW()
		WHERE status = 'pending' AND next_due_date < CURRENT_DATE
	`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ══════════════════════════════════════════════════════
// Handler methods
// ══════════════════════════════════════════════════════

// RegisterBRDGapRoutes adds routes for BRD gap features under /admin
func RegisterBRDGapRoutes(admin *gin.RouterGroup, repo *BRDGapRepo) {
	// Compensation prices
	cp := admin.Group("/compensation-prices")
	cp.GET("", brdListCompensationPrices(repo))
	cp.POST("", brdCreateCompensationPrice(repo))
	cp.PUT("/:id", brdUpdateCompensationPrice(repo))
	cp.DELETE("/:id", brdDeleteCompensationPrice(repo))

	// Forbidden hours
	fh := admin.Group("/forbidden-hours")
	fh.GET("", brdListForbiddenHours(repo))
	fh.POST("", brdCreateForbiddenHour(repo))
	fh.PUT("/:id", brdUpdateForbiddenHour(repo))
	fh.DELETE("/:id", brdDeleteForbiddenHour(repo))

	// Delivery windows
	dw := admin.Group("/delivery-windows")
	dw.GET("", brdListDeliveryWindows(repo))
	dw.POST("", brdCreateDeliveryWindow(repo))
	dw.PUT("/:id", brdUpdateDeliveryWindow(repo))
	dw.DELETE("/:id", brdDeleteDeliveryWindow(repo))

	// Vehicle maintenance
	vm := admin.Group("/maintenance")
	vm.GET("/schedules", brdListMaintenanceSchedules(repo))
	vm.POST("/schedules", brdCreateMaintenanceSchedule(repo))
	vm.GET("/records", brdListMaintenanceRecords(repo))
	vm.POST("/records", brdCreateMaintenanceRecord(repo))
	vm.PUT("/records/:id/complete", brdCompleteMaintenanceRecord(repo))
}

// ── Compensation handler funcs ───────────────────────

func brdListCompensationPrices(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := repo.ListCompensationPrices(c.Request.Context())
		if err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, items)
	}
}

func brdCreateCompensationPrice(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			AssetType      string  `json:"asset_type" binding:"required"`
			UnitPrice      float64 `json:"unit_price" binding:"required"`
			EffectiveFrom  string  `json:"effective_from" binding:"required"`
			EffectiveUntil *string `json:"effective_until"`
			Notes          *string `json:"notes"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		if _, err := time.Parse("2006-01-02", body.EffectiveFrom); err != nil {
			response.BadRequest(c, "effective_from must be YYYY-MM-DD")
			return
		}
		userID := middleware.GetUserID(c)
		p, err := repo.CreateCompensationPrice(c.Request.Context(), body.AssetType, body.UnitPrice, body.EffectiveFrom, body.EffectiveUntil, body.Notes, userID)
		if err != nil {
			response.InternalError(c)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"success": true, "data": p})
	}
}

func brdUpdateCompensationPrice(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "ID không hợp lệ")
			return
		}
		var body struct {
			UnitPrice      float64 `json:"unit_price" binding:"required"`
			EffectiveUntil *string `json:"effective_until"`
			Notes          *string `json:"notes"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		if err := repo.UpdateCompensationPrice(c.Request.Context(), id, body.UnitPrice, body.EffectiveUntil, body.Notes); err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, gin.H{"message": "Đã cập nhật"})
	}
}

func brdDeleteCompensationPrice(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "ID không hợp lệ")
			return
		}
		if err := repo.DeleteCompensationPrice(c.Request.Context(), id); err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, gin.H{"message": "Đã xóa"})
	}
}

// ── Forbidden hours handler funcs ────────────────────

func brdListForbiddenHours(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := repo.ListForbiddenHours(c.Request.Context())
		if err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, items)
	}
}

func brdCreateForbiddenHour(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			ZoneName     string   `json:"zone_name" binding:"required"`
			DayOfWeek    *int     `json:"day_of_week"`
			StartTime    string   `json:"start_time" binding:"required"`
			EndTime      string   `json:"end_time" binding:"required"`
			VehicleTypes []string `json:"vehicle_types"`
			Reason       *string  `json:"reason"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		if body.DayOfWeek != nil && (*body.DayOfWeek < 0 || *body.DayOfWeek > 6) {
			response.BadRequest(c, "day_of_week must be 0-6 (0=Sun)")
			return
		}
		userID := middleware.GetUserID(c)
		f, err := repo.CreateForbiddenHour(c.Request.Context(), body.ZoneName, body.DayOfWeek, body.StartTime, body.EndTime, body.VehicleTypes, body.Reason, userID)
		if err != nil {
			response.InternalError(c)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"success": true, "data": f})
	}
}

func brdUpdateForbiddenHour(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "ID không hợp lệ")
			return
		}
		var body struct {
			ZoneName     string   `json:"zone_name" binding:"required"`
			DayOfWeek    *int     `json:"day_of_week"`
			StartTime    string   `json:"start_time" binding:"required"`
			EndTime      string   `json:"end_time" binding:"required"`
			VehicleTypes []string `json:"vehicle_types"`
			Reason       *string  `json:"reason"`
			IsActive     bool     `json:"is_active"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		if err := repo.UpdateForbiddenHour(c.Request.Context(), id, body.ZoneName, body.DayOfWeek, body.StartTime, body.EndTime, body.VehicleTypes, body.Reason, body.IsActive); err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, gin.H{"message": "Đã cập nhật"})
	}
}

func brdDeleteForbiddenHour(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "ID không hợp lệ")
			return
		}
		if err := repo.DeleteForbiddenHour(c.Request.Context(), id); err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, gin.H{"message": "Đã xóa"})
	}
}

// ── Delivery windows handler funcs ───────────────────

func brdListDeliveryWindows(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := repo.ListDeliveryWindows(c.Request.Context())
		if err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, items)
	}
}

func brdCreateDeliveryWindow(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			WindowName      string  `json:"window_name" binding:"required"`
			DurationMinutes int     `json:"duration_minutes" binding:"required"`
			EffectiveFrom   string  `json:"effective_from" binding:"required"`
			EffectiveUntil  *string `json:"effective_until"`
			Description     *string `json:"description"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		if body.DurationMinutes < 1 {
			response.BadRequest(c, "duration_minutes must be >= 1")
			return
		}
		userID := middleware.GetUserID(c)
		d, err := repo.CreateDeliveryWindow(c.Request.Context(), body.WindowName, body.DurationMinutes, body.EffectiveFrom, body.EffectiveUntil, body.Description, userID)
		if err != nil {
			response.InternalError(c)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"success": true, "data": d})
	}
}

func brdUpdateDeliveryWindow(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "ID không hợp lệ")
			return
		}
		var body struct {
			DurationMinutes int     `json:"duration_minutes" binding:"required"`
			EffectiveUntil  *string `json:"effective_until"`
			Description     *string `json:"description"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		if err := repo.UpdateDeliveryWindow(c.Request.Context(), id, body.DurationMinutes, body.EffectiveUntil, body.Description); err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, gin.H{"message": "Đã cập nhật"})
	}
}

func brdDeleteDeliveryWindow(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "ID không hợp lệ")
			return
		}
		if err := repo.DeleteDeliveryWindow(c.Request.Context(), id); err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, gin.H{"message": "Đã xóa"})
	}
}

// ── Maintenance handler funcs ────────────────────────

func brdListMaintenanceSchedules(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var vehicleID *uuid.UUID
		if vid := c.Query("vehicle_id"); vid != "" {
			id, err := uuid.Parse(vid)
			if err != nil {
				response.BadRequest(c, "invalid vehicle_id")
				return
			}
			vehicleID = &id
		}
		items, err := repo.ListMaintenanceSchedules(c.Request.Context(), vehicleID)
		if err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, items)
	}
}

func brdCreateMaintenanceSchedule(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			VehicleID      uuid.UUID `json:"vehicle_id" binding:"required"`
			ScheduleType   string    `json:"schedule_type" binding:"required"`
			IntervalKm     *int      `json:"interval_km"`
			IntervalMonths *int      `json:"interval_months"`
			Description    *string   `json:"description"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		if body.ScheduleType != "km_based" && body.ScheduleType != "month_based" {
			response.BadRequest(c, "schedule_type must be 'km_based' or 'month_based'")
			return
		}
		userID := middleware.GetUserID(c)
		m, err := repo.CreateMaintenanceSchedule(c.Request.Context(), body.VehicleID, body.ScheduleType, body.IntervalKm, body.IntervalMonths, body.Description, userID)
		if err != nil {
			response.InternalError(c)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"success": true, "data": m})
	}
}

func brdListMaintenanceRecords(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var vehicleID *uuid.UUID
		if vid := c.Query("vehicle_id"); vid != "" {
			id, err := uuid.Parse(vid)
			if err != nil {
				response.BadRequest(c, "invalid vehicle_id")
				return
			}
			vehicleID = &id
		}
		status := c.Query("status")
		items, err := repo.ListMaintenanceRecords(c.Request.Context(), vehicleID, status)
		if err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, items)
	}
}

func brdCreateMaintenanceRecord(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			VehicleID       uuid.UUID  `json:"vehicle_id" binding:"required"`
			ScheduleID      *uuid.UUID `json:"schedule_id"`
			MaintenanceType string     `json:"maintenance_type" binding:"required"`
			NextDueDate     *string    `json:"next_due_date"`
			NextDueKm       *int       `json:"next_due_km"`
			AlertDaysBefore int        `json:"alert_days_before"`
			Notes           *string    `json:"notes"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		if body.AlertDaysBefore == 0 {
			body.AlertDaysBefore = 7
		}
		userID := middleware.GetUserID(c)
		m, err := repo.CreateMaintenanceRecord(c.Request.Context(), body.VehicleID, body.ScheduleID, body.MaintenanceType, body.NextDueDate, body.NextDueKm, body.AlertDaysBefore, body.Notes, userID)
		if err != nil {
			response.InternalError(c)
			return
		}
		c.JSON(http.StatusCreated, gin.H{"success": true, "data": m})
	}
}

func brdCompleteMaintenanceRecord(repo *BRDGapRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "ID không hợp lệ")
			return
		}
		var body struct {
			Notes *string `json:"notes"`
		}
		c.ShouldBindJSON(&body)
		userID := middleware.GetUserID(c)
		if err := repo.CompleteMaintenanceRecord(c.Request.Context(), id, userID, body.Notes); err != nil {
			response.InternalError(c)
			return
		}
		response.OK(c, gin.H{"message": "Đã hoàn thành bảo trì"})
	}
}
