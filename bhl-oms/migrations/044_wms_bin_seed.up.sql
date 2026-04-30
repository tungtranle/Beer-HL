-- 044: Seed bin_locations cho 2 kho hiện hữu (WH-HL, WH-HP)
-- Layout: 2 zones × 6 rows × 4 levels = 48 storage bins per kho
--         + 1 staging-in, 1 staging-out, 1 dock, 1 quarantine
-- Mục tiêu: Phiếu xuất/nhập có gợi ý bin cụ thể "Cất vào A-03-02"
-- velocity_class: A = fast-mover (gần dock), B = slow-mover

-- Migration 037 tạo unique trên bin_code (global) → ngăn 2 kho dùng cùng mã bin.
-- Sửa: bin_code chỉ unique trong phạm vi warehouse_id.
ALTER TABLE bin_locations DROP CONSTRAINT IF EXISTS unq_bin_locations_code;
DROP INDEX IF EXISTS unq_bin_locations_code;

DO $$
DECLARE
    wh RECORD;
    z TEXT;
    r INT;
    lv INT;
    bin_code_v TEXT;
    velocity CHAR(1);
BEGIN
    FOR wh IN SELECT id, code FROM warehouses WHERE code IN ('WH-HL','WH-HP') LOOP
        -- Storage bins zone A & B
        FOREACH z IN ARRAY ARRAY['A','B'] LOOP
            velocity := z; -- A → fast, B → slow
            FOR r IN 1..6 LOOP
                FOR lv IN 1..4 LOOP
                    bin_code_v := format('%s-%s-%s', z, lpad(r::text,2,'0'), lpad(lv::text,2,'0'));
                    INSERT INTO bin_locations
                        (warehouse_id, bin_code, zone, row_code, level_code, bin_type,
                         capacity_pallets, is_pickable, velocity_class, qr_payload)
                    VALUES
                        (wh.id, bin_code_v, z, lpad(r::text,2,'0'), lpad(lv::text,2,'0'),
                         'storage', 1, true, velocity,
                         format('BIN:%s:%s', wh.code, bin_code_v))
                    ON CONFLICT DO NOTHING;
                END LOOP;
            END LOOP;
        END LOOP;

        -- Staging-IN (nhận hàng tạm)
        INSERT INTO bin_locations (warehouse_id, bin_code, zone, bin_type,
            capacity_pallets, is_pickable, qr_payload)
        VALUES (wh.id, 'STG-IN', 'STG', 'staging', 20, false,
            format('BIN:%s:STG-IN', wh.code))
        ON CONFLICT DO NOTHING;

        -- Staging-OUT (chờ xuất)
        INSERT INTO bin_locations (warehouse_id, bin_code, zone, bin_type,
            capacity_pallets, is_pickable, qr_payload)
        VALUES (wh.id, 'STG-OUT', 'STG', 'staging', 20, false,
            format('BIN:%s:STG-OUT', wh.code))
        ON CONFLICT DO NOTHING;

        -- Dock
        INSERT INTO bin_locations (warehouse_id, bin_code, zone, bin_type,
            capacity_pallets, is_pickable, qr_payload)
        VALUES (wh.id, 'DOCK-1', 'DOCK', 'dock', 10, false,
            format('BIN:%s:DOCK-1', wh.code))
        ON CONFLICT DO NOTHING;

        -- Quarantine (hàng lỗi/chờ xử lý)
        INSERT INTO bin_locations (warehouse_id, bin_code, zone, bin_type,
            capacity_pallets, is_pickable, qr_payload)
        VALUES (wh.id, 'QC-1', 'QC', 'quarantine', 10, false,
            format('BIN:%s:QC-1', wh.code))
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Đảm bảo unique trên (warehouse_id, bin_code) — nếu chưa có
CREATE UNIQUE INDEX IF NOT EXISTS unq_bin_locations_wh_code
    ON bin_locations (warehouse_id, bin_code);
