-- Migration 034: Gamification — Badges & Awards
-- US-TMS-29: Gamification & Incentive Engine

CREATE TABLE IF NOT EXISTS gamification_badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_code      VARCHAR(50)     NOT NULL UNIQUE,
    name            VARCHAR(100)    NOT NULL,
    description     TEXT,
    icon_emoji      VARCHAR(10)     NOT NULL DEFAULT '🏆',
    condition_config JSONB          NOT NULL DEFAULT '{}',
    value_vnd       NUMERIC(15,2)   NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    sort_order      INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS badge_awards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id            UUID            NOT NULL REFERENCES gamification_badges(id),
    driver_id           UUID            NOT NULL REFERENCES drivers(id),
    awarded_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    period_month        DATE            NOT NULL, -- first day of month
    condition_snapshot  JSONB           NOT NULL DEFAULT '{}',
    bonus_vnd           NUMERIC(15,2)   NOT NULL DEFAULT 0,
    created_by          UUID            REFERENCES users(id), -- NULL = auto-award
    UNIQUE(badge_id, driver_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_badge_awards_driver ON badge_awards(driver_id, period_month DESC);

-- Seed default badges
INSERT INTO gamification_badges (badge_code, name, description, icon_emoji, condition_config, value_vnd, sort_order) VALUES
    ('top_driver',     'Tài xế Xuất sắc Tháng', 'Top 3 điểm tổng hợp trong tháng', '🏆',
     '{"type": "top_rank", "max_rank": 3}', 1000000, 1),
    ('otd_champion',   'Vô địch Đúng Giờ', 'OTD Rate = 100% cả tháng (≥15 ngày làm)', '⚡',
     '{"type": "threshold", "metric": "otd_rate", "min_value": 100, "min_days": 15}', 500000, 2),
    ('safe_driver',    'Lái xe An toàn', 'Safety Score ≥ 90 cả tháng', '🛡️',
     '{"type": "threshold", "metric": "safety_score", "min_value": 90}', 500000, 3),
    ('fuel_saver',     'Tiết kiệm Nhiên liệu', 'Tiêu hao thấp hơn định mức ≥ 10%', '💚',
     '{"type": "threshold", "metric": "fuel_saving_pct", "min_value": 10}', 300000, 4),
    ('streak_30',      'Streak 30 ngày', '30 ngày liên tiếp không vi phạm', '🔥',
     '{"type": "streak", "days": 30}', 300000, 5),
    ('epod_master',    'ePOD Master', '30 ngày liên tiếp ePOD đủ + sắc nét', '📸',
     '{"type": "streak", "days": 30, "metric": "epod_complete"}', 200000, 6),
    ('milestone_100',  'Mốc 100 Chuyến', 'Hoàn thành 100 chuyến', '💯',
     '{"type": "milestone", "metric": "total_trips", "value": 100}', 200000, 7)
ON CONFLICT (badge_code) DO NOTHING;
