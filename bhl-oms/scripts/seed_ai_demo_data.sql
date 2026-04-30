-- ============================================================
-- BHL OMS — AI-Native Demo Data Seed
-- Mục đích: trải nghiệm đầy đủ tất cả AI features như end-user
-- Chạy: xem scripts/apply_ai_demo_seed.bat
-- An toàn: chỉ INSERT + DELETE stale cache — KHÔNG đụng data lịch sử
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. Xóa mock dispatch_brief cache (để Gemini tạo lại khi có KEY)
-- ──────────────────────────────────────────────────────────────
DELETE FROM ai_insights
WHERE insight_type = 'dispatch_brief'
  AND provider LIKE '%mock%';

-- ──────────────────────────────────────────────────────────────
-- 2. GPS Anomalies — 5 bản ghi cho Control Tower + AI Explain
--    Dùng vehicle_id + trip_id + driver_id thực tế trong DB
--    Anomaly types hợp lệ (theo DB check constraint):
--      deviation | stop_overdue | speed_high | off_route
-- ──────────────────────────────────────────────────────────────
INSERT INTO gps_anomalies
  (vehicle_id, trip_id, driver_id, anomaly_type, severity, lat, lng,
   distance_km, duration_min, speed_kmh, description, status, detected_at)
SELECT
  v.vehicle_id, v.trip_id, v.driver_id,
  v.atype, v.sev,
  v.lat, v.lng, v.dist, v.dur, v.spd, v.desc_, v.status_,
  NOW() - (v.offset_min || ' minutes')::interval
FROM (VALUES
  -- xe 1: lệch tuyến QL1A đoạn Hải Dương
  (
    (SELECT vehicle_id FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 0),
    (SELECT id        FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 0),
    (SELECT driver_id FROM trips WHERE vehicle_id IS NOT NULL AND driver_id IS NOT NULL LIMIT 1 OFFSET 0),
    'deviation', 'P1',
    20.9315, 106.3270,
    3.4, 0.0, 0.0,
    'Xe lệch khỏi tuyến QL1A khoảng 3.4km, đi qua đường tắt chưa được phê duyệt',
    'open', 15
  ),
  -- xe 2: dừng lâu bất thường tại kho NPP
  (
    (SELECT vehicle_id FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 1),
    (SELECT id        FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 1),
    (SELECT driver_id FROM trips WHERE vehicle_id IS NOT NULL AND driver_id IS NOT NULL LIMIT 1 OFFSET 1),
    'stop_overdue', 'P1',
    20.8600, 106.6800,
    0.0, 47.0, 0.0,
    'Xe dừng 47 phút tại điểm giao hàng NPP Nguyễn Văn Hùng, vượt 30 phút tiêu chuẩn',
    'open', 30
  ),
  -- xe 3: vi phạm tốc độ trên cao tốc
  (
    (SELECT vehicle_id FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 2),
    (SELECT id        FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 2),
    (SELECT driver_id FROM trips WHERE vehicle_id IS NOT NULL AND driver_id IS NOT NULL LIMIT 1 OFFSET 2),
    'speed_high', 'P0',
    20.9450, 106.4200,
    0.0, 0.0, 95.0,
    'Xe đạt 95km/h trên QL5 (giới hạn 70km/h), cần nhắc nhở tài xế ngay',
    'open', 5
  ),
  -- xe 1 lại: ra khỏi khu vực giao hàng (off_route)
  (
    (SELECT vehicle_id FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 0),
    (SELECT id        FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 0),
    (SELECT driver_id FROM trips WHERE vehicle_id IS NOT NULL AND driver_id IS NOT NULL LIMIT 1 OFFSET 0),
    'off_route', 'P2',
    20.9880, 106.2950,
    5.2, 0.0, 0.0,
    'Xe ra khỏi vùng giao hàng được phép, đang ở khu vực không có điểm giao',
    'acknowledged', 120
  ),
  -- xe 2: dừng lâu thứ 2 (tạo pattern để test PastCount > 0)
  (
    (SELECT vehicle_id FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 1),
    (SELECT id        FROM trips WHERE vehicle_id IS NOT NULL LIMIT 1 OFFSET 1),
    (SELECT driver_id FROM trips WHERE vehicle_id IS NOT NULL AND driver_id IS NOT NULL LIMIT 1 OFFSET 1),
    'stop_overdue', 'P2',
    20.8550, 106.6750,
    0.0, 38.0, 0.0,
    'Xe dừng 38 phút tại điểm giao hàng thứ 2, lái xe không phản hồi điện thoại',
    'resolved', 200
  )
) AS v(vehicle_id, trip_id, driver_id, atype, sev, lat, lng, dist, dur, spd, desc_, status_, offset_min)
WHERE v.vehicle_id IS NOT NULL AND v.trip_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 3. AI Inbox Items — cho dispatcher, dvkh, accountant, admin
--    Đa dạng loại item để test AI Inbox panel đầy đủ
-- ──────────────────────────────────────────────────────────────

-- 3a. Xóa các inbox items demo cũ (nếu có, idempotent)
DELETE FROM ai_inbox_items
WHERE group_key LIKE 'demo.%';

-- 3b. Insert items mới
INSERT INTO ai_inbox_items
  (item_type, priority, title, detail, ai_suggestion, group_key, role, status)
VALUES
  -- Dispatcher: cảnh báo GPS P0
  (
    'gps_alert', 'P0',
    'Xe vi phạm tốc độ — 95 km/h trên QL5',
    'Xe đang đạt 95km/h, vượt giới hạn 70km/h. Khu vực tiềm ẩn TNGT cao. Cần xử lý ngay.',
    '{"action": "call_driver", "label": "Gọi tài xế ngay", "risk": "HIGH", "route": "/dashboard/control-tower", "explain": "Vi phạm tốc độ mức P0 theo ngưỡng 85km/h nội đô/QL"}'::jsonb,
    'demo.gps.speed_high',
    'dispatcher',
    'open'
  ),
  -- Dispatcher: đề xuất tối ưu tuyến
  (
    'route_suggestion', 'P1',
    'Có thể rút ngắn chuyến TRIP-HL-043 thêm 18km',
    'AI phát hiện 2 điểm giao hàng có thể ghép lại và điều chỉnh thứ tự dừng để tiết kiệm ~18km và 35 phút.',
    '{"action": "open_simulation", "label": "Xem đề xuất tuyến", "risk": "LOW", "route": "/dashboard/trips", "explain": "Thuật toán VRP đánh giá lại 7 permutations, giảm tổng quãng đường từ 142km xuống 124km"}'::jsonb,
    'demo.route.opt',
    'dispatcher',
    'open'
  ),
  -- DVKH: NPP chưa đặt hàng 12 ngày
  (
    'npp_churn_risk', 'P1',
    '3 NPP chưa đặt hàng >10 ngày — nguy cơ churn',
    'Trần Văn Bình (14 ngày), Nguyễn Thị Lan (12 ngày), Phạm Minh Tuấn (11 ngày) chưa có đơn hàng mới. Điểm sức khỏe đều dưới 45/100.',
    '{"action": "open_outreach", "label": "Xem danh sách gọi điện", "risk": "MEDIUM", "route": "/dashboard/customers", "explain": "Dựa trên lịch sử đặt hàng trung bình 7 ngày/đơn, gap hiện tại vượt 1.5× ngưỡng bình thường"}'::jsonb,
    'demo.npp.churn',
    'dvkh',
    'open'
  ),
  -- DVKH: AI gợi ý draft Zalo
  (
    'outreach_draft', 'P2',
    'Gợi ý: gửi Zalo chăm sóc NPP Trần Văn Bình',
    'NPP Trần Văn Bình - HD-53 chưa đặt hàng 14 ngày. AI đã soạn sẵn tin nhắn Zalo thân thiện chờ bạn duyệt và gửi.',
    '{"action": "view_zalo_draft", "label": "Xem bản nháp Zalo", "risk": "LOW", "route": "/dashboard/customers", "explain": "Dựa trên chu kỳ đặt hàng trước đây của NPP và seasonal pattern tháng 4"}'::jsonb,
    'demo.npp.zalo_draft',
    'dvkh',
    'open'
  ),
  -- Accountant: NPP sắp vượt hạn mức tín dụng
  (
    'credit_alert', 'P1',
    '2 NPP sắp vượt hạn mức tín dụng',
    'Công ty TNHH Bình An (98% hạn mức) và NPP Hoàng Long (91% hạn mức) đang có đơn hàng mới chờ xác nhận. Cần review trước khi approve.',
    '{"action": "review_credit", "label": "Kiểm tra hạn mức", "risk": "HIGH", "route": "/dashboard/approvals", "explain": "Credit Risk Score: Bình An = 78/100 (HIGH), Hoàng Long = 52/100 (MEDIUM)"}'::jsonb,
    'demo.credit.limit',
    'accountant',
    'open'
  ),
  -- Admin/Management: Daily briefing nudge
  (
    'briefing_ready', 'P2',
    'Tóm tắt điều phối hôm nay đã sẵn sàng',
    'AI đã tổng hợp tình hình vận hành sáng nay: đơn hàng, chuyến đang chạy, cảnh báo GPS, NPP rủi ro.',
    '{"action": "open_briefing", "label": "Đọc tóm tắt", "risk": "LOW", "route": "/dashboard", "explain": "Tổng hợp từ dữ liệu real-time hệ thống"}'::jsonb,
    'demo.briefing.daily',
    'admin',
    'open'
  ),
  -- Dispatcher: gợi ý simulation VRP
  (
    'simulation_suggest', 'P2',
    'Gợi ý: chạy simulation phân công lại 4 chuyến bị trễ',
    'Có 4 chuyến đang trễ >30 phút. AI gợi ý chạy simulation để xem có thể điều chỉnh phân công và tiết kiệm thêm không.',
    '{"action": "open_simulation", "label": "Chạy simulation", "risk": "LOW", "route": "/dashboard/trips", "explain": "4 chuyến trễ do tắc đường QL5B — simulation sẽ tính lại ETA theo tình trạng thực tế"}'::jsonb,
    'demo.simulation.reroute',
    'dispatcher',
    'open'
  ),
  -- Management: NPP rủi ro cao cần theo dõi
  (
    'npp_risk_weekly', 'P2',
    'Báo cáo tuần: 20 NPP có điểm sức khỏe <50',
    'Tuần này 20 NPP được đánh dấu rủi ro trung bình-cao. Doanh thu từ nhóm này chiếm 18% tổng doanh thu. Cần chiến lược giữ chân.',
    '{"action": "view_npp_health", "label": "Xem phân tích NPP", "risk": "MEDIUM", "route": "/dashboard/customers", "explain": "Dựa trên tần suất đặt hàng, trend doanh thu 4 tuần, và thanh toán trễ hạn"}'::jsonb,
    'demo.npp.weekly_risk',
    'management',
    'open'
  )
;

-- ──────────────────────────────────────────────────────────────
-- 4. Xóa cache npp_zalo_draft cũ (để Gemini tạo lại)
-- ──────────────────────────────────────────────────────────────
DELETE FROM ai_insights
WHERE insight_type = 'npp_zalo_draft'
  AND provider LIKE '%mock%';

-- ──────────────────────────────────────────────────────────────
-- 5. Verify (sẽ xuất ra console khi chạy)
-- ──────────────────────────────────────────────────────────────
SELECT
  'gps_anomalies'       AS table_name, COUNT(*) AS rows_inserted FROM gps_anomalies WHERE description LIKE '%km/h%' OR description LIKE '%km%'
UNION ALL
SELECT
  'ai_inbox_items (open)' , COUNT(*) FROM ai_inbox_items WHERE status = 'open' AND group_key LIKE 'demo.%'
UNION ALL
SELECT
  'ai_insights (active)'  , COUNT(*) FROM ai_insights WHERE expires_at > NOW()
;

COMMIT;
