-- ===================================================================
-- PHASE 3 — BATCH 1: ePOD + Payments + Delivery Attempts + Returns
-- ===================================================================
-- Volumes expected:
--   epod: ~28.7K (delivered + partially_delivered)
--   payments: ~28.7K
--   delivery_attempts: ~5K (failed + partial)
--   return_collections: ~28.7K (vỏ chai trả về)
-- ===================================================================

BEGIN;
SET LOCAL statement_timeout = 0;

-- Need a created_by user id (any admin/dispatcher)
DO $$
DECLARE adm uuid;
BEGIN
    SELECT id INTO adm FROM users WHERE username='admin' LIMIT 1;
    PERFORM set_config('app.adm_id', adm::text, false);
END $$;

-- 1) ePOD — for delivered + partially_delivered stops (~28.7K)
INSERT INTO epod (
    trip_stop_id, driver_id, customer_id, delivered_items,
    receiver_name, receiver_phone, signature_url, photo_urls,
    total_amount, deposit_amount, delivery_status,
    reject_reason, reject_detail, reject_photos,
    created_at, updated_at
)
SELECT
    ts.id,
    t.driver_id,
    ts.customer_id,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'product_id', oi.product_id, 'qty', oi.quantity,
        'delivered_qty', CASE WHEN ts.status='partially_delivered' THEN GREATEST(1, (oi.quantity*0.7)::int) ELSE oi.quantity END
    )) FROM order_items oi JOIN shipments s ON s.order_id=oi.order_id WHERE s.id=ts.shipment_id), '[]'::jsonb),
    'Người nhận ' || SUBSTR(c.code, 1, 8),
    c.phone,
    'https://storage.bhl.local/sig/' || ts.id::text || '.png',
    ARRAY['https://storage.bhl.local/photo/' || ts.id::text || '_1.jpg',
          'https://storage.bhl.local/photo/' || ts.id::text || '_2.jpg']::text[],
    CASE WHEN ts.status='partially_delivered' THEN ROUND(o.total_amount * 0.7, 0) ELSE o.total_amount END,
    o.deposit_amount,
    CASE WHEN ts.status='partially_delivered' THEN 'partial' ELSE 'delivered' END,
    NULL, NULL, '{}'::text[],
    COALESCE(ts.actual_departure, t.completed_at, t.planned_date::timestamptz + INTERVAL '12 hours'),
    NOW()
FROM trip_stops ts
JOIN trips t ON t.id = ts.trip_id
JOIN customers c ON c.id = ts.customer_id
JOIN shipments s ON s.id = ts.shipment_id
JOIN sales_orders o ON o.id = s.order_id
WHERE ts.status IN ('delivered','partially_delivered')
  AND NOT EXISTS (SELECT 1 FROM epod e WHERE e.trip_stop_id = ts.id);

\echo 'ePOD inserted'
SELECT COUNT(*) FROM epod;

-- 2) ePOD reject records — for failed stops
INSERT INTO epod (
    trip_stop_id, driver_id, customer_id, delivered_items,
    total_amount, deposit_amount, delivery_status,
    reject_reason, reject_detail, reject_photos, created_at, updated_at
)
SELECT
    ts.id, t.driver_id, ts.customer_id, '[]'::jsonb,
    0, 0, 'rejected',
    (ARRAY['customer_absent','customer_refused','damaged_goods','wrong_address','no_payment'])
        [(ABS(hashtext(ts.id::text)) % 5) + 1],
    'Khách không nhận hàng — đã liên hệ và sẽ giao lại',
    ARRAY['https://storage.bhl.local/photo/reject_' || ts.id::text || '.jpg']::text[],
    COALESCE(t.completed_at, t.planned_date::timestamptz + INTERVAL '14 hours'),
    NOW()
FROM trip_stops ts
JOIN trips t ON t.id = ts.trip_id
WHERE ts.status = 'failed'
  AND NOT EXISTS (SELECT 1 FROM epod e WHERE e.trip_stop_id = ts.id);

\echo 'ePOD with rejects'
SELECT delivery_status, COUNT(*) FROM epod GROUP BY delivery_status;

-- 3) Payments — for delivered + partial (link to epod)
INSERT INTO payments (
    trip_stop_id, epod_id, customer_id, driver_id, order_id,
    payment_method, amount, status, reference_number, notes,
    collected_at, confirmed_at, confirmed_by, created_at, updated_at
)
SELECT
    ts.id,
    e.id,
    ts.customer_id,
    t.driver_id,
    s.order_id,
    -- 60% cash, 25% transfer, 15% credit
    (ARRAY['cash','cash','cash','cash','cash','cash','transfer','transfer','transfer','credit'])
        [(ABS(hashtext(ts.id::text || 'pm')) % 10) + 1] :: payment_method,
    e.total_amount,
    -- 90% confirmed, 10% still collected (pending confirmation)
    CASE WHEN ABS(hashtext(ts.id::text || 'ps')) % 10 < 9
         THEN 'confirmed'::payment_status
         ELSE 'collected'::payment_status END,
    'PAY-' || TO_CHAR(t.planned_date,'YYYYMMDD') || '-' || SUBSTR(ts.id::text, 1, 8),
    NULL,
    COALESCE(ts.actual_departure, t.completed_at, t.planned_date::timestamptz + INTERVAL '13 hours'),
    CASE WHEN ABS(hashtext(ts.id::text || 'ps')) % 10 < 9
         THEN COALESCE(ts.actual_departure, t.completed_at) + INTERVAL '4 hours' ELSE NULL END,
    CASE WHEN ABS(hashtext(ts.id::text || 'ps')) % 10 < 9
         THEN current_setting('app.adm_id')::uuid ELSE NULL END,
    COALESCE(ts.actual_departure, t.completed_at, t.planned_date::timestamptz + INTERVAL '13 hours'),
    NOW()
FROM trip_stops ts
JOIN trips t ON t.id = ts.trip_id
JOIN shipments s ON s.id = ts.shipment_id
JOIN epod e ON e.trip_stop_id = ts.id
WHERE ts.status IN ('delivered','partially_delivered')
  AND e.delivery_status IN ('delivered','partial')
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.trip_stop_id = ts.id);

\echo 'Payments inserted'
SELECT payment_method::text, status::text, COUNT(*),
       SUM(amount)::text total
FROM payments GROUP BY payment_method, status ORDER BY 1,2;

-- 4) Delivery_attempts — record retry attempts for failed/partial orders
INSERT INTO delivery_attempts (
    order_id, attempt_number, shipment_id, previous_stop_id,
    previous_status, previous_reason, status, created_by, created_at, completed_at
)
SELECT
    s.order_id,
    1 AS attempt_number,
    s.id,
    ts.id,
    ts.status::text,
    e.reject_reason,
    -- 60% completed (re-delivered later), 30% failed-twice, 10% pending
    (CASE WHEN ABS(hashtext(ts.id::text||'da')) % 10 < 6 THEN 'completed'
          WHEN ABS(hashtext(ts.id::text||'da')) % 10 < 9 THEN 'failed'
          ELSE 'pending' END),
    current_setting('app.adm_id')::uuid,
    COALESCE(t.completed_at, t.planned_date::timestamptz + INTERVAL '14 hours'),
    CASE WHEN ABS(hashtext(ts.id::text||'da')) % 10 < 6
         THEN t.planned_date::timestamptz + INTERVAL '3 days' ELSE NULL END
FROM trip_stops ts
JOIN trips t ON t.id = ts.trip_id
JOIN shipments s ON s.id = ts.shipment_id
LEFT JOIN epod e ON e.trip_stop_id = ts.id
WHERE ts.status IN ('failed','partially_delivered')
  AND NOT EXISTS (SELECT 1 FROM delivery_attempts da WHERE da.order_id = s.order_id AND da.attempt_number = 1);

\echo 'Delivery attempts'
SELECT status, COUNT(*) FROM delivery_attempts GROUP BY status;

-- 5) Return_collections — vỏ chai/két trả về (BHL beer specific)
-- ~80% of delivered stops have returns, qty 30-100% of delivered crates
INSERT INTO return_collections (
    trip_stop_id, customer_id, asset_type, quantity, condition,
    photo_url, workshop_confirmed_qty, workshop_confirmed_by, workshop_confirmed_at,
    created_by, created_at, updated_at
)
SELECT
    ts.id, ts.customer_id,
    -- Mix asset types per BHL: 60% bottle, 25% crate, 10% keg, 5% pallet
    (CASE
        WHEN ABS(hashtext(ts.id::text||'at')) % 100 < 60 THEN 'bottle'
        WHEN ABS(hashtext(ts.id::text||'at')) % 100 < 85 THEN 'crate'
        WHEN ABS(hashtext(ts.id::text||'at')) % 100 < 95 THEN 'keg'
        ELSE 'pallet'
    END) :: asset_type,
    -- Quantity 5-150 depending on order size
    GREATEST(1, ((ABS(hashtext(ts.id::text||'qty')) % 145) + 5))::int,
    -- 92% good, 6% damaged, 2% lost
    (CASE WHEN ABS(hashtext(ts.id::text||'cd')) % 100 < 92 THEN 'good'
          WHEN ABS(hashtext(ts.id::text||'cd')) % 100 < 98 THEN 'damaged'
          ELSE 'lost' END) :: asset_condition,
    'https://storage.bhl.local/return/' || ts.id::text || '.jpg',
    -- 70% workshop confirmed
    CASE WHEN ABS(hashtext(ts.id::text||'wsc')) % 100 < 70
         THEN GREATEST(1, ((ABS(hashtext(ts.id::text||'qty')) % 145) + 5))::int ELSE NULL END,
    CASE WHEN ABS(hashtext(ts.id::text||'wsc')) % 100 < 70
         THEN (SELECT id FROM users WHERE username='workshop' LIMIT 1) ELSE NULL END,
    CASE WHEN ABS(hashtext(ts.id::text||'wsc')) % 100 < 70
         THEN (SELECT t.completed_at FROM trips t JOIN trip_stops x ON x.trip_id=t.id WHERE x.id=ts.id) + INTERVAL '1 day'
         ELSE NULL END,
    current_setting('app.adm_id')::uuid,
    COALESCE(ts.actual_departure, (SELECT t.completed_at FROM trips t JOIN trip_stops x ON x.trip_id=t.id WHERE x.id=ts.id), now()),
    NOW()
FROM trip_stops ts
WHERE ts.status IN ('delivered','partially_delivered')
  AND ABS(hashtext(ts.id::text||'rt')) % 100 < 80
  AND NOT EXISTS (SELECT 1 FROM return_collections r WHERE r.trip_stop_id = ts.id);

\echo 'Returns inserted'
SELECT asset_type::text, condition::text, COUNT(*), SUM(quantity) total_qty
FROM return_collections GROUP BY asset_type, condition ORDER BY 1,2;

\echo '--- BATCH 1 SUMMARY ---'
SELECT 'epod' tbl, COUNT(*)::text n FROM epod
UNION ALL SELECT 'payments', COUNT(*)::text FROM payments
UNION ALL SELECT 'delivery_attempts', COUNT(*)::text FROM delivery_attempts
UNION ALL SELECT 'return_collections', COUNT(*)::text FROM return_collections
UNION ALL SELECT 'payments_total_amount', (SELECT SUM(amount)::text FROM payments WHERE status='confirmed');

COMMIT;
ANALYZE epod;
ANALYZE payments;
ANALYZE delivery_attempts;
ANALYZE return_collections;
