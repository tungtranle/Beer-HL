-- Migration 046: WMS Ops seed — bin locations, wms_exceptions table, demo data
-- Phase D: World-class WMS Manager Dashboard

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Seed bin_locations for Kho Hạ Long (zone A/B/C + STAGING)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  wh_id  UUID := 'a0000000-0000-0000-0000-000000000001';
  zone   TEXT;
  r      INT;
  l      INT;
  vclass CHAR(1);
  bc     TEXT;
BEGIN
  FOREACH zone IN ARRAY ARRAY['A','B','C'] LOOP
    FOR r IN 1..6 LOOP
      FOR l IN 1..4 LOOP
        bc := zone || '-' || LPAD(r::TEXT, 2, '0') || '-' || LPAD(l::TEXT, 2, '0');
        vclass := CASE zone WHEN 'A' THEN 'A' WHEN 'B' THEN 'B' ELSE 'C' END;
        INSERT INTO bin_locations (
          warehouse_id, bin_code, zone, row_code, level_code,
          bin_type, capacity_pallets, is_pickable, velocity_class, qr_payload
        ) VALUES (
          wh_id, bc, zone, LPAD(r::TEXT,2,'0'), LPAD(l::TEXT,2,'0'),
          'storage', 4, TRUE, vclass,
          '{"type":"bin","code":"' || bc || '"}'
        ) ON CONFLICT (bin_code) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Staging bins (inbound / outbound)
  FOR r IN 1..4 LOOP
    bc := 'STAGE-IN-' || LPAD(r::TEXT,2,'0');
    INSERT INTO bin_locations (warehouse_id, bin_code, zone, row_code, level_code,
      bin_type, capacity_pallets, is_pickable, qr_payload)
    VALUES (wh_id, bc, 'STAGE', 'IN', LPAD(r::TEXT,2,'0'),
      'staging', 8, FALSE, '{"type":"bin","code":"' || bc || '"}')
    ON CONFLICT (bin_code) DO NOTHING;

    bc := 'STAGE-OUT-' || LPAD(r::TEXT,2,'0');
    INSERT INTO bin_locations (warehouse_id, bin_code, zone, row_code, level_code,
      bin_type, capacity_pallets, is_pickable, qr_payload)
    VALUES (wh_id, bc, 'STAGE', 'OUT', LPAD(r::TEXT,2,'0'),
      'staging', 8, FALSE, '{"type":"bin","code":"' || bc || '"}')
    ON CONFLICT (bin_code) DO NOTHING;
  END LOOP;

  -- QC / Quarantine bins
  INSERT INTO bin_locations (warehouse_id, bin_code, zone, bin_type, capacity_pallets, is_pickable, qr_payload)
  VALUES
    (wh_id, 'QC-01', 'QC', 'staging', 6, FALSE, '{"type":"bin","code":"QC-01"}'),
    (wh_id, 'QC-02', 'QC', 'staging', 6, FALSE, '{"type":"bin","code":"QC-02"}'),
    (wh_id, 'QUARANTINE', 'QC', 'staging', 4, FALSE, '{"type":"bin","code":"QUARANTINE"}')
  ON CONFLICT (bin_code) DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create wms_exceptions table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_exceptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  type             TEXT NOT NULL CHECK (type IN (
    'missing_stock','wrong_lot','damaged','over_pick',
    'bin_overflow','orphan_pallet','other'
  )),
  severity         TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical','warning','info')),
  title            TEXT NOT NULL,
  description      TEXT,
  reference_id     UUID,
  reference_type   TEXT,
  assigned_to      UUID REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','dismissed')),
  resolved_by      UUID REFERENCES users(id),
  resolved_at      TIMESTAMP WITH TIME ZONE,
  resolution_note  TEXT,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_exceptions_wh_status
  ON wms_exceptions (warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_wms_exceptions_type
  ON wms_exceptions (type, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Seed demo exceptions (idempotent — skip if title already exists)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE wh UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM wms_exceptions WHERE warehouse_id = wh LIMIT 1) THEN
    INSERT INTO wms_exceptions (warehouse_id, type, severity, title, description, reference_type, status, created_at) VALUES
      (wh,'missing_stock','critical',
       'Thiếu hàng lệnh PICK-0012',
       'Lệnh đóng hàng PICK-0012 thiếu 48 thùng BHL-LON-330 tại bin A-03-02. Tồn khả dụng chỉ còn 12 thùng.',
       'picking_order','open', NOW() - INTERVAL '3 hours'),
      (wh,'wrong_lot','warning',
       'Lô không đúng lệnh PICK-0014',
       'Pallet LP-20240429-003 chứa lô EXP:2024-12 nhưng lệnh yêu cầu EXP:2024-11 (FEFO). Cần hoán đổi lô.',
       'pallet','open', NOW() - INTERVAL '90 minutes'),
      (wh,'bin_overflow','warning',
       'Bin B-02-01 vượt ngưỡng 90%',
       'Bin B-02-01 đang chứa 4/4 pallet (100%), không thể putaway thêm. Đề xuất mở bin B-03-01.',
       'bin','in_progress', NOW() - INTERVAL '4 hours'),
      (wh,'orphan_pallet','info',
       'Pallet LP-20240421-009 chưa được cất 8 ngày',
       'Pallet này đứng tại khu STAGE-IN-02 từ 2026-04-21, chưa được putaway. SKU: BHL-CHAI-450.',
       'pallet','open', NOW() - INTERVAL '8 days'),
      (wh,'damaged','critical',
       'Phát hiện hàng hỏng khi load xe 51C-12345',
       '2 thùng BHL-CHAI-450 bị rò rỉ phát hiện khi load lên xe 51C-12345 chuyến VH-20240429-001. Cần tách lô.',
       'pallet','open', NOW() - INTERVAL '30 minutes');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Seed demo picking_orders (up to 5, using real shipment IDs)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  wh_id UUID := 'a0000000-0000-0000-0000-000000000001';
  wh_uid UUID := '0e39b13a-4c5e-4ee8-d642-ac19f395cb16'; -- wh.handler.hl
  sh   RECORD;
  cnt  INT := 1;
  st   TEXT;
BEGIN
  FOR sh IN SELECT id FROM shipments ORDER BY created_at DESC LIMIT 6 LOOP
    IF NOT EXISTS (SELECT 1 FROM picking_orders WHERE shipment_id = sh.id) THEN
      st := CASE cnt
        WHEN 1 THEN 'in_progress'
        WHEN 2 THEN 'pending'
        WHEN 3 THEN 'pending'
        WHEN 4 THEN 'completed'
        WHEN 5 THEN 'completed'
        ELSE 'pending'
      END;
      INSERT INTO picking_orders (
        pick_number, shipment_id, warehouse_id, status, items,
        assigned_to, started_at, completed_at, created_at
      ) VALUES (
        'PICK-' || LPAD(cnt::TEXT, 4, '0'),
        sh.id, wh_id, st::picking_status,
        ('[{"product_name":"Bia Ha Long Lon 330ml","qty":48,"picked_qty":' || (CASE st WHEN 'completed' THEN '48' WHEN 'in_progress' THEN '24' ELSE '0' END) || '}]')::jsonb,
        CASE WHEN st IN ('in_progress','completed') THEN wh_uid ELSE NULL END,
        CASE WHEN st IN ('in_progress','completed') THEN NOW() - INTERVAL '2 hours' * cnt ELSE NULL END,
        CASE WHEN st = 'completed' THEN NOW() - INTERVAL '1 hour' * cnt ELSE NULL END,
        NOW() - INTERVAL '3 hours' * cnt
      );
      cnt := cnt + 1;
    END IF;
  END LOOP;
END $$;
