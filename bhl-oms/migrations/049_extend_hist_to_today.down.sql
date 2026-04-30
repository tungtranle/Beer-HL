-- Migration 049 down: xóa dữ liệu extend (mọi rows có order_number/shipment_number/trip_number prefix EXT)
BEGIN;

-- Order matters: child → parent
DELETE FROM payments        WHERE trip_stop_id IN (
  SELECT ts.id FROM trip_stops ts JOIN trips t ON t.id=ts.trip_id WHERE t.trip_number LIKE 'TRP-EXT-%'
);
DELETE FROM epod            WHERE trip_stop_id IN (
  SELECT ts.id FROM trip_stops ts JOIN trips t ON t.id=ts.trip_id WHERE t.trip_number LIKE 'TRP-EXT-%'
);
DELETE FROM eod_sessions    WHERE trip_id IN (SELECT id FROM trips WHERE trip_number LIKE 'TRP-EXT-%');
DELETE FROM reconciliations WHERE trip_id IN (SELECT id FROM trips WHERE trip_number LIKE 'TRP-EXT-%');
DELETE FROM trip_stops      WHERE trip_id IN (SELECT id FROM trips WHERE trip_number LIKE 'TRP-EXT-%');
DELETE FROM trips           WHERE trip_number LIKE 'TRP-EXT-%';
DELETE FROM shipments       WHERE shipment_number LIKE 'SHP-EXT-%';
DELETE FROM order_items     WHERE order_id IN (SELECT id FROM sales_orders WHERE order_number LIKE 'SO-EXT-%');
DELETE FROM sales_orders    WHERE order_number LIKE 'SO-EXT-%';

COMMIT;
