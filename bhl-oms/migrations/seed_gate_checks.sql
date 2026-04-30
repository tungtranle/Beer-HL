-- =============================================================================
-- SEED: gate_checks cho 27,969 shipments chưa có
-- Logic:
--   - 96% kết quả 'pass': scanned_items = expected_items (shipment.items)
--   - 4% kết quả 'fail': scanned_items thiếu 1 mặt hàng, có discrepancy_details
--   - checked_by = security user của kho tương ứng
--   - exit_time = trip.started_at + 10–25 phút (xe xếp hàng xong, làm thủ tục cổng)
--   - Kho HL: security e39a5104-4a2c-4708-4891-7a316d0053cd (security.hl)
--   - Kho HP: security 3d6b4c6c-6817-44bc-1fb7-a0533450a696 (security.hp)
-- =============================================================================

INSERT INTO gate_checks (
  id,
  trip_id,
  shipment_id,
  expected_items,
  scanned_items,
  result,
  discrepancy_details,
  checked_by,
  exit_time,
  created_at
)
WITH missing_shipments AS (
  SELECT
    s.id                AS shipment_id,
    s.warehouse_id,
    s.items             AS expected_items,
    ts.trip_id,
    t.started_at,
    ABS(hashtext(s.id::text)::bigint & 2147483647)  AS h
  FROM shipments s
  JOIN trip_stops ts ON ts.shipment_id = s.id
  JOIN trips t       ON t.id = ts.trip_id
  WHERE NOT EXISTS (
    SELECT 1 FROM gate_checks gc WHERE gc.shipment_id = s.id
  )
    AND t.started_at IS NOT NULL
),
classified AS (
  SELECT *,
    -- 96% pass, 4% fail
    CASE WHEN MOD(h, 100) < 4 THEN 'fail' ELSE 'pass' END AS chk_result,

    -- Security user theo warehouse
    CASE
      WHEN warehouse_id = 'a0000000-0000-0000-0000-000000000001'
        THEN 'e39a5104-4a2c-4708-4891-7a316d0053cd'::uuid
      ELSE '3d6b4c6c-6817-44bc-1fb7-a0533450a696'::uuid
    END AS security_user,

    -- exit_time = started_at + 10–25 phút (bảo vệ kiểm tra và ghi sổ)
    started_at + ((10 + MOD(h, 15)) * INTERVAL '1 minute') AS exit_ts
  FROM missing_shipments
)
SELECT
  gen_random_uuid()     AS id,
  trip_id,
  shipment_id,

  expected_items,

  -- scanned_items: pass = same as expected, fail = thiếu phần tử cuối cùng
  CASE
    WHEN chk_result = 'pass' THEN expected_items
    ELSE
      CASE
        WHEN jsonb_array_length(expected_items) > 1
          THEN expected_items - (jsonb_array_length(expected_items) - 1)
        ELSE expected_items  -- chỉ 1 item thì để nguyên (sẽ ghi discrepancy về qty)
      END
  END AS scanned_items,

  chk_result::gate_check_result AS result,

  -- discrepancy_details chỉ có khi fail
  CASE
    WHEN chk_result = 'fail' THEN
      jsonb_build_object(
        'type', 'missing_item',
        'note', 'Thùng hàng cuối không khớp với phiếu xuất kho',
        'item_index', jsonb_array_length(expected_items) - 1,
        'action', 'Tạm giữ lại, liên hệ thủ kho kiểm tra'
      )
    ELSE NULL
  END AS discrepancy_details,

  security_user         AS checked_by,
  exit_ts               AS exit_time,
  exit_ts               AS created_at

FROM classified;

-- Kết quả
SELECT
  COUNT(*)                                           AS total_gate_checks,
  COUNT(DISTINCT shipment_id)                        AS shipments_covered,
  SUM(CASE WHEN result::text = 'pass' THEN 1 ELSE 0 END) AS pass_count,
  SUM(CASE WHEN result::text = 'fail' THEN 1 ELSE 0 END) AS fail_count,
  ROUND(100.0 * SUM(CASE WHEN result::text = 'pass' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pass_pct
FROM gate_checks;
