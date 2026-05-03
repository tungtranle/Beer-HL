-- Find all test data
SELECT scenario_run_id, entity_type, COUNT(*) as cnt FROM qa_owned_entities GROUP BY scenario_run_id, entity_type;

-- Check picking_orders by scenario_run_id
SELECT id, scenario_run_id FROM picking_orders LIMIT 5;

-- Check if scenario_run_id exists
SELECT id FROM qa_scenario_runs LIMIT 5;
