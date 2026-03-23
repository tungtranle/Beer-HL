-- 010_order_confirmation.down.sql
DROP TABLE IF EXISTS order_confirmations;
-- Note: Cannot remove enum value in PostgreSQL. pending_customer_confirm remains in type.
