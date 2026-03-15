-- Mark ~15% of pending shipments as urgent for demo
-- Randomly pick shipments from both warehouses
UPDATE shipments
SET is_urgent = true, updated_at = now()
WHERE id IN (
    SELECT id FROM shipments
    WHERE status = 'pending' AND delivery_date = '2026-03-16'
    ORDER BY random()
    LIMIT 85
);
