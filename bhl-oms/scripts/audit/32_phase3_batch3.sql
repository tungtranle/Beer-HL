-- ===================================================================
-- PHASE 3 — BATCH 3: driver_checkins + driver_scores + documents
--                   + gate_checks + notifications
-- ===================================================================

BEGIN;
SET LOCAL statement_timeout = 0;

DO $$
DECLARE adm uuid;
BEGIN
    SELECT id INTO adm FROM users WHERE username='admin' LIMIT 1;
    PERFORM set_config('app.adm_id', adm::text, false);
END $$;

-- 1) Driver_checkins — for every (driver, date) where driver actually drove a trip
INSERT INTO driver_checkins (driver_id, checkin_date, status, reason, note, checked_in_at)
SELECT DISTINCT
    t.driver_id,
    t.planned_date,
    'available',
    NULL,
    NULL,
    t.planned_date::timestamptz + INTERVAL '6 hours' + (ABS(hashtext(t.driver_id::text||t.planned_date::text)) % 60 || ' minutes')::interval
FROM trips t
WHERE t.driver_id IS NOT NULL AND t.status='completed'
ON CONFLICT (driver_id, checkin_date) DO NOTHING;

-- Add some 'leave' / 'sick' checkins for non-trip days (~5% of working days)
INSERT INTO driver_checkins (driver_id, checkin_date, status, reason, note, checked_in_at)
SELECT
    d.id,
    dt::date,
    (CASE WHEN ABS(hashtext(d.id::text||dt::text)) % 100 < 60 THEN 'leave'
          WHEN ABS(hashtext(d.id::text||dt::text)) % 100 < 85 THEN 'sick'
          ELSE 'training' END),
    'Nghỉ phép định kỳ',
    NULL,
    dt::timestamptz + INTERVAL '6 hours'
FROM drivers d
CROSS JOIN generate_series('2025-01-01'::date, '2026-04-23'::date, '1 day'::interval) AS dt
WHERE EXTRACT(DOW FROM dt) NOT IN (0)  -- not Sunday
  AND ABS(hashtext(d.id::text||dt::text||'leave')) % 100 < 3 -- ~3% chance per day
ON CONFLICT (driver_id, checkin_date) DO NOTHING;

\echo 'Driver checkins'
SELECT status, COUNT(*) FROM driver_checkins GROUP BY status;

-- 2) Driver_documents — license + health cert per driver
INSERT INTO driver_documents (driver_id, doc_type, doc_number, issued_date, expiry_date, license_class, notes, created_by, created_at, updated_at)
SELECT
    d.id, 'driver_license',
    'B2-' || LPAD((ABS(hashtext(d.id::text)) % 9000000 + 1000000)::text, 7, '0'),
    '2022-01-01'::date + (ABS(hashtext(d.id::text||'iss')) % 365 || ' days')::interval,
    -- expiry: 80% future, 15% expiring soon (next 90d), 5% expired
    CASE WHEN ABS(hashtext(d.id::text||'lic')) % 100 < 80 THEN '2027-06-30'::date + (ABS(hashtext(d.id::text)) % 365 || ' days')::interval
         WHEN ABS(hashtext(d.id::text||'lic')) % 100 < 95 THEN '2026-04-24'::date + (ABS(hashtext(d.id::text)) % 90 || ' days')::interval
         ELSE '2026-04-23'::date - (ABS(hashtext(d.id::text)) % 60 || ' days')::interval END,
    'C', NULL, current_setting('app.adm_id')::uuid, NOW(), NOW()
FROM drivers d
ON CONFLICT (driver_id, doc_type) DO NOTHING;

INSERT INTO driver_documents (driver_id, doc_type, doc_number, issued_date, expiry_date, notes, created_by, created_at, updated_at)
SELECT
    d.id, 'health_cert',
    'HC-' || SUBSTR(d.id::text, 1, 8),
    '2025-06-01'::date,
    '2026-06-01'::date + (ABS(hashtext(d.id::text||'hc')) % 180 || ' days')::interval,
    NULL, current_setting('app.adm_id')::uuid, NOW(), NOW()
FROM drivers d
ON CONFLICT (driver_id, doc_type) DO NOTHING;

\echo 'Driver documents'
SELECT doc_type, COUNT(*),
       COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) expired,
       COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90) expiring_soon
FROM driver_documents GROUP BY doc_type;

-- 3) Vehicle_documents — registration, inspection, insurance per vehicle
INSERT INTO vehicle_documents (vehicle_id, doc_type, doc_number, issued_date, expiry_date, notes, created_by, created_at, updated_at)
SELECT
    v.id, dt.dt_type,
    dt.dt_type || '-' || SUBSTR(v.id::text, 1, 8),
    '2024-01-01'::date + (ABS(hashtext(v.id::text||dt.dt_type)) % 365 || ' days')::interval,
    -- mix expiry per type: registration: 5yr, inspection: 1yr, insurance: 1yr
    CASE dt.dt_type
        WHEN 'registration' THEN '2028-01-01'::date + (ABS(hashtext(v.id::text||dt.dt_type)) % 365 || ' days')::interval
        ELSE '2026-04-24'::date + ((ABS(hashtext(v.id::text||dt.dt_type)) % 360) - 60 || ' days')::interval
    END,
    NULL, current_setting('app.adm_id')::uuid, NOW(), NOW()
FROM vehicles v
CROSS JOIN (VALUES ('registration'),('inspection'),('insurance')) AS dt(dt_type)
ON CONFLICT (vehicle_id, doc_type) DO NOTHING;

\echo 'Vehicle documents'
SELECT doc_type, COUNT(*),
       COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) expired,
       COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90) expiring_soon
FROM vehicle_documents GROUP BY doc_type;

-- 4) Driver_scores — daily score per driver per working day
INSERT INTO driver_scores (
    driver_id, score_date, total_score, otd_score, delivery_score,
    safety_score, compliance_score, customer_score,
    trips_count, stops_count, on_time_count, delivered_count, failed_count,
    speed_violations, checklist_completions, epod_completions, model_version
)
SELECT
    t.driver_id,
    t.planned_date,
    -- Total = weighted avg
    ROUND( (otd*0.3 + dlv*0.3 + sf*0.15 + cmp*0.15 + cust*0.1)::numeric, 1) AS total_score,
    otd, dlv, sf, cmp, cust,
    trip_cnt, stop_cnt, on_time, delivered_cnt, failed_cnt,
    speed_v, ck_cnt, ep_cnt,
    'rule_v1'
FROM (
    SELECT
        t.driver_id, t.planned_date,
        COUNT(DISTINCT t.id) AS trip_cnt,
        COUNT(ts.id) AS stop_cnt,
        COUNT(ts.id) FILTER (WHERE ts.status='delivered') AS delivered_cnt,
        COUNT(ts.id) FILTER (WHERE ts.status IN ('failed','skipped')) AS failed_cnt,
        COUNT(ts.id) FILTER (WHERE ts.actual_arrival <= ts.estimated_arrival + INTERVAL '15 minutes') AS on_time,
        COUNT(ts.id) FILTER (WHERE ts.status IN ('delivered','partially_delivered')) AS ep_cnt,
        COUNT(DISTINCT t.id) AS ck_cnt, -- assume 100% checklist completion
        ROUND( 85 + (RANDOM() * 13)::numeric, 1) AS otd,
        ROUND( 80 + (RANDOM() * 18)::numeric, 1) AS dlv,
        ROUND( 80 + (RANDOM() * 19)::numeric, 1) AS sf,
        ROUND( 88 + (RANDOM() * 11)::numeric, 1) AS cmp,
        ROUND( 80 + (RANDOM() * 18)::numeric, 1) AS cust,
        (RANDOM() * 2)::int AS speed_v
    FROM trips t
    LEFT JOIN trip_stops ts ON ts.trip_id = t.id
    WHERE t.driver_id IS NOT NULL AND t.status='completed'
    GROUP BY t.driver_id, t.planned_date
) AS x(driver_id, planned_date, trip_cnt, stop_cnt, delivered_cnt, failed_cnt, on_time, ep_cnt, ck_cnt, otd, dlv, sf, cmp, cust, speed_v)
JOIN trips t ON t.driver_id=x.driver_id AND t.planned_date=x.planned_date
GROUP BY t.driver_id, t.planned_date, otd, dlv, sf, cmp, cust, trip_cnt, stop_cnt, on_time, delivered_cnt, failed_cnt, speed_v, ck_cnt, ep_cnt
ON CONFLICT (driver_id, score_date) DO NOTHING;

\echo 'Driver scores'
SELECT COUNT(*) total,
       ROUND(AVG(total_score)::numeric,1) avg_score,
       MIN(total_score) min_s, MAX(total_score) max_s
FROM driver_scores;

-- Update drivers.current_score from latest snapshot
UPDATE drivers d
SET current_score = sub.s
FROM (
    SELECT DISTINCT ON (driver_id) driver_id, total_score AS s
    FROM driver_scores ORDER BY driver_id, score_date DESC
) sub WHERE d.id = sub.driver_id;

-- 5) Driver_score_snapshots — monthly aggregate
INSERT INTO driver_score_snapshots (
    driver_id, snapshot_month,
    avg_total_score, avg_otd, avg_delivery, avg_safety, avg_compliance, avg_customer,
    total_trips, total_stops, rank_position, rank_total
)
SELECT
    driver_id, mth,
    ROUND(AVG(total_score)::numeric,1),
    ROUND(AVG(otd_score)::numeric,1), ROUND(AVG(delivery_score)::numeric,1),
    ROUND(AVG(safety_score)::numeric,1), ROUND(AVG(compliance_score)::numeric,1),
    ROUND(AVG(customer_score)::numeric,1),
    SUM(trips_count)::int, SUM(stops_count)::int,
    NULL, NULL
FROM (
    SELECT driver_id, date_trunc('month', score_date)::date AS mth,
           total_score, otd_score, delivery_score, safety_score, compliance_score, customer_score,
           trips_count, stops_count
    FROM driver_scores
) x
GROUP BY driver_id, mth
ON CONFLICT (driver_id, snapshot_month) DO NOTHING;

-- compute ranks per month
WITH ranked AS (
    SELECT id, RANK() OVER (PARTITION BY snapshot_month ORDER BY avg_total_score DESC) rnk,
                COUNT(*) OVER (PARTITION BY snapshot_month) tot
    FROM driver_score_snapshots
)
UPDATE driver_score_snapshots dss
SET rank_position = r.rnk, rank_total = r.tot
FROM ranked r WHERE dss.id = r.id;

\echo 'Driver snapshots'
SELECT COUNT(*) FROM driver_score_snapshots;

-- 6) Gate_checks — security check 1 per trip
INSERT INTO gate_checks (trip_id, shipment_id, expected_items, scanned_items, result, checked_by, exit_time, created_at)
SELECT
    t.id,
    (SELECT s.id FROM trip_stops ts JOIN shipments s ON s.id=ts.shipment_id WHERE ts.trip_id=t.id LIMIT 1),
    jsonb_build_object('total_stops', t.total_stops, 'total_weight_kg', t.total_weight_kg),
    jsonb_build_object('scanned_stops', t.total_stops, 'scanned_weight_kg', t.total_weight_kg),
    -- 97% pass, 3% fail
    (CASE WHEN ABS(hashtext(t.id::text||'gc')) % 100 < 97 THEN 'pass' ELSE 'fail' END) :: gate_check_result,
    (SELECT id FROM users WHERE role='security' AND username LIKE 'security%' ORDER BY username LIMIT 1),
    COALESCE(t.started_at, t.planned_date::timestamptz + INTERVAL '7 hours'),
    COALESCE(t.started_at, t.planned_date::timestamptz + INTERVAL '7 hours') - INTERVAL '15 minutes'
FROM trips t
WHERE t.status='completed'
  AND EXISTS (SELECT 1 FROM trip_stops ts WHERE ts.trip_id=t.id AND ts.shipment_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM gate_checks gc WHERE gc.trip_id=t.id);

\echo 'Gate checks'
SELECT result::text, COUNT(*) FROM gate_checks GROUP BY result;

-- 7) Notifications — sample for management dashboard (last 30 days)
-- For each manager-role user, generate 5-15 sample notifications
INSERT INTO notifications (user_id, title, body, category, is_read, created_at, priority, entity_type)
SELECT
    u.id,
    n.title,
    n.body,
    n.category,
    -- 70% read, 30% unread
    (ABS(hashtext(u.id::text||n.title||'r')) % 100 < 70),
    now() - ((ABS(hashtext(u.id::text||n.title||'t')) % 30) || ' days')::interval
         - ((ABS(hashtext(u.id::text||n.title||'h')) % 24) || ' hours')::interval,
    n.priority,
    n.entity_type
FROM users u
CROSS JOIN (VALUES
    ('Đơn hàng mới chờ duyệt', 'Có 5 đơn hàng từ NPP cần duyệt ATP/Credit', 'order', 'high', 'sales_order'),
    ('Trip hoàn thành', 'Tài xế Nguyễn Văn A đã hoàn thành chuyến', 'trip', 'normal', 'trip'),
    ('Đối soát chênh lệch', 'Có 3 chuyến phát sinh chênh lệch trong ngày', 'reconciliation', 'high', 'reconciliation'),
    ('Cảnh báo giấy tờ sắp hết hạn', 'GPLX của 2 tài xế hết hạn trong 30 ngày tới', 'document', 'high', 'driver_document'),
    ('Đăng kiểm xe sắp hết', '3 xe cần đi đăng kiểm trong tuần', 'document', 'high', 'vehicle_document'),
    ('Báo cáo KPI tuần', 'OTD tuần đạt 92.5%, vượt mục tiêu', 'kpi', 'normal', NULL),
    ('Sự cố giao hàng', 'Khách hàng từ chối nhận hàng tại điểm 5', 'incident', 'high', 'trip_stop'),
    ('Hoàn thành EOD', 'Tài xế đã kết ca thành công', 'eod', 'normal', 'eod_session'),
    ('Vỏ chai chênh lệch', 'Workshop báo thiếu 12 vỏ so với kê khai', 'asset', 'normal', 'return_collection'),
    ('Nhắc nhở thanh toán', 'NPP X có công nợ vượt hạn mức', 'finance', 'high', 'customer')
) AS n(title, body, category, priority, entity_type)
WHERE u.role IN ('admin','dispatcher','management','accountant','warehouse_handler','dvkh','workshop')
ON CONFLICT DO NOTHING;

\echo 'Notifications'
SELECT category, priority, COUNT(*), COUNT(*) FILTER (WHERE NOT is_read) unread
FROM notifications GROUP BY 1,2 ORDER BY 1,2;

\echo '--- BATCH 3 SUMMARY ---'
SELECT 'driver_checkins' tbl, COUNT(*)::text FROM driver_checkins
UNION ALL SELECT 'driver_documents', COUNT(*)::text FROM driver_documents
UNION ALL SELECT 'vehicle_documents', COUNT(*)::text FROM vehicle_documents
UNION ALL SELECT 'driver_scores', COUNT(*)::text FROM driver_scores
UNION ALL SELECT 'driver_score_snapshots', COUNT(*)::text FROM driver_score_snapshots
UNION ALL SELECT 'gate_checks', COUNT(*)::text FROM gate_checks
UNION ALL SELECT 'notifications', COUNT(*)::text FROM notifications;

COMMIT;
ANALYZE;
