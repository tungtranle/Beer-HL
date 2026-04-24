-- ===================================================================
-- PHASE 3 — BATCH 2: EOD sessions/checkpoints + reconciliations + ledgers
-- ===================================================================

BEGIN;
SET LOCAL statement_timeout = 0;

DO $$
DECLARE adm uuid; whh uuid; acc uuid;
BEGIN
    SELECT id INTO adm FROM users WHERE username='admin' LIMIT 1;
    SELECT id INTO whh FROM users WHERE username='wh.handler.hl' LIMIT 1;
    SELECT id INTO acc FROM users WHERE username='accountant' LIMIT 1;
    PERFORM set_config('app.adm_id', adm::text, false);
    PERFORM set_config('app.whh_id', whh::text, false);
    PERFORM set_config('app.acc_id', acc::text, false);
END $$;

-- 1) EOD sessions — 1 per completed trip
INSERT INTO eod_sessions (
    trip_id, driver_id, status,
    total_stops_delivered, total_stops_failed,
    total_cash_collected, total_transfer_collected, total_credit_amount,
    started_at, completed_at, created_at, updated_at
)
SELECT
    t.id, t.driver_id,
    'completed',
    COALESCE((SELECT COUNT(*) FROM trip_stops WHERE trip_id=t.id AND status IN ('delivered','partially_delivered'))::int, 0),
    COALESCE((SELECT COUNT(*) FROM trip_stops WHERE trip_id=t.id AND status IN ('failed','skipped'))::int, 0),
    COALESCE((SELECT SUM(amount) FROM payments p JOIN trip_stops ts ON ts.id=p.trip_stop_id WHERE ts.trip_id=t.id AND p.payment_method='cash')::numeric, 0),
    COALESCE((SELECT SUM(amount) FROM payments p JOIN trip_stops ts ON ts.id=p.trip_stop_id WHERE ts.trip_id=t.id AND p.payment_method='transfer')::numeric, 0),
    COALESCE((SELECT SUM(amount) FROM payments p JOIN trip_stops ts ON ts.id=p.trip_stop_id WHERE ts.trip_id=t.id AND p.payment_method='credit')::numeric, 0),
    COALESCE(t.completed_at, t.planned_date::timestamptz + INTERVAL '16 hours'),
    COALESCE(t.completed_at, t.planned_date::timestamptz + INTERVAL '17 hours') + INTERVAL '30 minutes',
    COALESCE(t.completed_at, t.planned_date::timestamptz + INTERVAL '17 hours'),
    NOW()
FROM trips t
WHERE t.status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM eod_sessions es WHERE es.trip_id = t.id);

\echo 'EOD sessions inserted'
SELECT COUNT(*) FROM eod_sessions;

-- 2) EOD checkpoints — 4 standard checkpoints per session
INSERT INTO eod_checkpoints (
    session_id, trip_id, checkpoint_type, checkpoint_order, status,
    driver_data, submitted_at, receiver_id, receiver_name, receiver_data,
    signature_url, confirmed_at, created_at, updated_at
)
SELECT
    es.id, es.trip_id, cp.cp_type, cp.cp_order, 'confirmed',
    jsonb_build_object('count', cp.cp_order, 'note','OK'),
    es.completed_at - INTERVAL '20 minutes',
    CASE cp.cp_type
        WHEN 'cash_handover'  THEN current_setting('app.acc_id')::uuid
        WHEN 'asset_return'   THEN (SELECT id FROM users WHERE username='workshop' LIMIT 1)
        WHEN 'document_handover' THEN current_setting('app.whh_id')::uuid
        ELSE current_setting('app.whh_id')::uuid
    END,
    CASE cp.cp_type
        WHEN 'cash_handover'  THEN 'Kế toán'
        WHEN 'asset_return'   THEN 'Workshop'
        WHEN 'document_handover' THEN 'Thủ kho'
        ELSE 'Thủ kho'
    END,
    jsonb_build_object('verified', true),
    'https://storage.bhl.local/cp/' || es.id::text || '_' || cp.cp_type || '.png',
    es.completed_at - INTERVAL '5 minutes',
    es.completed_at - INTERVAL '15 minutes',
    NOW()
FROM eod_sessions es
CROSS JOIN (VALUES
    ('vehicle_return',1),
    ('asset_return',2),
    ('cash_handover',3),
    ('document_handover',4)
) AS cp(cp_type, cp_order)
WHERE NOT EXISTS (SELECT 1 FROM eod_checkpoints ec WHERE ec.session_id=es.id AND ec.checkpoint_type=cp.cp_type);

\echo 'EOD checkpoints'
SELECT checkpoint_type, COUNT(*) FROM eod_checkpoints GROUP BY checkpoint_type;

-- 3) Reconciliations — 3 per completed trip (goods/payment/asset)
INSERT INTO reconciliations (
    trip_id, recon_type, status, expected_value, actual_value, variance,
    details, reconciled_by, reconciled_at, created_at, updated_at
)
SELECT
    t.id, rt.rt_type::recon_type,
    -- 92% matched, 6% discrepancy, 2% pending
    (CASE WHEN ABS(hashtext(t.id::text || rt.rt_type)) % 100 < 92 THEN 'matched'
          WHEN ABS(hashtext(t.id::text || rt.rt_type)) % 100 < 98 THEN 'discrepancy'
          ELSE 'pending' END) :: recon_status,
    rt.expected,
    -- actual = expected ± small variance
    rt.expected * (1 - (ABS(hashtext(t.id::text || rt.rt_type || 'a')) % 30) / 1000.0),
    rt.expected * ((ABS(hashtext(t.id::text || rt.rt_type || 'a')) % 30) / 1000.0),
    jsonb_build_object('type', rt.rt_type),
    CASE WHEN ABS(hashtext(t.id::text || rt.rt_type)) % 100 < 92
         THEN current_setting('app.acc_id')::uuid ELSE NULL END,
    CASE WHEN ABS(hashtext(t.id::text || rt.rt_type)) % 100 < 92
         THEN COALESCE(t.completed_at, t.planned_date::timestamptz + INTERVAL '18 hours') + INTERVAL '4 hours'
         ELSE NULL END,
    COALESCE(t.completed_at, t.planned_date::timestamptz + INTERVAL '17 hours'),
    NOW()
FROM trips t
CROSS JOIN LATERAL (
    SELECT 'payment' AS rt_type, COALESCE((SELECT SUM(amount) FROM payments p JOIN trip_stops ts ON ts.id=p.trip_stop_id WHERE ts.trip_id=t.id),0) AS expected
    UNION ALL
    SELECT 'goods', COALESCE((SELECT SUM(s.total_weight_kg) FROM trip_stops ts JOIN shipments s ON s.id=ts.shipment_id WHERE ts.trip_id=t.id),0)
    UNION ALL
    SELECT 'asset', COALESCE((SELECT SUM(quantity) FROM return_collections r JOIN trip_stops ts ON ts.id=r.trip_stop_id WHERE ts.trip_id=t.id),0)
) rt
WHERE t.status='completed'
  AND NOT EXISTS (SELECT 1 FROM reconciliations rc WHERE rc.trip_id=t.id AND rc.recon_type=rt.rt_type::recon_type);

\echo 'Reconciliations'
SELECT recon_type::text, status::text, COUNT(*) FROM reconciliations GROUP BY 1,2 ORDER BY 1,2;

-- 4) Receivable_ledger — for credit payments (debit), and for collected payments (credit)
-- For each delivered order with credit payment: create debit entry; for cash/transfer: credit entry
INSERT INTO receivable_ledger (customer_id, order_id, ledger_type, amount, description, created_by, created_at)
SELECT
    p.customer_id, p.order_id,
    CASE WHEN p.payment_method='credit' THEN 'debit'::ledger_type
         ELSE 'credit'::ledger_type END,
    p.amount,
    CASE WHEN p.payment_method='credit' THEN 'Công nợ ' || COALESCE(o.order_number,'')
         ELSE 'Thu ' || p.payment_method::text || ' ' || COALESCE(o.order_number,'') END,
    current_setting('app.acc_id')::uuid,
    p.collected_at
FROM payments p
LEFT JOIN sales_orders o ON o.id = p.order_id
WHERE p.amount > 0
  AND NOT EXISTS (
      SELECT 1 FROM receivable_ledger rl
      WHERE rl.customer_id=p.customer_id AND rl.order_id=p.order_id AND rl.amount=p.amount
  );

\echo 'Receivable ledger'
SELECT ledger_type::text, COUNT(*), SUM(amount)::text FROM receivable_ledger GROUP BY 1;

-- 5) Asset_ledger — out direction for shipped goods, in direction for returned vỏ chai
-- OUT: based on shipped items (using delivered stops)
INSERT INTO asset_ledger (customer_id, asset_type, direction, quantity, condition, reference_type, reference_id, notes, created_by, created_at)
SELECT
    ts.customer_id,
    'crate'::asset_type, -- main beer asset
    'out'::asset_direction,
    GREATEST(1, ((s.total_weight_kg / 18)::int))::int, -- ~18kg/crate
    'good'::asset_condition,
    'shipment',
    s.id,
    'Xuất kho theo đơn ' || COALESCE(o.order_number,''),
    current_setting('app.adm_id')::uuid,
    COALESCE(ts.actual_departure, t.completed_at, t.planned_date::timestamptz + INTERVAL '12 hours')
FROM trip_stops ts
JOIN trips t ON t.id = ts.trip_id
JOIN shipments s ON s.id = ts.shipment_id
JOIN sales_orders o ON o.id = s.order_id
WHERE ts.status IN ('delivered','partially_delivered')
  AND s.total_weight_kg > 0
  AND NOT EXISTS (
      SELECT 1 FROM asset_ledger al
      WHERE al.reference_type='shipment' AND al.reference_id=s.id AND al.direction='out'
  );

-- IN: based on return_collections
INSERT INTO asset_ledger (customer_id, asset_type, direction, quantity, condition, reference_type, reference_id, notes, created_by, created_at)
SELECT
    rc.customer_id, rc.asset_type, 'in'::asset_direction,
    rc.quantity, rc.condition,
    'return_collection',
    rc.id,
    'Nhập trả vỏ',
    current_setting('app.adm_id')::uuid,
    rc.created_at
FROM return_collections rc
WHERE NOT EXISTS (
    SELECT 1 FROM asset_ledger al
    WHERE al.reference_type='return_collection' AND al.reference_id=rc.id
);

\echo 'Asset ledger'
SELECT direction::text, asset_type::text, COUNT(*), SUM(quantity)::text
FROM asset_ledger GROUP BY 1,2 ORDER BY 1,2;

\echo '--- BATCH 2 SUMMARY ---'
SELECT 'eod_sessions' tbl, COUNT(*)::text FROM eod_sessions
UNION ALL SELECT 'eod_checkpoints', COUNT(*)::text FROM eod_checkpoints
UNION ALL SELECT 'reconciliations', COUNT(*)::text FROM reconciliations
UNION ALL SELECT 'receivable_ledger', COUNT(*)::text FROM receivable_ledger
UNION ALL SELECT 'asset_ledger', COUNT(*)::text FROM asset_ledger;

COMMIT;
ANALYZE eod_sessions;
ANALYZE eod_checkpoints;
ANALYZE reconciliations;
ANALYZE receivable_ledger;
ANALYZE asset_ledger;
