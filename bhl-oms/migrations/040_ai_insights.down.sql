-- Migration 040 rollback: drop AI insights tables

DROP TABLE IF EXISTS ml_features.npp_risk_signals;
DROP TABLE IF EXISTS ai_insights;
