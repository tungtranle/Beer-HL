# SEQUENCE DIAGRAMS — BHL OMS-TMS-WMS

> **Mục đích:** Mô tả luồng tương tác end-to-end giữa các thành phần.
> AI dùng khi implement các flow phức tạp để hiểu đúng thứ tự gọi API, side effects.

---

## SD-01: TẠO ĐƠN HÀNG (Create Order with ATP + Credit Check)

```mermaid
sequenceDiagram
    actor DVKH
    participant FE as Frontend (Next.js)
    participant BE as Backend (Go)
    participant DB as PostgreSQL

    DVKH->>FE: Chọn khách hàng
    FE->>BE: GET /customers/:id/credit
    BE->>DB: SELECT credit_limits + receivable_ledger
    BE-->>FE: { limit, balance, available }

    DVKH->>FE: Chọn sản phẩm + số lượng
    FE->>BE: GET /products/:id/atp?warehouse_id=X
    BE->>DB: ATP calculation
    BE-->>FE: { atp, unit }

    DVKH->>FE: Submit đơn hàng
    FE->>BE: POST /orders { customer_id, items, delivery_date }

    BE->>DB: BEGIN TRANSACTION
    BE->>DB: SELECT credit_limits FOR UPDATE
    BE->>DB: SELECT stock_quants FOR UPDATE

    alt ATP không đủ
        BE-->>FE: 422 ATP_INSUFFICIENT
    end

    alt Credit vượt hạn mức
        BE->>DB: INSERT orders (status='pending_approval')
        BE->>DB: UPDATE stock_quants (reserve ATP)
        BE->>DB: COMMIT
        BE-->>FE: 201 { status: 'pending_approval' }
    else Credit OK
        BE->>DB: INSERT orders (status='confirmed')
        BE->>DB: INSERT shipments (pending)
        BE->>DB: UPDATE stock_quants (reserve ATP)
        BE->>DB: COMMIT
        BE-->>FE: 201 { status: 'confirmed' }
    end
```

---

## SD-02: DUYỆT ĐƠN VƯỢT HẠN MỨC (Accountant Approve)

```mermaid
sequenceDiagram
    actor Accountant
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    Accountant->>FE: Xem đơn pending_approval
    FE->>BE: GET /orders?status=pending_approval
    Accountant->>FE: Bấm "Duyệt đơn"
    FE->>BE: POST /orders/:id/approve

    BE->>DB: BEGIN TRANSACTION
    BE->>DB: SELECT orders WHERE status='pending_approval' FOR UPDATE
    BE->>DB: UPDATE orders SET status='confirmed'
    BE->>DB: INSERT shipments (status='pending')
    BE->>DB: COMMIT
    BE-->>FE: 200 { status: 'confirmed' }
```

---

## SD-03: VRP PLANNING → TRIP CREATION

```mermaid
sequenceDiagram
    actor Dispatcher
    participant FE as Frontend
    participant BE as Backend (Go)
    participant DB as PostgreSQL
    participant VRP as VRP Solver (Python)
    participant OSRM as OSRM Service

    Dispatcher->>FE: Mở Lập kế hoạch, chọn kho + ngày
    FE->>BE: GET /planning/pending-shipments
    FE->>BE: GET /planning/available-vehicles

    Dispatcher->>FE: Bấm "Chạy VRP"
    FE->>BE: POST /planning/run-vrp

    BE->>OSRM: GET /table/v1/driving/{coordinates}
    OSRM-->>BE: { distances, durations }

    BE->>VRP: POST /solve { depot, deliveries, vehicles, distance_matrix }
    VRP-->>BE: { routes, unassigned, solve_time_ms }

    BE->>DB: INSERT vrp_results
    BE-->>FE: VRP result + bản đồ

    Dispatcher->>FE: Phân công tài xế, bấm "Duyệt"
    FE->>BE: POST /planning/approve

    BE->>DB: BEGIN TRANSACTION
    loop Mỗi route
        BE->>DB: INSERT trips + trip_stops
        BE->>DB: UPDATE shipments SET status='assigned'
    end
    BE->>DB: COMMIT
    BE-->>FE: { trips created }
```

---

## SD-04: DRIVER DELIVERY FLOW

```mermaid
sequenceDiagram
    actor Driver
    participant App as Driver App
    participant BE as Backend
    participant DB as PostgreSQL

    Driver->>App: Xem trip detail
    App->>BE: GET /driver/trips/:id

    Driver->>App: Bấm "Bắt đầu chuyến"
    App->>BE: PUT /driver/trips/:id/start
    BE->>DB: UPDATE trips SET status='in_transit'

    loop Mỗi điểm giao
        Driver->>App: Đến điểm, bấm "Đã đến"
        App->>BE: PUT /driver/trips/:id/stops/:stopId/update {status: 'arrived'}

        Driver->>App: Giao hàng xong, bấm "Đã giao"
        App->>BE: PUT /driver/trips/:id/stops/:stopId/update {status: 'delivered'}
        Note over BE: Record payment, trigger Zalo
    end

    Driver->>App: Hoàn thành chuyến
    App->>BE: PUT /driver/trips/:id/complete
    BE->>DB: UPDATE trips SET status='completed'
```

---

## SD-05: GATE CHECK FLOW

```mermaid
sequenceDiagram
    actor Guard
    participant App as Gate Check UI
    participant BE as Backend
    participant DB as PostgreSQL

    Guard->>App: Scan trip barcode / nhập trip ID
    App->>BE: GET /warehouse/gate-checks/:tripId

    Guard->>App: Kiểm đếm hàng, nhập số lượng thực tế
    App->>BE: POST /warehouse/gate-check { trip_id, items }

    alt Khớp 100%
        BE->>DB: INSERT gate_checks (result='pass')
        BE->>DB: UPDATE trips SET status='gate_checked'
        BE-->>App: ✅ Xe được xuất cổng
    else Sai lệch
        BE->>DB: INSERT gate_checks (result='fail')
        BE-->>App: ❌ Sai lệch, không cho xuất
    end
```

---

## SD-06: RECONCILIATION FLOW

```mermaid
sequenceDiagram
    actor Accountant
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    Note over Accountant: Trip status = 'settling'
    Accountant->>FE: Xem đối soát chuyến
    FE->>BE: GET /reconciliation/trips/:id

    BE->>DB: Compare: qty_delivered vs qty_shipped
    BE->>DB: Compare: amount_collected vs amount_expected
    BE->>DB: Compare: assets_returned vs assets_expected

    alt ALL khớp
        BE->>DB: UPDATE trips SET status='reconciled'
        BE-->>FE: ✅ Đối soát khớp
    else Sai lệch
        BE->>DB: INSERT discrepancy_records
        BE-->>FE: ⚠️ Sai lệch, cần xử lý
    end
```

---

*SEQUENCE DIAGRAMS v1.0 — 15/03/2026*
