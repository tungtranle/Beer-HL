-- =============================================================================
-- SEED: zalo_confirmations - xác nhận giao hàng qua Zalo OA
-- Logic:
--   - Mỗi epod (có payment collected) → 1 zalo confirmation được gửi cho khách
--   - 75% confirmed (khách click confirm), 10% auto_confirmed (sau 72h),
--     12% sent (chưa confirm), 2% disputed, 1% expired
--   - token: unique per confirmation (base64-like string)
--   - sent_at: ngay khi giao hàng xong (= epod.created_at hoặc payment.collected_at)
-- =============================================================================

INSERT INTO zalo_confirmations (
  id, order_id, customer_id, trip_stop_id,
  token, phone, status,
  total_amount, zalo_msg_id,
  sent_at, confirmed_at, disputed_at, dispute_reason,
  auto_confirmed_at, expired_at,
  created_at, updated_at
)
WITH delivery_data AS (
  SELECT
    so.id             AS order_id,
    so.customer_id,
    ts.id             AS trip_stop_id,
    c.phone,
    p.amount          AS total_amount,
    p.collected_at    AS sent_base,
    (hashtext(ts.id::text)::bigint & 2147483647) AS h
  FROM trip_stops ts
  JOIN shipments sh    ON sh.id = ts.shipment_id
  JOIN sales_orders so ON so.id = sh.order_id
  JOIN customers c     ON c.id = so.customer_id
  JOIN payments p      ON p.trip_stop_id = ts.id AND p.status::text = 'collected'
  JOIN epod e          ON e.trip_stop_id = ts.id
),
classified AS (
  SELECT *,
    CASE
      WHEN MOD(h, 100) < 75 THEN 'confirmed'::zalo_confirm_status
      WHEN MOD(h, 100) < 85 THEN 'auto_confirmed'::zalo_confirm_status
      WHEN MOD(h, 100) < 97 THEN 'sent'::zalo_confirm_status
      WHEN MOD(h, 100) < 99 THEN 'disputed'::zalo_confirm_status
      ELSE 'expired'::zalo_confirm_status
    END AS zalo_status,
    -- sent_at = collected_at + 5–30 phút (hệ thống gửi sau khi xác nhận thu tiền)
    sent_base + ((5 + MOD(h, 25)) * INTERVAL '1 minute') AS sent_ts
  FROM delivery_data
)
SELECT
  gen_random_uuid()   AS id,
  order_id,
  customer_id,
  trip_stop_id,
  -- token: hex ngắn từ hash (unique per record)
  encode(digest(trip_stop_id::text || h::text, 'sha256'), 'hex')::varchar(32) AS token,
  phone,
  zalo_status,
  total_amount,
  -- zalo_msg_id: format giả lập Zalo Business API
  'ZALOMSG' || TO_CHAR(sent_ts, 'YYYYMMDD') || LPAD(MOD(h, 99999)::text, 5, '0') AS zalo_msg_id,
  sent_ts             AS sent_at,

  -- confirmed_at: 30 phút – 24 giờ sau khi gửi (hành vi thực tế khách hàng)
  CASE WHEN zalo_status IN ('confirmed'::zalo_confirm_status)
    THEN sent_ts + ((30 + MOD(h, 1410)) * INTERVAL '1 minute')  -- 30 min – 23.5h
    ELSE NULL
  END AS confirmed_at,

  -- disputed_at
  CASE WHEN zalo_status = 'disputed'::zalo_confirm_status
    THEN sent_ts + INTERVAL '2 hours'
    ELSE NULL
  END AS disputed_at,

  CASE WHEN zalo_status = 'disputed'::zalo_confirm_status
    THEN CASE MOD(h, 3)
      WHEN 0 THEN 'Hàng không đúng chủng loại so với đơn đặt'
      WHEN 1 THEN 'Số lượng nhận được không đủ so với hóa đơn'
      ELSE 'Hàng bị hư hỏng trong quá trình vận chuyển'
    END
    ELSE NULL
  END AS dispute_reason,

  -- auto_confirmed_at: 72 giờ sau khi gửi (quy tắc auto-confirm)
  CASE WHEN zalo_status = 'auto_confirmed'::zalo_confirm_status
    THEN sent_ts + INTERVAL '72 hours'
    ELSE NULL
  END AS auto_confirmed_at,

  -- expired_at: 7 ngày nếu không phản hồi
  CASE WHEN zalo_status = 'expired'::zalo_confirm_status
    THEN sent_ts + INTERVAL '7 days'
    ELSE NULL
  END AS expired_at,

  sent_ts AS created_at,
  sent_ts + INTERVAL '1 hour' AS updated_at

FROM classified;

-- Kết quả
SELECT
  status::text,
  COUNT(*) AS cnt,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM zalo_confirmations
GROUP BY status::text ORDER BY cnt DESC;
