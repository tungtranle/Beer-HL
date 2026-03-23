-- 010: Create sequence for order numbers to avoid race conditions
-- Sets start value based on max existing order number suffix

DO $$
DECLARE
    max_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN order_number ~ '^SO-\d{8}-\d+$' 
            THEN CAST(SPLIT_PART(order_number, '-', 3) AS INTEGER)
            ELSE 0 
        END
    ), 0) + 1
    INTO max_seq
    FROM sales_orders;

    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH %s', max_seq);
END $$;
