-- ===================================================================
-- PHASE 2B: Diversify status — make data realistic
-- ===================================================================
-- Distribution targets:
--   Trips: 95% completed, 3% cancelled, 2% vehicle_breakdown
--   Trip_stops (within completed trips): 90% delivered, 5% failed,
--             3% partially_delivered, 2% skipped
--   Sales_orders: align with stops
--             92% delivered, 4% partially_delivered, 2% returned, 2% cancelled
--   Failed/skipped stops -> set re_delivery_count on order
-- Use deterministic hash so reruns produce same results.
-- ===================================================================

BEGIN;
SET LOCAL statement_timeout = 0;

-- 1. Diversify TRIP status (only touch CT- consolidated trips, leave others alone)
WITH t AS (
    SELECT id, ABS(hashtext(id::text || 'trip')) % 100 AS h FROM trips
)
UPDATE trips trp
SET status = CASE
    WHEN t.h < 3 THEN 'cancelled'::trip_status         -- 3%
    WHEN t.h < 5 THEN 'vehicle_breakdown'::trip_status -- 2%
    ELSE 'completed'::trip_status                      -- 95%
END
FROM t WHERE trp.id = t.id;

-- 2. Clear timestamps for non-completed trips
UPDATE trips SET started_at = NULL, completed_at = NULL
WHERE status IN ('cancelled','vehicle_breakdown');

-- 3. Diversify TRIP_STOP status (only stops inside completed trips)
WITH s AS (
    SELECT ts.id, ABS(hashtext(ts.id::text || 'stop')) % 100 AS h
    FROM trip_stops ts JOIN trips t ON t.id=ts.trip_id
    WHERE t.status='completed'
)
UPDATE trip_stops ts
SET status = CASE
    WHEN s.h < 5  THEN 'failed'::stop_status               -- 5%
    WHEN s.h < 8  THEN 'partially_delivered'::stop_status  -- 3%
    WHEN s.h < 10 THEN 'skipped'::stop_status              -- 2%
    ELSE 'delivered'::stop_status                          -- 90%
END
FROM s WHERE ts.id = s.id;

-- Stops in cancelled/breakdown trips -> 'pending' or 'failed'
UPDATE trip_stops ts
SET status = 'failed'::stop_status
FROM trips t WHERE t.id=ts.trip_id AND t.status IN ('cancelled','vehicle_breakdown');

-- 4. Set actual_arrival/departure based on status
UPDATE trip_stops ts
SET actual_arrival = NULL, actual_departure = NULL
FROM trips t WHERE t.id=ts.trip_id AND t.status<>'completed';

UPDATE trip_stops SET actual_arrival = NULL, actual_departure = NULL
WHERE status IN ('failed','skipped','pending');

-- 5. Sync sales_orders status from related stop status
-- Order has 1 shipment, 1 stop typically. Map stop status -> order status.
WITH order_stop AS (
    SELECT s.order_id, ts.status AS stop_status
    FROM shipments s JOIN trip_stops ts ON ts.shipment_id = s.id
)
UPDATE sales_orders o
SET status = CASE os.stop_status
    WHEN 'delivered'           THEN 'delivered'::order_status
    WHEN 'partially_delivered' THEN 'partially_delivered'::order_status
    WHEN 'failed'              THEN 'returned'::order_status
    WHEN 'skipped'             THEN 'cancelled'::order_status
    ELSE 'shipped'::order_status
END
FROM order_stop os WHERE o.id = os.order_id;

-- 6. Mark some failed orders as needing redelivery
UPDATE sales_orders SET re_delivery_count = 1
WHERE status = 'returned' AND ABS(hashtext(id::text)) % 100 < 60; -- 60% of failed get re-attempt

\echo '--- TRIP STATUS DISTRIBUTION ---'
SELECT status::text, COUNT(*), ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER ()::numeric,1) pct
FROM trips GROUP BY status ORDER BY 2 DESC;

\echo '--- STOP STATUS DISTRIBUTION ---'
SELECT status::text, COUNT(*), ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER ()::numeric,1) pct
FROM trip_stops GROUP BY status ORDER BY 2 DESC;

\echo '--- ORDER STATUS DISTRIBUTION ---'
SELECT status::text, COUNT(*), ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER ()::numeric,1) pct
FROM sales_orders GROUP BY status ORDER BY 2 DESC;

\echo '--- SHIPMENT STATUS — sync from stops ---'
SELECT status::text, COUNT(*), ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER ()::numeric,1) pct
FROM shipments GROUP BY status ORDER BY 2 DESC;

COMMIT;
