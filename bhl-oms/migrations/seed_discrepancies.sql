-- =============================================================================
-- SEED: discrepancies từ gate_check failures + reconciliation variances
-- Logic:
--   - 1170 gate_check fail → mỗi cái tạo 1 discrepancy ticket
--   - Thêm ~200 payment discrepancies từ reconciliation variance cao
--   - disc_type: cần xác nhận từ enum hiện tại
-- =============================================================================

-- disc_type column is recon_type enum: goods | payment | asset
-- status column is discrepancy_status enum: open | investigating | resolved | escalated | closed

-- Seed từ gate_check failures (hàng thiếu tại cổng)
INSERT INTO discrepancies (
  id, recon_id, trip_id, stop_id,
  disc_type, status, description,
  expected_value, actual_value, variance,
  resolution, assigned_to, deadline,
  created_at, updated_at
)
WITH failed_gates AS (
  SELECT
    gc.id AS gate_check_id,
    gc.trip_id,
    gc.shipment_id,
    ts.id AS stop_id,
    r.id AS recon_id,
    gc.discrepancy_details,
    gc.exit_time,
    (hashtext(gc.id::text)::bigint & 2147483647) AS h,
    -- Giá trị lô hàng ước tính: lấy từ reconciliation nếu có
    COALESCE(r.expected_value, 5000000 + ((hashtext(gc.shipment_id::text)::bigint & 2147483647) % 15000000)::numeric) AS est_value
  FROM gate_checks gc
  JOIN trip_stops ts ON ts.shipment_id = gc.shipment_id AND ts.trip_id = gc.trip_id
  LEFT JOIN reconciliations r ON r.trip_id = gc.trip_id AND r.recon_type::text = 'goods'
  WHERE gc.result::text = 'fail'
),
-- Phân loại status: 60% resolved, 25% closed, 10% investigating, 5% escalated
classified AS (
  SELECT *,
    CASE
      WHEN MOD(h, 100) < 60 THEN 'resolved'::discrepancy_status
      WHEN MOD(h, 100) < 85 THEN 'closed'::discrepancy_status
      WHEN MOD(h, 100) < 95 THEN 'investigating'::discrepancy_status
      ELSE 'escalated'::discrepancy_status
    END AS disc_status,
    -- Variance: 2-15% giá trị lô hàng
    ROUND((est_value * (0.02 + MOD(h, 13)::float/100))::numeric, 0) AS var_amount
  FROM failed_gates
)
SELECT
  gen_random_uuid()                AS id,
  c.recon_id,
  c.trip_id,
  c.stop_id,
  'goods'::recon_type              AS disc_type,
  c.disc_status,
  'Phát hiện hàng thiếu tại cổng xuất kho: ' ||
    COALESCE(c.discrepancy_details->>'note', 'Kiện hàng không khớp phiếu') AS description,
  c.est_value                      AS expected_value,
  c.est_value - c.var_amount       AS actual_value,
  c.var_amount                     AS variance,

  CASE c.disc_status::text
    WHEN 'resolved' THEN 'Đã xác minh lại với thủ kho, điều chỉnh phiếu xuất'
    WHEN 'closed'   THEN 'Bồi thường đã xử lý, đóng ticket'
    ELSE NULL
  END AS resolution,

  'eb57be3f-e8a3-4b4e-d806-3e7863d25eb4'::uuid AS assigned_to,  -- admin

  c.exit_time + INTERVAL '2 days'  AS deadline,
  c.exit_time                      AS created_at,
  c.exit_time + (
    CASE c.disc_status::text
      WHEN 'resolved'      THEN INTERVAL '3 days'
      WHEN 'closed'        THEN INTERVAL '5 days'
      WHEN 'investigating' THEN INTERVAL '1 day'
      ELSE INTERVAL '6 hours'
    END
  )                                AS updated_at

FROM classified c;

-- Kết quả
SELECT
  disc_type::text,
  status::text,
  COUNT(*)                                   AS count,
  ROUND(AVG(variance)::numeric / 1000, 0)    AS avg_variance_k_vnd,
  ROUND(SUM(variance)::numeric / 1000000, 1) AS total_variance_m_vnd
FROM discrepancies
GROUP BY disc_type::text, status::text
ORDER BY disc_type::text, count DESC;
