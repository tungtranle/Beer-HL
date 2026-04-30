-- Migration 047 rollback: remove seeded pallets, lots, stock_quants
DO $$
DECLARE
  wh_id UUID := 'a0000000-0000-0000-0000-000000000001';
  demo_lpns TEXT[] := ARRAY[
    'LP-NEAREXP-001','LP-NEAREXP-002','LP-NEAREXP-003','LP-NEAREXP-004','LP-NEAREXP-005',
    'LP-ORPHAN-001','LP-ORPHAN-002','LP-ORPHAN-003'
  ];
  demo_batches TEXT[] := ARRAY[
    'LOT-2025-11-A','LOT-2025-11-B','LOT-2025-10-C','LOT-2025-11-D',
    'LOT-2026-01-G5','LOT-2026-02-D20','LOT-2026-02-IPA','LOT-2026-01-PRM'
  ];
BEGIN
  -- Remove demo pallets
  DELETE FROM pallets WHERE lpn_code = ANY(demo_lpns) AND warehouse_id = wh_id;
  -- Remove demo stock_quants tied to demo lots
  DELETE FROM stock_quants WHERE lot_id IN (
    SELECT id FROM lots WHERE batch_number = ANY(demo_batches)
  );
  -- Remove demo lots
  DELETE FROM lots WHERE batch_number = ANY(demo_batches);
END $$;
