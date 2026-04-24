package tms

import (
	"context"
	"fmt"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
)

// ===== TOLL STATIONS =====

func (r *Repository) ListTollStations(ctx context.Context) ([]domain.TollStation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, station_name, COALESCE(road_name,'')::text, toll_type::text,
			   latitude, longitude, detection_radius_m,
			   fee_l1, fee_l2, fee_l3, fee_l4, fee_l5,
			   is_active, effective_date::text, notes, created_at, updated_at
		FROM toll_stations
		ORDER BY road_name, station_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stations []domain.TollStation
	for rows.Next() {
		var s domain.TollStation
		if err := rows.Scan(&s.ID, &s.StationName, &s.RoadName, &s.TollType,
			&s.Latitude, &s.Longitude, &s.DetectionRadiusM,
			&s.FeeL1, &s.FeeL2, &s.FeeL3, &s.FeeL4, &s.FeeL5,
			&s.IsActive, &s.EffectiveDate, &s.Notes, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		stations = append(stations, s)
	}
	return stations, nil
}

func (r *Repository) ListActiveTollStations(ctx context.Context) ([]domain.TollStation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, station_name, COALESCE(road_name,'')::text, toll_type::text,
			   latitude, longitude, detection_radius_m,
			   fee_l1, fee_l2, fee_l3, fee_l4, fee_l5,
			   is_active, effective_date::text, notes, created_at, updated_at
		FROM toll_stations
		WHERE is_active = true AND effective_date <= CURRENT_DATE
		ORDER BY road_name, station_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stations []domain.TollStation
	for rows.Next() {
		var s domain.TollStation
		if err := rows.Scan(&s.ID, &s.StationName, &s.RoadName, &s.TollType,
			&s.Latitude, &s.Longitude, &s.DetectionRadiusM,
			&s.FeeL1, &s.FeeL2, &s.FeeL3, &s.FeeL4, &s.FeeL5,
			&s.IsActive, &s.EffectiveDate, &s.Notes, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		stations = append(stations, s)
	}
	return stations, nil
}

func (r *Repository) CreateTollStation(ctx context.Context, s *domain.TollStation) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO toll_stations (station_name, road_name, toll_type, latitude, longitude,
			detection_radius_m, fee_l1, fee_l2, fee_l3, fee_l4, fee_l5,
			is_active, effective_date, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14)
		RETURNING id, created_at, updated_at
	`, s.StationName, s.RoadName, s.TollType, s.Latitude, s.Longitude,
		s.DetectionRadiusM, s.FeeL1, s.FeeL2, s.FeeL3, s.FeeL4, s.FeeL5,
		s.IsActive, s.EffectiveDate, s.Notes,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *Repository) UpdateTollStation(ctx context.Context, s *domain.TollStation) error {
	ct, err := r.db.Exec(ctx, `
		UPDATE toll_stations SET
			station_name=$2, road_name=$3, latitude=$4, longitude=$5,
			detection_radius_m=$6, fee_l1=$7, fee_l2=$8, fee_l3=$9, fee_l4=$10, fee_l5=$11,
			is_active=$12, effective_date=$13::date, notes=$14, updated_at=NOW()
		WHERE id=$1
	`, s.ID, s.StationName, s.RoadName, s.Latitude, s.Longitude,
		s.DetectionRadiusM, s.FeeL1, s.FeeL2, s.FeeL3, s.FeeL4, s.FeeL5,
		s.IsActive, s.EffectiveDate, s.Notes)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("toll station not found")
	}
	return nil
}

func (r *Repository) DeleteTollStation(ctx context.Context, id uuid.UUID) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM toll_stations WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("toll station not found")
	}
	return nil
}

// ===== TOLL EXPRESSWAYS =====

func (r *Repository) ListTollExpressways(ctx context.Context) ([]domain.TollExpressway, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, expressway_name,
			   rate_per_km_l1, rate_per_km_l2, rate_per_km_l3, rate_per_km_l4, rate_per_km_l5,
			   is_active, effective_date::text, notes, created_at, updated_at
		FROM toll_expressways
		ORDER BY expressway_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expressways []domain.TollExpressway
	for rows.Next() {
		var e domain.TollExpressway
		if err := rows.Scan(&e.ID, &e.ExpresswayName,
			&e.RatePerKmL1, &e.RatePerKmL2, &e.RatePerKmL3, &e.RatePerKmL4, &e.RatePerKmL5,
			&e.IsActive, &e.EffectiveDate, &e.Notes, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		expressways = append(expressways, e)
	}

	// Load gates for each expressway
	for i, e := range expressways {
		gates, err := r.ListTollExpresswayGates(ctx, e.ID)
		if err != nil {
			return nil, err
		}
		expressways[i].Gates = gates
	}

	return expressways, nil
}

func (r *Repository) ListActiveTollExpressways(ctx context.Context) ([]domain.TollExpressway, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, expressway_name,
			   rate_per_km_l1, rate_per_km_l2, rate_per_km_l3, rate_per_km_l4, rate_per_km_l5,
			   is_active, effective_date::text, notes, created_at, updated_at
		FROM toll_expressways
		WHERE is_active = true AND effective_date <= CURRENT_DATE
		ORDER BY expressway_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expressways []domain.TollExpressway
	for rows.Next() {
		var e domain.TollExpressway
		if err := rows.Scan(&e.ID, &e.ExpresswayName,
			&e.RatePerKmL1, &e.RatePerKmL2, &e.RatePerKmL3, &e.RatePerKmL4, &e.RatePerKmL5,
			&e.IsActive, &e.EffectiveDate, &e.Notes, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		expressways = append(expressways, e)
	}

	for i, e := range expressways {
		gates, err := r.ListTollExpresswayGates(ctx, e.ID)
		if err != nil {
			return nil, err
		}
		expressways[i].Gates = gates
	}

	return expressways, nil
}

func (r *Repository) CreateTollExpressway(ctx context.Context, e *domain.TollExpressway) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO toll_expressways (expressway_name,
			rate_per_km_l1, rate_per_km_l2, rate_per_km_l3, rate_per_km_l4, rate_per_km_l5,
			is_active, effective_date, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9)
		RETURNING id, created_at, updated_at
	`, e.ExpresswayName,
		e.RatePerKmL1, e.RatePerKmL2, e.RatePerKmL3, e.RatePerKmL4, e.RatePerKmL5,
		e.IsActive, e.EffectiveDate, e.Notes,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
}

func (r *Repository) UpdateTollExpressway(ctx context.Context, e *domain.TollExpressway) error {
	ct, err := r.db.Exec(ctx, `
		UPDATE toll_expressways SET
			expressway_name=$2,
			rate_per_km_l1=$3, rate_per_km_l2=$4, rate_per_km_l3=$5, rate_per_km_l4=$6, rate_per_km_l5=$7,
			is_active=$8, effective_date=$9::date, notes=$10, updated_at=NOW()
		WHERE id=$1
	`, e.ID, e.ExpresswayName,
		e.RatePerKmL1, e.RatePerKmL2, e.RatePerKmL3, e.RatePerKmL4, e.RatePerKmL5,
		e.IsActive, e.EffectiveDate, e.Notes)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("toll expressway not found")
	}
	return nil
}

func (r *Repository) DeleteTollExpressway(ctx context.Context, id uuid.UUID) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM toll_expressways WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("toll expressway not found")
	}
	return nil
}

// ===== TOLL EXPRESSWAY GATES =====

func (r *Repository) ListTollExpresswayGates(ctx context.Context, expresswayID uuid.UUID) ([]domain.TollExpresswayGate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, expressway_id, gate_name, gate_type::text, km_marker,
			   latitude, longitude, detection_radius_m, is_active, created_at
		FROM toll_expressway_gates
		WHERE expressway_id=$1
		ORDER BY km_marker
	`, expresswayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var gates []domain.TollExpresswayGate
	for rows.Next() {
		var g domain.TollExpresswayGate
		if err := rows.Scan(&g.ID, &g.ExpresswayID, &g.GateName, &g.GateType,
			&g.KmMarker, &g.Latitude, &g.Longitude, &g.DetectionRadiusM,
			&g.IsActive, &g.CreatedAt); err != nil {
			return nil, err
		}
		gates = append(gates, g)
	}
	return gates, nil
}

func (r *Repository) CreateTollExpresswayGate(ctx context.Context, g *domain.TollExpresswayGate) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker,
			latitude, longitude, detection_radius_m, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id, created_at
	`, g.ExpresswayID, g.GateName, g.GateType, g.KmMarker,
		g.Latitude, g.Longitude, g.DetectionRadiusM, g.IsActive,
	).Scan(&g.ID, &g.CreatedAt)
}

func (r *Repository) DeleteTollExpresswayGate(ctx context.Context, id uuid.UUID) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM toll_expressway_gates WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("toll gate not found")
	}
	return nil
}

// ===== VEHICLE COST =====

func (r *Repository) ListVehicleTypeCostDefaults(ctx context.Context) ([]domain.VehicleTypeCostDefault, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, vehicle_type::text, toll_class::text, fuel_consumption_per_km,
			   fuel_price_per_liter, is_active, effective_date::text, notes, created_at, updated_at
		FROM vehicle_type_cost_defaults
		ORDER BY vehicle_type
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var defaults []domain.VehicleTypeCostDefault
	for rows.Next() {
		var d domain.VehicleTypeCostDefault
		if err := rows.Scan(&d.ID, &d.VehicleType, &d.TollClass,
			&d.FuelConsumptionPerKm, &d.FuelPricePerLiter,
			&d.IsActive, &d.EffectiveDate, &d.Notes, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		defaults = append(defaults, d)
	}
	return defaults, nil
}

func (r *Repository) UpdateVehicleTypeCostDefault(ctx context.Context, d *domain.VehicleTypeCostDefault) error {
	ct, err := r.db.Exec(ctx, `
		UPDATE vehicle_type_cost_defaults SET
			toll_class=$2, fuel_consumption_per_km=$3, fuel_price_per_liter=$4,
			is_active=$5, effective_date=$6::date, notes=$7, updated_at=NOW()
		WHERE id=$1
	`, d.ID, d.TollClass, d.FuelConsumptionPerKm, d.FuelPricePerLiter,
		d.IsActive, d.EffectiveDate, d.Notes)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("vehicle type cost default not found")
	}
	return nil
}

func (r *Repository) GetVehicleCostProfile(ctx context.Context, vehicleID uuid.UUID) (*domain.VehicleCostProfile, error) {
	var p domain.VehicleCostProfile
	err := r.db.QueryRow(ctx, `
		SELECT id, vehicle_id, toll_class::text, fuel_consumption_per_km, fuel_price_per_liter,
			   is_active, effective_date::text, notes, created_at, updated_at
		FROM vehicle_cost_profiles
		WHERE vehicle_id=$1
	`, vehicleID).Scan(&p.ID, &p.VehicleID, &p.TollClass,
		&p.FuelConsumptionPerKm, &p.FuelPricePerLiter,
		&p.IsActive, &p.EffectiveDate, &p.Notes, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) UpsertVehicleCostProfile(ctx context.Context, p *domain.VehicleCostProfile) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO vehicle_cost_profiles (vehicle_id, toll_class, fuel_consumption_per_km,
			fuel_price_per_liter, is_active, effective_date, notes)
		VALUES ($1,$2,$3,$4,$5,$6::date,$7)
		ON CONFLICT (vehicle_id) DO UPDATE SET
			toll_class=EXCLUDED.toll_class,
			fuel_consumption_per_km=EXCLUDED.fuel_consumption_per_km,
			fuel_price_per_liter=EXCLUDED.fuel_price_per_liter,
			is_active=EXCLUDED.is_active,
			effective_date=EXCLUDED.effective_date,
			notes=EXCLUDED.notes,
			updated_at=NOW()
		RETURNING id, created_at, updated_at
	`, p.VehicleID, p.TollClass, p.FuelConsumptionPerKm, p.FuelPricePerLiter,
		p.IsActive, p.EffectiveDate, p.Notes,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *Repository) DeleteVehicleCostProfile(ctx context.Context, vehicleID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM vehicle_cost_profiles WHERE vehicle_id=$1`, vehicleID)
	return err
}

// ResolveVehicleCostInfo resolves cost parameters for each vehicle.
// Uses vehicle_cost_profiles if available, falls back to vehicle_type_cost_defaults.
func (r *Repository) ResolveVehicleCostInfo(ctx context.Context, vehicles []domain.Vehicle) ([]domain.VehicleCostInfo, error) {
	// Load defaults
	defaults, err := r.ListVehicleTypeCostDefaults(ctx)
	if err != nil {
		return nil, fmt.Errorf("load cost defaults: %w", err)
	}
	defaultMap := make(map[string]domain.VehicleTypeCostDefault)
	for _, d := range defaults {
		if d.IsActive {
			defaultMap[d.VehicleType] = d
		}
	}

	var result []domain.VehicleCostInfo
	for _, v := range vehicles {
		info := domain.VehicleCostInfo{
			VehicleID:   v.ID,
			VehicleType: v.VehicleType,
		}

		// Try per-vehicle profile first
		profile, err := r.GetVehicleCostProfile(ctx, v.ID)
		if err == nil && profile.IsActive {
			info.TollClass = profile.TollClass
			info.FuelCostPerKm = profile.FuelConsumptionPerKm * profile.FuelPricePerLiter
		} else if d, ok := defaultMap[v.VehicleType]; ok {
			info.TollClass = d.TollClass
			info.FuelCostPerKm = d.FuelConsumptionPerKm * d.FuelPricePerLiter
		} else {
			// Ultimate fallback
			info.TollClass = "L2"
			info.FuelCostPerKm = 0.15 * 22000 // 0.15 l/km × 22000 VND
		}

		result = append(result, info)
	}
	return result, nil
}

// ===== DRIVER COST RATES =====

func (r *Repository) ListDriverCostRates(ctx context.Context) ([]domain.DriverCostRate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, rate_name, rate_type::text, amount, vehicle_type::text,
			   is_active, effective_date::text, notes, created_at, updated_at
		FROM driver_cost_rates
		ORDER BY rate_type, rate_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rates []domain.DriverCostRate
	for rows.Next() {
		var r domain.DriverCostRate
		if err := rows.Scan(&r.ID, &r.RateName, &r.RateType, &r.Amount, &r.VehicleType,
			&r.IsActive, &r.EffectiveDate, &r.Notes, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		rates = append(rates, r)
	}
	return rates, nil
}

func (r *Repository) CreateDriverCostRate(ctx context.Context, rate *domain.DriverCostRate) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO driver_cost_rates (rate_name, rate_type, amount, vehicle_type,
			is_active, effective_date, notes)
		VALUES ($1,$2,$3,$4,$5,$6::date,$7)
		RETURNING id, created_at, updated_at
	`, rate.RateName, rate.RateType, rate.Amount, rate.VehicleType,
		rate.IsActive, rate.EffectiveDate, rate.Notes,
	).Scan(&rate.ID, &rate.CreatedAt, &rate.UpdatedAt)
}

func (r *Repository) UpdateDriverCostRate(ctx context.Context, rate *domain.DriverCostRate) error {
	ct, err := r.db.Exec(ctx, `
		UPDATE driver_cost_rates SET
			rate_name=$2, rate_type=$3, amount=$4, vehicle_type=$5,
			is_active=$6, effective_date=$7::date, notes=$8, updated_at=NOW()
		WHERE id=$1
	`, rate.ID, rate.RateName, rate.RateType, rate.Amount, rate.VehicleType,
		rate.IsActive, rate.EffectiveDate, rate.Notes)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("driver cost rate not found")
	}
	return nil
}

func (r *Repository) DeleteDriverCostRate(ctx context.Context, id uuid.UUID) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM driver_cost_rates WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("driver cost rate not found")
	}
	return nil
}
