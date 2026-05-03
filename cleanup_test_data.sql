-- Delete old test data in correct FK order (child before parent)
DELETE FROM picking_orders WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='picking_orders');
DELETE FROM trip_stops WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='trip_stops');
DELETE FROM trips WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='trips');
DELETE FROM shipments WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='shipments');
DELETE FROM order_confirmations WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='order_confirmations');
DELETE FROM sales_orders WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='sales_orders');
DELETE FROM qa_owned_entities;
SELECT count(*) as remaining_owned FROM qa_owned_entities;
