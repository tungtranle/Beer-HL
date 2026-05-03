-- Check delivery dates in test-owned orders
SELECT delivery_date, COUNT(*) as cnt FROM sales_orders 
WHERE id IN (SELECT DISTINCT entity_id FROM qa_owned_entities WHERE entity_type='sales_orders')
GROUP BY delivery_date ORDER BY delivery_date;

-- Check what dates have orders
SELECT MIN(delivery_date), MAX(delivery_date), COUNT(*) FROM sales_orders;

-- Check latest test data created
SELECT id, order_number, delivery_date, created_at FROM sales_orders 
WHERE created_at > NOW() - INTERVAL '1 hour' 
ORDER BY created_at DESC LIMIT 5;
