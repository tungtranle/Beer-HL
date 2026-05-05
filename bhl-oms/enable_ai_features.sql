-- Enable AI features in BHL OMS
INSERT INTO ai_feature_flags (flag_key, scope_type, scope_id, enabled, config, updated_at)
VALUES
  ('ai.master', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.briefing', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.explainability', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.credit_score', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.forecast', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.gps_anomaly', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.copilot', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.intent', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.simulation', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.voice', 'org', 'bhl', false, '{}'::jsonb, NOW()),
  ('ai.camera', 'org', 'bhl', false, '{}'::jsonb, NOW())
ON CONFLICT (flag_key, scope_type, scope_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW();
