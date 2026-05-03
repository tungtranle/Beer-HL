SELECT COUNT(*) as total_orders FROM sales_orders;
SELECT COUNT(*) as total_shipments FROM shipments;
SELECT COUNT(*) as test_owned FROM qa_owned_entities;
SELECT COUNT(DISTINCT run_id) as distinct_runs FROM qa_owned_entities;
