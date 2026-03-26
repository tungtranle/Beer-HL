-- 017 down: Remove handover records
DROP TABLE IF EXISTS handover_records;
DROP TYPE IF EXISTS handover_type;

-- Note: Cannot remove enum values from trip_status in PostgreSQL.
-- The added values (handover_a_signed, unloading_returns, settling, vehicle_breakdown) will remain.
