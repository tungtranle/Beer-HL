-- Insert picking orders for SC-01 test data
INSERT INTO picking_orders (id, pick_number, shipment_id, warehouse_id, status, items, assigned_to, created_at, updated_at) VALUES
(
  gen_random_uuid(),
  'PICK-20260321-0001',
  '710d62df-eb91-4be7-84eb-79d40ca76b6f',
  'a0000000-0000-0000-0000-000000000001',
  'pending',
  '[{"product_id": "c0000000-0000-0000-0000-000000000001", "lot_id": "8ab29fc6-d859-4d10-99d7-5839345a0473", "location_id": "a0000000-0000-0000-0000-000000000011", "qty": 50, "picked_qty": 0}]',
  NULL,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'PICK-20260321-0002',
  'afe3192a-ec20-4ea5-96b4-98787da58379',
  'a0000000-0000-0000-0000-000000000001',
  'pending',
  '[{"product_id": "c0000000-0000-0000-0000-000000000005", "lot_id": "4db6b9fb-1ec4-49af-ab96-7b47d6147576", "location_id": "a0000000-0000-0000-0000-000000000011", "qty": 20, "picked_qty": 0}]',
  NULL,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'PICK-20260321-0003',
  'eec430e3-3fda-4741-9dee-5715ed3d67d3',
  'a0000000-0000-0000-0000-000000000001',
  'pending',
  '[{"product_id": "c0000000-0000-0000-0000-000000000003", "lot_id": "5cf1975a-cb7f-4e41-9e4a-5deacd4b7ae2", "location_id": "a0000000-0000-0000-0000-000000000011", "qty": 30, "picked_qty": 0}]',
  NULL,
  NOW(),
  NOW()
);
