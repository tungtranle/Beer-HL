-- Fix E2E flow: Reset picking orders to match correct process
-- The picking orders were already manually created, keep them but fix shipment/order statuses

-- 1. Update shipment status: loaded → picking (picking happens before loading)
UPDATE shipments SET status = 'picking', updated_at = now()
WHERE id IN (
  '710d62df-eb91-4be7-84eb-79d40ca76b6f',
  'afe3192a-ec20-4ea5-96b4-98787da58379',
  'eec430e3-3fda-4741-9dee-5715ed3d67d3'
);

-- 2. Update order status: confirmed → processing (order is being processed by warehouse)
UPDATE sales_orders SET status = 'processing', updated_at = now()
WHERE id IN (
  '8fe97e9a-b9b5-4911-8dbc-37e441f57a60',
  '4ce344c2-9fbd-45a8-ac89-6988a266b73e',
  '80862e48-b9b9-43a8-9709-45bb47e5b1a9'
);

-- Verify
SELECT 'shipments' as tbl, id, status::text FROM shipments WHERE id IN (
  '710d62df-eb91-4be7-84eb-79d40ca76b6f',
  'afe3192a-ec20-4ea5-96b4-98787da58379',
  'eec430e3-3fda-4741-9dee-5715ed3d67d3'
)
UNION ALL
SELECT 'orders', id, status::text FROM sales_orders WHERE id IN (
  '8fe97e9a-b9b5-4911-8dbc-37e441f57a60',
  '4ce344c2-9fbd-45a8-ac89-6988a266b73e',
  '80862e48-b9b9-43a8-9709-45bb47e5b1a9'
);
