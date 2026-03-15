-- Rollback migration 007

DROP TABLE IF EXISTS daily_kpi_snapshots;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS daily_close_summaries;
DROP TABLE IF EXISTS discrepancies;
DROP TABLE IF EXISTS reconciliations;
DROP TABLE IF EXISTS integration_dlq;

DROP TYPE IF EXISTS discrepancy_status;
DROP TYPE IF EXISTS recon_type;
DROP TYPE IF EXISTS recon_status;
DROP TYPE IF EXISTS dlq_status;
