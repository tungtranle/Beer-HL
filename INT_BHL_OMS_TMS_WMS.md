# INTEGRATION SPECIFICATION — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Dựa trên | BRD v2.0 §8, SAD v2.1 §5, API v1.0 §12 |

---

# MỤC LỤC

1. [Tổng quan Integration Architecture](#1-tổng-quan-integration-architecture)
2. [Bravo ERP Integration](#2-bravo-erp-integration)
3. [DMS Integration](#3-dms-integration)
4. [Zalo OA Integration](#4-zalo-oa-integration)
5. [OSRM Self-hosted](#5-osrm-self-hosted)
6. [Firebase Cloud Messaging](#6-firebase-cloud-messaging)
7. [MinIO / S3 File Storage](#7-minio--s3-file-storage)
8. [Error Handling & Retry](#8-error-handling--retry)
9. [Dead Letter Queue (DLQ)](#9-dead-letter-queue-dlq)
10. [Monitoring & Alerting](#10-monitoring--alerting)
11. [Security](#11-security)
12. [Sequence Diagrams](#12-sequence-diagrams)

---

# 1. TỔNG QUAN INTEGRATION ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                   BHL OMS-TMS-WMS                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Bravo    │  │ DMS      │  │ Zalo OA  │  Adapters    │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ┌────┴──────────────┴──────────────┴─────┐              │
│  │          Asynq Task Queue (Redis)      │              │
│  │  Retry 3x │ Exp. Backoff │ DLQ        │              │
│  └────────────────────────────────────────┘              │
└──────┬─────────────┬────────────────┬───────────────────┘
       │             │                │
       ▼             ▼                ▼
┌──────────┐  ┌──────────┐    ┌──────────┐
│ Bravo    │  │ DMS      │    │ Zalo     │
│ ERP      │  │ System   │    │ ZNS API  │
│ (2-way)  │  │ (1-way)  │    │ (1-way)  │
└──────────┘  └──────────┘    └──────────┘
```

| System | Direction | Protocol | Auth | Frequency |
|--------|-----------|----------|------|-----------|
| Bravo ERP | **2-way** (push + webhook) | REST HTTPS | API Key + HMAC | Event-driven + nightly recon |
| DMS | **1-way** (push only) | REST HTTPS | API Key | Event-driven |
| Zalo OA | **1-way** (push only) | REST HTTPS | OAuth2 access_token | Event-driven (per delivery) |
| OSRM | **Internal** (pull) | HTTP | None (internal Docker) | On-demand (VRP solve) |
| FCM | **1-way** (push only) | REST HTTPS | Service Account JSON | Event-driven |
| MinIO | **Internal** (push/pull) | S3 Protocol | Access Key / Secret Key | On-demand |

---

# 2. BRAVO ERP INTEGRATION

## 2.1 Tổng quan

Bravo là hệ thống kế toán. BHL OMS-TMS-WMS đẩy chứng từ sang Bravo sau khi confirm giao hàng, đồng thời nhận thông tin credit/balance từ Bravo.

| Flow | Direction | Trigger | Adapter Task |
|------|-----------|---------|-------------|
| Delivery confirmation → Phiếu giao hàng | Push | ePOD confirmed | `bravo:push_delivery` |
| Payment collection → Phiếu thu tiền | Push | Payment recorded | `bravo:push_payment` |
| Credit deduction → Cập nhật công nợ | Push | Order approved | `bravo:push_credit` |
| Return collection → Phiếu thu vỏ | Push | Return confirmed | `bravo:push_return` |
| Gate check → Phiếu xuất kho | Push | Gate check passed | `bravo:push_gate_check` |
| Asset compensation → Phiếu bồi hoàn | Push | Compensation approved | `bravo:push_compensation` |
| **Credit balance reconcile** | **Pull** | Nightly cron 02:00 | `bravo:recon_credit` |
| **Webhook: document posted** | **Receive** | Bravo callback | POST /webhooks/bravo |

## 2.2 Push: Delivery Confirmation

**Trigger:** ePOD status = `confirmed` (by driver hoặc NPP Zalo auto-confirm)

**Asynq Task:** `bravo:push_delivery`

**Payload gửi Bravo:**

```json
{
  "document_type": "PHIEU_GIAO_HANG",
  "document_date": "2026-04-15",
  "reference_id": "DEL-2026-04-15-001",
  "warehouse_code": "WH01",
  "customer_code": "NPP001",
  "driver_code": "DRV001",
  "vehicle_plate": "14C-12345",
  "items": [
    {
      "product_code": "BIA-HN-330",
      "lot_number": "LOT-2026-03-01",
      "quantity": 100,
      "unit": "thùng",
      "unit_price": 250000,
      "amount": 25000000
    }
  ],
  "total_amount": 25000000,
  "delivered_at": "2026-04-15T10:30:00+07:00",
  "epod_id": "uuid-epod-001",
  "gps_lat": 20.9544,
  "gps_lng": 107.0723
}
```

**Expected Bravo Response:**

```json
{
  "status": "accepted",
  "bravo_document_id": "BRV-PGH-2026-001",
  "posted_at": "2026-04-15T10:31:00+07:00"
}
```

**Error Responses:**

| HTTP | Meaning | Retry? |
|------|---------|--------|
| 200 | Accepted | — |
| 400 | Invalid payload | No → DLQ |
| 401 | Auth failed | No → Alert |
| 409 | Duplicate reference_id | No → Skip |
| 500 | Bravo internal error | Yes → retry 3x |

## 2.3 Push: Payment Collection

**Trigger:** Payment created (cash/transfer/credit)

**Asynq Task:** `bravo:push_payment`

```json
{
  "document_type": "PHIEU_THU_TIEN",
  "document_date": "2026-04-15",
  "reference_id": "PAY-2026-04-15-001",
  "customer_code": "NPP001",
  "payment_type": "cash",
  "amount": 25000000,
  "collected_by": "DRV001",
  "collected_at": "2026-04-15T11:00:00+07:00",
  "trip_id": "uuid-trip-001",
  "note": ""
}
```

## 2.4 Push: Credit Update

**Trigger:** Order approved that reduces credit limit

```json
{
  "document_type": "CAP_NHAT_CONG_NO",
  "customer_code": "NPP001",
  "order_reference": "ORD-2026-04-15-001",
  "debit_amount": 25000000,
  "effective_date": "2026-04-15"
}
```

## 2.5 Push: Return / Gate Check / Compensation

Format tương tự, với `document_type` = `PHIEU_THU_VO` / `PHIEU_XUAT_KHO` / `PHIEU_BOI_HOAN`.

## 2.6 Pull: Nightly Credit Reconciliation

**Schedule:** Asynq cron `0 2 * * *` (02:00 hàng đêm)

**Task:** `bravo:recon_credit`

**Flow:**

1. GET Bravo endpoint: `/api/credit-balances?date=YYYY-MM-DD`
2. Response: list of `{customer_code, balance}` cho tất cả NPP
3. Compare mỗi NPP balance vs `receivable_ledger.running_balance` trong DB
4. Nếu diff ≠ 0 → log vào `integration_logs` với severity=warning
5. Nếu diff > threshold (1,000,000 VND) → tạo notification cho Kế toán trưởng
6. Daily report email/notification với summary

**Reconcile Logic:**

```
for each customer in bravo_balances:
    our_balance = SELECT running_balance FROM receivable_ledger 
                  WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1
    diff = bravo_balance - our_balance
    if abs(diff) > 0:
        INSERT INTO integration_logs (system, event, severity, payload)
        VALUES ('bravo', 'credit_recon_diff', 'warning', {...})
    if abs(diff) > 1_000_000:
        // send alert notification
```

## 2.7 Receive: Bravo Webhook

**Endpoint:** `POST /webhooks/bravo`

**Auth:** Header `X-Bravo-API-Key` = shared secret

**Bravo sends khi document được posted/approved trong Bravo:**

```json
{
  "event_type": "document_posted",
  "bravo_document_id": "BRV-PGH-2026-001",
  "reference_id": "DEL-2026-04-15-001",
  "status": "posted",
  "posted_at": "2026-04-15T14:00:00+07:00"
}
```

**Server response:** `200 OK` — log vào `integration_logs`

**Idempotency:** Check `reference_id` + `event_type` duplicate trước khi process.

---

# 3. DMS INTEGRATION

## 3.1 Tổng quan

DMS (Distribution Management System) nhận cập nhật trạng thái đơn hàng từ OMS. **1-way push only.**

## 3.2 Push: Order Status Change

**Trigger:** `sales_orders.status` change

**Asynq Task:** `dms:push_order_status`

```json
{
  "event": "order_status_changed",
  "order_reference": "ORD-2026-04-15-001",
  "customer_code": "NPP001",
  "old_status": "new",
  "new_status": "shipped",
  "changed_at": "2026-04-15T08:00:00+07:00",
  "items": [
    {
      "product_code": "BIA-HN-330",
      "quantity_ordered": 100,
      "quantity_shipped": 100
    }
  ]
}
```

## 3.3 Status Events Pushed

| OMS Status Change | DMS Event |
|-------------------|-----------|
| new → approved | `order_approved` |
| approved → assigned | `order_assigned` |
| assigned → picked | `order_picked` |
| picked → shipped | `order_shipped` |
| shipped → delivered | `order_delivered` |
| any → cancelled | `order_cancelled` |
| any → returning | `order_returning` |

---

# 4. ZALO OA INTEGRATION

## 4.1 Tổng quan

Zalo OA dùng **CHỈ** để gửi tin nhắn xác nhận giao hàng cho NPP (Business Rule §11).

**Flow:**

```
ePOD confirmed → Generate token → Send ZNS message → NPP click link → Confirm/Dispute
                                                      (24h timeout → auto-confirm R13)
```

## 4.2 ZNS (Zalo Notification Service) API

**Prerequisites:**
- Zalo OA account verified
- ZNS template approved (BHL đăng ký)
- OAuth2 access_token (refresh trước khi hết hạn)

**API Call:**

```
POST https://business.openapi.zalo.me/message/template
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "phone": "84987654321",
  "template_id": "123456",
  "template_data": {
    "customer_name": "NPP Hải Phòng 01",
    "order_code": "ORD-2026-04-15-001",
    "delivery_date": "15/04/2026",
    "total_amount": "25,000,000 ₫",
    "total_items": "100 thùng",
    "confirm_link": "https://api.bhl-ops.vn/public/confirm/abc123-uuid-token"
  }
}
```

**Template (pre-approved ZNS):**

```
Kính gửi {{customer_name}},

Đơn hàng {{order_code}} ngày {{delivery_date}} đã giao thành công.
- Tổng hàng: {{total_items}}
- Tổng tiền: {{total_amount}}

Vui lòng xác nhận tại: {{confirm_link}}

Nếu không phản hồi trong 24h, đơn hàng sẽ tự động xác nhận.
```

## 4.3 NPP Confirm Page

**Endpoint:** `GET /public/confirm/:token`

```
┌──────────────────────────────────┐
│   XÁC NHẬN GIAO HÀNG - BHL      │
├──────────────────────────────────┤
│ Đơn hàng: ORD-2026-04-15-001    │
│ Ngày giao: 15/04/2026           │
│ Tài xế: Nguyễn Văn A            │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ STT │ Sản phẩm    │ SL │ ĐG │ │
│ │  1  │ Bia HN 330ml│100 │250k│ │
│ │                      Tổng:  │ │
│ │                   25,000,000│ │
│ └──────────────────────────────┘ │
│                                  │
│  [✅ Xác nhận đã nhận đủ]       │
│  [⚠ Chi tiết chênh lệch]       │
│                                  │
│ Ghi chú: ___________________    │
│                                  │
│         [GỬI XÁC NHẬN]         │
└──────────────────────────────────┘
```

**POST /public/confirm/:token**

```json
{
  "status": "confirmed",   // hoặc "disputed"
  "note": "Đã nhận đủ"
}
```

## 4.4 Auto-Confirm Cron (R13)

**Schedule:** Asynq cron `*/30 * * * *` (mỗi 30 phút)

```sql
UPDATE zalo_confirmations
SET status = 'auto_confirmed', confirmed_at = NOW()
WHERE status = 'pending'
  AND sent_at < NOW() - INTERVAL '24 hours';
```

→ Log vào `integration_logs` với event `zalo_auto_confirm`.

## 4.5 Token Security

- Token = UUID v4 (128-bit entropy)
- Expires: 72h sau khi tạo (nhưng auto-confirm ở 24h)
- Single-use: After confirm/dispute, token invalidated
- No auth required (public page) nhưng token tự nó là auth

---

# 5. OSRM SELF-HOSTED

## 5.1 Setup

```yaml
# docker-compose.yml
osrm:
  image: osrm/osrm-backend:v5.27.1
  volumes:
    - ./osrm-data:/data
  command: osrm-routed --algorithm mld /data/vietnam-latest.osrm
  ports:
    - "5000:5000"
```

**Data prep (1 lần):**

```bash
# Download Vietnam OSM data
wget https://download.geofabrik.de/asia/vietnam-latest.osm.pbf

# Extract → Partition → Customize
docker run -v ./osrm-data:/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/vietnam-latest.osm.pbf
docker run -v ./osrm-data:/data osrm/osrm-backend osrm-partition /data/vietnam-latest.osrm
docker run -v ./osrm-data:/data osrm/osrm-backend osrm-customize /data/vietnam-latest.osrm
```

## 5.2 API Endpoints Used

### Distance Matrix (VRP input)

```
GET http://osrm:5000/table/v1/driving/{coordinates}?annotations=distance,duration
```

**coordinates:** semicolon-separated `lng,lat` pairs

**Response extract:**

```json
{
  "durations": [[0, 120, 300], [120, 0, 250], [300, 250, 0]],
  "distances": [[0, 5000, 12000], [5000, 0, 8000], [12000, 8000, 0]]
}
```

### Route (navigation)

```
GET http://osrm:5000/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full
```

## 5.3 Performance

| Metric | Target |
|--------|--------|
| Distance matrix 100×100 | < 2s |
| Single route query | < 200ms |
| Memory footprint | ~2GB RAM cho Vietnam data |

---

# 6. FIREBASE CLOUD MESSAGING

## 6.1 Use Cases

| Notification | Recipient | Priority |
|-------------|-----------|----------|
| New trip assigned | Driver | High |
| Trip cancelled | Driver | High |
| Order status changed | NPP (nếu có app) | Normal |
| Discrepancy escalation | Kế toán trưởng | High |
| System alert | Admin | High |

## 6.2 Implementation

```go
// Send FCM push notification
func (s *NotificationService) SendPush(ctx context.Context, deviceToken, title, body string, data map[string]string) error {
    msg := &messaging.Message{
        Token: deviceToken,
        Notification: &messaging.Notification{
            Title: title,
            Body:  body,
        },
        Data: data,
        Android: &messaging.AndroidConfig{
            Priority: "high",
        },
    }
    _, err := s.fcmClient.Send(ctx, msg)
    return err
}
```

## 6.3 Device Registration

Driver App đăng ký token khi login:

```
POST /v1/driver/device
{
  "fcm_token": "firebase-token-xxx",
  "platform": "android",
  "app_version": "1.0.0"
}
```

Stored trong bảng `devices`. Token refreshed khi app khởi động.

---

# 7. MINIO / S3 FILE STORAGE

## 7.1 Use Cases

| File Type | Max Size | Retention |
|-----------|----------|-----------|
| ePOD photos | 5 MB each, max 5 per delivery | 1 year |
| Checklist photos | 5 MB, max 3 | 6 months |
| Return photos | 5 MB, max 3 | 1 year |
| Gate check photos | 5 MB, max 3 | 6 months |
| Incident photos | 5 MB, max 5 | 1 year |

## 7.2 Upload Flow (Pre-signed URL)

```
Driver App → GET /v1/driver/upload-url?type=epod&filename=photo1.jpg
           ← { "upload_url": "https://minio:9000/...", "file_key": "epod/2026/04/15/uuid.jpg" }
           → PUT upload_url (binary)
           → POST /v1/driver/epod { ..., "photo_keys": ["epod/2026/04/15/uuid.jpg"] }
```

## 7.3 Docker Compose

```yaml
minio:
  image: minio/minio:RELEASE.2024-01-01T00-00-00Z
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
  volumes:
    - minio-data:/data
  ports:
    - "9000:9000"
    - "9001:9001"
```

---

# 8. ERROR HANDLING & RETRY

## 8.1 Retry Strategy

| Integration | Max Retries | Backoff | Timeout |
|------------|-------------|---------|---------|
| Bravo push | 3 | Exponential: 30s → 1m → 5m | 30s per request |
| DMS push | 3 | Exponential: 30s → 1m → 5m | 15s per request |
| Zalo ZNS send | 3 | Exponential: 10s → 30s → 1m | 10s per request |
| FCM push | 2 | Fixed: 5s | 5s per request |

## 8.2 Asynq Task Configuration

```go
// Bravo push delivery task
asynq.NewTask("bravo:push_delivery", payload,
    asynq.MaxRetry(3),
    asynq.Timeout(30*time.Second),
    asynq.Queue("integration"),
    asynq.Retention(7*24*time.Hour),
    asynq.Unique(24*time.Hour),  // idempotency by payload hash
)
```

## 8.3 Retry Decision Matrix

| HTTP Status | Action |
|-------------|--------|
| 2xx | Success → mark done |
| 400 | Bad request → DLQ (no retry, payload issue) |
| 401/403 | Auth error → DLQ + alert admin |
| 404 | Not found → DLQ |
| 408/429 | Timeout/Rate limit → retry with backoff |
| 500/502/503 | Server error → retry |
| Network error | → retry |

---

# 9. DEAD LETTER QUEUE (DLQ)

## 9.1 Archiving

Asynq automatically archives failed tasks (after max retries exhausted). Admin UI to view + re-process.

## 9.2 Admin DLQ Endpoints

| Endpoint | Action |
|----------|--------|
| `GET /v1/admin/dlq` | List failed tasks with pagination |
| `GET /v1/admin/dlq/:task_id` | View task detail (payload, error, attempts) |
| `POST /v1/admin/dlq/:task_id/retry` | Manual re-process |
| `DELETE /v1/admin/dlq/:task_id` | Skip / acknowledge |

## 9.3 DLQ Alert

Nếu DLQ size > 10 trong 1 giờ → alert Kế toán trưởng + Admin.

---

# 10. MONITORING & ALERTING

## 10.1 Integration Metrics (Prometheus)

| Metric | Type | Labels |
|--------|------|--------|
| `integration_push_total` | Counter | system, event, status |
| `integration_push_duration_seconds` | Histogram | system, event |
| `integration_retry_total` | Counter | system, event |
| `integration_dlq_size` | Gauge | system |
| `bravo_recon_diff_total` | Counter | severity |
| `zalo_send_total` | Counter | status |
| `zalo_auto_confirm_total` | Counter | — |

## 10.2 Alert Rules

| Alert | Condition | Action |
|-------|-----------|--------|
| `BravoPushFailing` | `integration_push_total{system="bravo",status="error"} > 5 in 1h` | Notify admin |
| `DLQBuildup` | `integration_dlq_size > 10` | Notify admin + KT |
| `BravoReconHighDiff` | `bravo_recon_diff_total{severity="high"} > 0` | Notify KT trưởng |
| `ZaloSendFailing` | `zalo_send_total{status="error"} > 3 in 1h` | Notify admin |

## 10.3 integration_logs Table

Mọi integration event đều log:

```sql
INSERT INTO integration_logs (system, direction, event, status, 
    request_payload, response_payload, http_status, duration_ms, error_message)
VALUES ('bravo', 'push', 'delivery', 'success', '{}', '{}', 200, 450, NULL);
```

Retention: 90 ngày, sau đó archive.

---

# 11. SECURITY

| Concern | Solution |
|---------|----------|
| Bravo API auth | Shared API Key in header `X-API-Key` (env var, never in code) |
| Bravo webhook auth | Validate `X-Bravo-API-Key` header |
| DMS API auth | Shared API Key in header |
| Zalo OAuth2 | Access token + refresh, stored encrypted in Redis |
| MinIO credentials | Env vars, never in code |
| FCM credentials | Service account JSON file, mounted as Docker secret |
| OSRM | Internal Docker network only, no public exposure |
| Webhook replay attack | Idempotency check on `reference_id` + timestamp validation (±5 min) |
| NPP confirm token | UUID v4 (128-bit), single-use, TTL 72h |
| TLS | All external calls use HTTPS |
| Secrets management | Docker secrets / `.env` file (not in Git) |

---

# 12. SEQUENCE DIAGRAMS

## 12.1 Delivery → Bravo Sync

```
Driver        OMS/TMS           Asynq Queue       Bravo Adapter      Bravo ERP
  │              │                   │                  │                │
  │─ePOD submit─▶│                   │                  │                │
  │              │─create task──────▶│                  │                │
  │              │                   │─dequeue─────────▶│                │
  │              │                   │                  │─POST delivery─▶│
  │              │                   │                  │◀──200 OK───────│
  │              │                   │◀─task done───────│                │
  │              │◀─update log───────│                  │                │
  │              │                   │                  │                │
  │              │   [If Bravo 500]  │                  │                │
  │              │                   │─retry 30s───────▶│                │
  │              │                   │─retry 1m────────▶│                │
  │              │                   │─retry 5m────────▶│                │
  │              │                   │─DLQ──────────────│ (after 3 fails)│
```

## 12.2 Zalo Confirm Flow

```
TMS           Zalo Adapter    Zalo API    NPP (person)   Confirm Page    DB
 │                │               │            │              │           │
 │─ePOD OK───────▶│               │            │              │           │
 │                │─gen token──────────────────────────────────────────────▶│
 │                │─POST ZNS─────▶│            │              │           │
 │                │◀─200 OK───────│            │              │           │
 │                │               │─Zalo msg──▶│              │           │
 │                │               │            │─click link──▶│           │
 │                │               │            │              │─GET /confirm/token─▶│
 │                │               │            │              │◀─order data─────────│
 │                │               │            │◀─show page───│           │
 │                │               │            │─click confirm─▶│          │
 │                │               │            │              │─POST confirm────────▶│
 │                │               │            │              │  status=confirmed    │
 │                │               │            │◀─thank you───│           │
 │                │               │            │              │           │
 │ [If no response in 24h]       │            │              │           │
 │                │─cron check────────────────────────────────────────────▶│
 │                │               │            │              │  auto_confirmed      │
```

## 12.3 Nightly Bravo Reconciliation

```
Cron (02:00)    Bravo Adapter    Bravo API    DB             Notification
    │                │               │          │                 │
    │─trigger───────▶│               │          │                 │
    │                │─GET balances──▶│          │                 │
    │                │◀─800 NPP──────│          │                 │
    │                │               │          │                 │
    │                │─compare each──────────▶ │                  │
    │                │  our_balance vs bravo   │                  │
    │                │               │          │                 │
    │                │ [diff > 0]    │          │                 │
    │                │─log warning───────────▶ │                  │
    │                │               │          │                 │
    │                │ [diff > 1M]   │          │                 │
    │                │─alert──────────────────────────────────────▶│
    │                │               │          │                 │
    │                │─summary log───────────▶ │                  │
```

---

**=== HẾT TÀI LIỆU INT v1.0 ===**

*Integration Specification v1.0 — 6 external systems, payload schemas, retry/DLQ, sequence diagrams, security.*
