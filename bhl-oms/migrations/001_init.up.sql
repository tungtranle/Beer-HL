-- BHL OMS-TMS-WMS Demo Migration
-- Subset: 16 tables for demo features (OMS + TMS + ATP)

-- ===== EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- ===== ENUM TYPES =====
DO $$ BEGIN CREATE TYPE order_status AS ENUM (
    'draft', 'confirmed', 'pending_approval', 'approved',
    'processing', 'ready_to_ship', 'shipped', 'partially_delivered',
    'delivered', 'cancelled', 'returned', 'closed', 'on_hold'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE shipment_status AS ENUM (
    'pending', 'picking', 'picked', 'gate_checked', 'loaded',
    'in_transit', 'delivered', 'partially_delivered', 'returned', 'cancelled'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE trip_status AS ENUM (
    'draft', 'planned', 'assigned', 'pre_check', 'ready',
    'in_transit', 'completed', 'cancelled', 'returning',
    'returned', 'post_check', 'reconciled', 'closed'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE stop_status AS ENUM (
    'pending', 'arrived', 'delivering', 'delivered',
    'partially_delivered', 'failed', 'skipped'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE vehicle_type AS ENUM ('truck_3t5', 'truck_5t', 'truck_8t', 'truck_15t');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE ledger_type AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ===== 1. USERS =====
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) NOT NULL,
    email           VARCHAR(200),
    password_hash   VARCHAR(200) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(30) NOT NULL,
    permissions     TEXT[] NOT NULL DEFAULT '{}',
    warehouse_ids   UUID[] NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_users_username UNIQUE (username)
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE is_active = true;

-- ===== 2. PRODUCTS =====
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku             VARCHAR(50) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT 'thÃ¹ng',
    weight_kg       NUMERIC(8,2) NOT NULL DEFAULT 0,
    volume_m3       NUMERIC(8,4) NOT NULL DEFAULT 0,
    price           NUMERIC(15,2) NOT NULL DEFAULT 0,
    deposit_price   NUMERIC(15,2) NOT NULL DEFAULT 0,
    category        VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_products_sku UNIQUE (sku)
);

-- ===== 3. CUSTOMERS =====
CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    address         TEXT NOT NULL,
    phone           VARCHAR(20),
    latitude        NUMERIC(10,7),
    longitude       NUMERIC(10,7),
    province        VARCHAR(50),
    district        VARCHAR(50),
    route_code      VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_customers_code UNIQUE (code)
);

-- ===== 4. CREDIT LIMITS =====
CREATE TABLE IF NOT EXISTS credit_limits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    credit_limit    NUMERIC(15,2) NOT NULL,
    effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to    DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_credit_limits_customer UNIQUE (customer_id, effective_from)
);

-- ===== 5. WAREHOUSES =====
CREATE TABLE IF NOT EXISTS warehouses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(20) NOT NULL,
    path            LTREE,
    latitude        NUMERIC(10,7),
    longitude       NUMERIC(10,7),
    address         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_warehouses_code UNIQUE (code)
);

-- ===== 6. VEHICLES =====
CREATE TABLE IF NOT EXISTS vehicles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number    VARCHAR(20) NOT NULL,
    vehicle_type    vehicle_type NOT NULL,
    capacity_kg     NUMERIC(8,2) NOT NULL,
    capacity_m3     NUMERIC(8,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_vehicles_plate UNIQUE (plate_number)
);

-- ===== 7. DRIVERS =====
CREATE TABLE IF NOT EXISTS drivers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    full_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    license_number  VARCHAR(30),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 8. DELIVERY ROUTES =====
CREATE TABLE IF NOT EXISTS delivery_routes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    customer_ids    UUID[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_delivery_routes_code UNIQUE (code)
);

-- ===== 9. SALES ORDERS =====
CREATE TABLE IF NOT EXISTS sales_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    VARCHAR(30) NOT NULL,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          order_status NOT NULL DEFAULT 'draft',
    delivery_date   DATE NOT NULL,
    delivery_address JSONB,
    time_window     VARCHAR(20),
    total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
    deposit_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_volume_m3 NUMERIC(10,4) NOT NULL DEFAULT 0,
    atp_status      VARCHAR(20) DEFAULT 'pending',
    credit_status   VARCHAR(20) DEFAULT 'pending',
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_sales_orders_number UNIQUE (order_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders (status, delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders (delivery_date, warehouse_id);

-- ===== 10. ORDER ITEMS =====
CREATE TABLE IF NOT EXISTS order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL,
    unit_price      NUMERIC(15,2) NOT NULL,
    amount          NUMERIC(15,2) NOT NULL,
    deposit_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- ===== 11. SHIPMENTS =====
CREATE TABLE IF NOT EXISTS shipments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number VARCHAR(30) NOT NULL,
    order_id        UUID NOT NULL REFERENCES sales_orders(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          shipment_status NOT NULL DEFAULT 'pending',
    delivery_date   DATE NOT NULL,
    total_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_volume_m3 NUMERIC(10,4) NOT NULL DEFAULT 0,
    items           JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_shipments_number UNIQUE (shipment_number)
);

CREATE INDEX IF NOT EXISTS idx_shipments_status_date ON shipments (status, delivery_date);

-- ===== 12. LOTS (for ATP) =====
CREATE TABLE IF NOT EXISTS lots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    batch_number    VARCHAR(50) NOT NULL,
    production_date DATE NOT NULL,
    expiry_date     DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_lots_batch UNIQUE (product_id, batch_number),
    CONSTRAINT chk_lots_dates CHECK (expiry_date > production_date)
);

-- ===== 13. STOCK QUANTS (ATP source) =====
CREATE TABLE IF NOT EXISTS stock_quants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    lot_id          UUID NOT NULL REFERENCES lots(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    location_id     UUID NOT NULL REFERENCES warehouses(id),
    quantity        INTEGER NOT NULL DEFAULT 0,
    reserved_qty    INTEGER NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_stock_quants UNIQUE (product_id, lot_id, location_id),
    CONSTRAINT chk_stock_quants_qty CHECK (quantity >= 0),
    CONSTRAINT chk_stock_quants_reserved CHECK (reserved_qty >= 0 AND reserved_qty <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_stock_quants_product_wh ON stock_quants (product_id, warehouse_id);

-- ===== 14. TRIPS =====
CREATE TABLE IF NOT EXISTS trips (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_number     VARCHAR(30) NOT NULL,
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    vehicle_id      UUID REFERENCES vehicles(id),
    driver_id       UUID REFERENCES drivers(id),
    status          trip_status NOT NULL DEFAULT 'draft',
    planned_date    DATE NOT NULL,
    total_stops     INTEGER NOT NULL DEFAULT 0,
    total_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
    total_duration_min INTEGER NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_trips_number UNIQUE (trip_number)
);

CREATE INDEX IF NOT EXISTS idx_trips_status_date ON trips (status, planned_date);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips (vehicle_id, planned_date);

-- ===== 15. TRIP STOPS =====
CREATE TABLE IF NOT EXISTS trip_stops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    shipment_id     UUID REFERENCES shipments(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    stop_order      INTEGER NOT NULL,
    status          stop_status NOT NULL DEFAULT 'pending',
    estimated_arrival TIMESTAMPTZ,
    estimated_departure TIMESTAMPTZ,
    actual_arrival  TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,
    distance_from_prev_km NUMERIC(8,2) DEFAULT 0,
    cumulative_load_kg NUMERIC(10,2) DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_trip_stops_order UNIQUE (trip_id, stop_order)
);

CREATE INDEX IF NOT EXISTS idx_trip_stops_trip ON trip_stops (trip_id, stop_order);

-- ===== 16. RECEIVABLE LEDGER (Credit Check) =====
CREATE TABLE IF NOT EXISTS receivable_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    order_id        UUID REFERENCES sales_orders(id),
    ledger_type     ledger_type NOT NULL,
    amount          NUMERIC(15,2) NOT NULL,
    description     TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_receivable_ledger_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_receivable_ledger_customer ON receivable_ledger (customer_id, created_at DESC);


