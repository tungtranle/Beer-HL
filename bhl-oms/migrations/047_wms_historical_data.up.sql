-- Migration 047: WMS realistic historical data
-- Mục tiêu: seed pallet + lô hàng có dữ liệu lịch sử để tất cả 4 cảnh báo dashboard hoạt động
--
-- Logic nghiệp vụ (ngày thực tế: 29/04/2026):
--   • Bia Hạ Long sản xuất lô Nov 2025, HSD 6 tháng → expire May 2026 → còn <30 ngày = NEAR-EXPIRY
--   • Kho nhận hàng theo pallet, một số pallet chưa được putaway từ 8-12 ngày trước = ORPHAN
--   • Một số bin nhỏ (capacity=1) đã được đặt hàng = BIN OVERFLOW
--   • Một số SKU đặc biệt (keg, craft, premium) tồn <100 = LOW SAFETY STOCK
--
-- AQF: Dữ liệu demo. Tất cả INSERT bọc trong kiểm tra idempotent.
-- historical_rows_touched = 0 (không chỉnh sửa dữ liệu transactional có sẵn)

DO $$
DECLARE
  wh_id     UUID := 'a0000000-0000-0000-0000-000000000001';
  loc_id    UUID := 'a0000000-0000-0000-0000-000000000002'; -- virtual stock location
  wh_user   UUID := '0e39b13a-4c5e-4ee8-d642-ac19f395cb16'; -- wh.handler.hl

  -- Product IDs (fixed seeds)
  p_lon330  UUID := 'c0000000-0000-0000-0000-000000000001'; -- BHL-LON-330
  p_chai450 UUID := 'c0000000-0000-0000-0000-000000000003'; -- BHL-CHAI-450
  p_lager   UUID := 'c0000000-0000-0000-0000-000000000013'; -- BHL-LAGER-500
  p_gold330 UUID := 'c0000000-0000-0000-0000-000000000005'; -- BHL-GOLD-330
  p_gold500 UUID := 'c0000000-0000-0000-0000-000000000006'; -- BHL-GOLD-500
  p_draft30 UUID := 'c0000000-0000-0000-0000-000000000007'; -- BHL-DRAFT-30
  p_draft20 UUID := 'c0000000-0000-0000-0000-000000000019'; -- BHL-DRAFT-20
  p_ipa     UUID := 'c0000000-0000-0000-0000-000000000021'; -- BHL-IPA-330
  p_premium UUID := 'c0000000-0000-0000-0000-000000000018'; -- BHL-PREMIUM-355

  -- New lot IDs
  lot_ne1   UUID; -- BHL-LON-330  expiry 2026-05-05  (6d)   CRITICAL
  lot_ne2   UUID; -- BHL-CHAI-450 expiry 2026-05-15  (16d)
  lot_ne3   UUID; -- BHL-LAGER-500 expiry 2026-05-10 (11d)
  lot_ne4   UUID; -- BHL-GOLD-330  expiry 2026-05-25 (26d)
  lot_gold500 UUID; -- BHL-GOLD-500 expiry 2026-07-15 (normal)
  lot_draft20 UUID; -- BHL-DRAFT-20 expiry 2026-08-01
  lot_ipa     UUID; -- BHL-IPA-330  expiry 2026-08-10
  lot_premium UUID; -- BHL-PREMIUM-355 expiry 2026-07-25
  lot_draft30 UUID; -- existing BHL-DRAFT-30 lot (from LOT-2026-INIT)

  -- Storage bin IDs (capacity=1 each → 1 pallet = 100% full ≥ 90%)
  bin_a0101 UUID := 'd03999fd-3309-4564-93e7-31d4ddbc8b2a'; -- A-01-01
  bin_a0102 UUID := 'd140ac60-730f-455d-8a36-bad5be7e2f77'; -- A-01-02
  bin_a0201 UUID := 'bd76b9ed-afb4-47b6-bd20-e3730994df6b'; -- A-02-01
  bin_a0301 UUID := 'e69efeea-84a9-487e-b5f7-ce93ef682c55'; -- A-03-01
  bin_b0101 UUID;                                             -- B-01-01 (fetched below)

  -- Staging/dock bin IDs (capacity=20/10)
  bin_stgin UUID := '789ce860-e079-4a60-aeea-cdfe82759ff6'; -- STG-IN
  bin_dock1 UUID := '8b9bf6c1-4d3f-4a85-bd5b-45af972460be'; -- DOCK-1

BEGIN
  -- Idempotent guard: skip if pallets already exist for this warehouse
  IF EXISTS (SELECT 1 FROM pallets WHERE warehouse_id = wh_id LIMIT 1) THEN
    RAISE NOTICE 'Migration 047: pallets already exist, skipping.';
    RETURN;
  END IF;

  -- Get B-01-01 bin ID dynamically
  SELECT id INTO bin_b0101
  FROM bin_locations
  WHERE warehouse_id = wh_id AND bin_code = 'B-01-01'
  LIMIT 1;

  -- Get existing DRAFT-30 lot (for orphan pallet — stock received but never putaway)
  SELECT id INTO lot_draft30
  FROM lots
  WHERE product_id = p_draft30 AND batch_number = 'LOT-2026-INIT'
  LIMIT 1;

  -- ───────────────────────────────────────────────────────────────────────────
  -- 1. Tạo lô hàng cận date (sản xuất Nov 2025, HSD 6 tháng = expire May 2026)
  -- ───────────────────────────────────────────────────────────────────────────
  -- LOT-2025-11-A: BHL-LON-330, expire 2026-05-05 → CHỈ CÒN 6 NGÀY (nghiêm trọng)
  INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
  VALUES (p_lon330, 'LOT-2025-11-A', '2025-11-05', '2026-05-05')
  RETURNING id INTO lot_ne1;

  -- LOT-2025-11-B: BHL-CHAI-450, expire 2026-05-15 → 16 ngày
  INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
  VALUES (p_chai450, 'LOT-2025-11-B', '2025-11-15', '2026-05-15')
  RETURNING id INTO lot_ne2;

  -- LOT-2025-10-C: BHL-LAGER-500, expire 2026-05-10 → 11 ngày
  INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
  VALUES (p_lager, 'LOT-2025-10-C', '2025-10-20', '2026-05-10')
  RETURNING id INTO lot_ne3;

  -- LOT-2025-11-D: BHL-GOLD-330, expire 2026-05-25 → 26 ngày
  INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
  VALUES (p_gold330, 'LOT-2025-11-D', '2025-11-20', '2026-05-25')
  RETURNING id INTO lot_ne4;

  -- ───────────────────────────────────────────────────────────────────────────
  -- 2. Tạo lô cho sản phẩm tồn thấp + pallet mồ côi
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
  VALUES (p_gold500, 'LOT-2026-01-G5', '2026-01-15', '2026-07-15')
  RETURNING id INTO lot_gold500;

  INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
  VALUES (p_draft20, 'LOT-2026-02-D20', '2026-02-01', '2026-08-01')
  RETURNING id INTO lot_draft20;

  INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
  VALUES (p_ipa, 'LOT-2026-02-IPA', '2026-02-10', '2026-08-10')
  RETURNING id INTO lot_ipa;

  INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
  VALUES (p_premium, 'LOT-2026-01-PRM', '2026-01-25', '2026-07-25')
  RETURNING id INTO lot_premium;

  -- ───────────────────────────────────────────────────────────────────────────
  -- 3. Stock quants cho lô cận date (KPI near_expiry_count cần stock_quants.lot_id)
  -- Số lượng = pallet_count × qty_per_pallet
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO stock_quants (product_id, lot_id, warehouse_id, location_id, quantity, reserved_qty)
  VALUES
    (p_lon330,  lot_ne1, wh_id, loc_id, 360, 0), -- 3 pallets × 120
    (p_chai450, lot_ne2, wh_id, loc_id, 192, 0), -- 2 pallets × 96
    (p_lager,   lot_ne3, wh_id, loc_id, 160, 0), -- 2 pallets × 80
    (p_gold330, lot_ne4, wh_id, loc_id, 120, 0); -- 2 pallets × 60

  -- ───────────────────────────────────────────────────────────────────────────
  -- 4. Stock quants tồn thấp (< 100 đơn vị) → cảnh báo low_safety_stock
  -- Đây là sản phẩm đặc biệt (keg, craft, premium) nhập ít, gần hết
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO stock_quants (product_id, lot_id, warehouse_id, location_id, quantity, reserved_qty)
  VALUES
    (p_draft20,  lot_draft20, wh_id, loc_id, 45, 0),  -- Keg 20L: chỉ còn 45 thùng
    (p_ipa,      lot_ipa,     wh_id, loc_id, 68, 0),  -- IPA 330ml: craft beer còn 68 lon
    (p_premium,  lot_premium, wh_id, loc_id, 88, 0),  -- Premium 355: còn 88 lon
    (p_gold500,  lot_gold500, wh_id, loc_id, 77, 0);  -- Gold 500ml: còn 77 chai

  -- ───────────────────────────────────────────────────────────────────────────
  -- 5. Pallets trong bin storage → kích hoạt bins_over_90
  -- Storage bins có capacity=1, 1 pallet = 100% ≥ 90%
  -- Đồng thời là pallet của lô cận date → kích hoạt near_expiry_high_qty
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO pallets
    (lpn_code, warehouse_id, current_bin_id, lot_id, product_id,
     qty, initial_qty, status, qr_payload, received_at, created_by, created_at)
  VALUES
    ('LP-NEAREXP-001', wh_id, bin_a0101, lot_ne1, p_lon330,
     120, 120, 'in_stock', '{"lpn":"LP-NEAREXP-001"}', '2026-04-01 08:00:00+07', wh_user, '2026-04-01 08:00:00+07'),
    ('LP-NEAREXP-002', wh_id, bin_a0102, lot_ne1, p_lon330,
     120, 120, 'in_stock', '{"lpn":"LP-NEAREXP-002"}', '2026-04-01 08:30:00+07', wh_user, '2026-04-01 08:30:00+07'),
    ('LP-NEAREXP-003', wh_id, bin_a0201, lot_ne2, p_chai450,
      96,  96, 'in_stock', '{"lpn":"LP-NEAREXP-003"}', '2026-04-05 09:00:00+07', wh_user, '2026-04-05 09:00:00+07'),
    ('LP-NEAREXP-004', wh_id, bin_a0301, lot_ne3, p_lager,
      80,  80, 'in_stock', '{"lpn":"LP-NEAREXP-004"}', '2026-03-28 10:00:00+07', wh_user, '2026-03-28 10:00:00+07');

  IF bin_b0101 IS NOT NULL THEN
    INSERT INTO pallets
      (lpn_code, warehouse_id, current_bin_id, lot_id, product_id,
       qty, initial_qty, status, qr_payload, received_at, created_by, created_at)
    VALUES
      ('LP-NEAREXP-005', wh_id, bin_b0101, lot_ne4, p_gold330,
        60, 60, 'in_stock', '{"lpn":"LP-NEAREXP-005"}', '2026-04-10 08:00:00+07', wh_user, '2026-04-10 08:00:00+07');
  END IF;

  -- ───────────────────────────────────────────────────────────────────────────
  -- 6. Pallet mồ côi trong staging/dock (nhận >7 ngày trước chưa putaway)
  -- ───────────────────────────────────────────────────────────────────────────
  INSERT INTO pallets
    (lpn_code, warehouse_id, current_bin_id, lot_id, product_id,
     qty, initial_qty, status, qr_payload, received_at, created_by, created_at)
  VALUES
    ('LP-ORPHAN-001', wh_id, bin_stgin, lot_draft30, p_draft30,
      48, 48, 'in_stock', '{"lpn":"LP-ORPHAN-001"}', NOW() - INTERVAL '12 days', wh_user, NOW() - INTERVAL '12 days'),
    ('LP-ORPHAN-002', wh_id, bin_stgin, lot_gold500, p_gold500,
      80, 80, 'in_stock', '{"lpn":"LP-ORPHAN-002"}', NOW() - INTERVAL '9 days', wh_user, NOW() - INTERVAL '9 days'),
    ('LP-ORPHAN-003', wh_id, bin_dock1, lot_draft20, p_draft20,
      36, 36, 'in_stock', '{"lpn":"LP-ORPHAN-003"}', NOW() - INTERVAL '8 days', wh_user, NOW() - INTERVAL '8 days');

  RAISE NOTICE 'Migration 047: seeded % lots, % pallets, % stock_quants',
    8,  -- lots created
    (SELECT COUNT(*) FROM pallets WHERE warehouse_id = wh_id),
    (SELECT COUNT(*) FROM stock_quants WHERE warehouse_id = wh_id);
END $$;
