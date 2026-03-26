-- 018: Handover — add photo_urls + reject support
-- Thủ kho chụp phiếu Bravo đính kèm, các bên xác nhận hoặc từ chối + lý do

ALTER TABLE handover_records
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB;
-- items: [{product_name, product_sku, expected_qty, actual_qty}] — for verification
