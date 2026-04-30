# BHL Notification System — World-Class Design
*Phiên bản cuối · Tháng 04/2026 · Symper × Beer Hạ Long*

---

## 1. Tóm tắt vấn đề

Hệ thống đang có **48 event types** (BRD §11), WebSocket real-time đã implement, NotificationBell dropdown đã có — plumbing đúng. Thứ còn thiếu là **intelligence layer**: priority engine, grouping engine, actionable payload và per-role routing.

| Tiêu chí | Hiện tại | World-class target |
|----------|----------|--------------------|
| Priority tiers | 1 tier (tất cả như nhau) | 4 tiers: P0/P1/P2/P3 |
| Kênh giao tiếp | In-app toast + bell | In-app + Push + Zalo OA + SMS + Email digest |
| Grouping | Không — mỗi event 1 notification | Smart batching 5 phút, surface exception riêng |
| Actionable | 0% — phải navigate vào trang | Approve/Reject/Call ngay từ notification |
| Per-role preference | Không có | Mỗi user tắt/bật từng loại, theo role preset |
| Auto-escalation | Không có | P0 auto-escalate lên manager sau 5p nếu chưa ACK |
| ACK state | Không có | is_acknowledged + acknowledged_at tách biệt is_read |
| Idempotency | Không có | idempotency_key ngăn duplicate notification |

---

## 2. Hệ thống 4 tầng Priority

Map vào `priority` column hiện có trong DB: `urgent=P0 · high=P1 · normal=P2 · low=P3`

| Tier | Tên | Trigger điển hình | Kênh | Hành động trong notif |
|------|-----|-------------------|------|----------------------|
| **P0** `urgent` | Critical interrupt | Xe hỏng, GPS anomaly nghiêm trọng, NPP VIP trễ >2h | In-app banner → [T+2p] Zalo → [T+5p] SMS + escalate Manager | Tạo RO · Điều xe · Gọi tài xế |
| **P1** `high` | Attention needed | Đơn pending >30p, ETA lệch >30p, sai lệch đối soát | In-app badge + Push | Duyệt · Từ chối · Báo NPP |
| **P2** `normal` | FYI grouped | Trip completed, driver check-in, gate check pass | In-app bell only · Digest theo giờ | Xem chi tiết (optional) |
| **P3** `low` | Digest only | KPI tuần, báo cáo tháng, giấy tờ hết hạn 30 ngày | Email digest + Zalo OA digest | Xem báo cáo · Export |

### 2.1 P0 Progressive Escalation (không phải parallel channels)

> ⚠️ **Lỗi thiết kế phổ biến**: Gửi 4 kênh cùng lúc cho P0 = notification spam. Dispatcher nhận 4 tiếng ping cùng lúc → panic. PagerDuty thực sự dùng **progressive escalation**.

```
T+0:   In-app PersistentToast + Push (nếu có)
T+2p:  Nếu chưa ACK → Zalo OA
T+5p:  Nếu vẫn chưa ACK → SMS + tạo notification mới cho Manager
```

Cron job chạy mỗi 1 phút, query `urgent + is_acknowledged=FALSE + created_at < NOW()-5m + escalated_at IS NULL`.

### 2.2 ACK vs Read — phân biệt quan trọng

```
is_read = true     → "User đã mở và thấy notification"
is_acknowledged = true → "User xác nhận đã xử lý / đang xử lý"
```

P0 escalation trigger dựa trên `is_acknowledged`, **không phải** `is_read`. User có thể đọc mà chưa xử lý.

---

## 3. Smart Grouping Engine

### 3.1 Nguyên tắc

- Cùng loại event + cùng entity type + trong 5 phút → gộp thành 1 notification với count
- Exception trong group → surface riêng, không gộp (xe mất liên lạc, xe trễ >2h)
- **P0 không bao giờ bị group** → luôn riêng lẻ, luôn interrupt
- Tối đa 50 items/group → sau 50: "Xe 51G-001 +49 xe khác"
- Group tự động hết hạn sau 30 phút → reset

### 3.2 Group key format

```
{event_type}:{entity_type}:{role}:{timestamp_floor_5min}
```

Ví dụ: `trip_completed:trip:dispatcher:2026-04-29T17:00` — 5-minute window, không gộp cross-window.

### 3.3 Trước vs Sau

| Hiện tại | World-class |
|----------|-------------|
| 16 toast riêng lẻ khi xe về đồng loạt | 1 notification grouped |
| User tắt notifications để tránh spam | Exception vẫn surface riêng |

---

## 4. Actionable Notifications

### 4.1 Payload chuẩn

```json
{
  "id": "notif-uuid",
  "priority": "urgent",
  "category": "tms",
  "title": "51G-067 mất tín hiệu 23 phút",
  "body": "Khu vực Hải Dương · Tài xế: Nguyễn Văn A",
  "entity_type": "trip",
  "entity_id": "trip-uuid",
  "link": "/trips/trip-uuid",
  "actions": [
    { "label": "Gọi tài xế", "method": "POST", "endpoint": "/trips/trip-uuid/call-driver" },
    { "label": "Xem trên map", "method": "GET", "endpoint": "/trips/trip-uuid/map" }
  ],
  "is_acknowledged": false
}
```

### 4.2 Backend action endpoint

```
POST /v1/notifications/:id/action/:actionKey
```

**Bắt buộc có:**
- Rate limiting: max 10 actions/phút per user
- Idempotency key trong header `X-Idempotency-Key`
- Audit log ghi rõ "approved via notification"
- Confirmation cho action value > threshold (cấu hình)

### 4.3 Ví dụ theo role

**Kế toán:**
> 3 đơn chờ duyệt · Lâu nhất 1h12p · Tổng ₫387M
> `[Duyệt tất cả <50% HM]` `[Xem 2 đơn vượt HM]`

**Dispatcher:**
> 51G-067 mất tín hiệu 23 phút · Hải Dương
> `[Gọi tài xế]` `[Xem trên map]` `[Đánh dấu đã xử lý ✓]`

---

## 5. Routing Matrix — 5 kênh

| Event type | In-app | Push | Zalo | SMS | Digest |
|------------|--------|------|------|-----|--------|
| Xe hỏng / breakdown (P0) | ✓ | T+0 | T+2p | T+5p | — |
| GPS anomaly P0 | ✓ | T+0 | T+2p | T+5p | — |
| NPP VIP trễ >2h (P0) | ✓ | T+0 | T+2p | — | — |
| Đơn pending >30p (P1) | ✓ | ✓ | — | — | — |
| ETA lệch >30p (P1) | ✓ | ✓ | ✓ | — | — |
| Sai lệch đối soát (P1) | ✓ | ✓ | — | — | — |
| Trip completed (P2) | ✓ | — | — | — | ✓ |
| KPI weekly (P3) | — | — | ✓ | — | ✓ |
| Giấy tờ sắp hết hạn (P3) | ✓ | — | — | — | ✓ |

> **Zalo OA dependency**: Task 1.9 (credentials từ BHL IT) đang pending. Build stub trước, swap in sau.

---

## 6. Per-Role Notification Preferences

| Role | P0 | P1 | P2 | P3 digest | Push | Ghi chú |
|------|----|----|----|-----------|----|---------|
| Dispatcher | Tất cả | Trip + ETA | Trip status | Tắt | Bật | Real-time ops |
| Accountant | Tất cả | Approval + recon | Payment | Bật | Bật | EOD digest quan trọng |
| DVKH | P0 only | Order status | Bật | Tắt | Bật | Ít interrupt |
| Driver | P0 only | Trip của mình | Tắt | Tắt | Bật | Chỉ trip của mình |
| Warehouse | P0 only | Handover | Tắt | Tắt | Bật | Focus handover + scan |
| Management | P0 escalation | Tắt | Tắt | Bật weekly | Tắt | Không nhận operational noise |
| Security | P0 all | Gate fail | Tắt | Tắt | Bật | Ca đêm |
| Admin | P0 all | System alert | Bật | Bật | Bật | Full visibility |
| Workshop | Vehicle P0 | Maintenance | Tắt | Tắt | Bật | Chỉ xe và lịch bảo dưỡng |

---

## 7. Database Schema (Phase 1 — đã implement)

### 7.1 Bổ sung vào notifications table

```sql
ALTER TABLE notifications
  ADD COLUMN is_acknowledged      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN acknowledged_at      TIMESTAMPTZ,
  ADD COLUMN resolved_at          TIMESTAMPTZ,
  ADD COLUMN idempotency_key      TEXT,
  ADD COLUMN expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  ADD COLUMN escalated_at         TIMESTAMPTZ,
  ADD COLUMN escalated_to_user_id UUID REFERENCES users(id);
```

### 7.2 notification_preferences table (Phase 4)

```sql
CREATE TABLE notification_preferences (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('in_app','push','zalo','sms','digest')),
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, event_type, channel)
);
```

---

## 8. Lộ trình Implementation (đã cập nhật effort)

| Giai đoạn | Nội dung | Effort thực tế | Status |
|-----------|----------|---------------|--------|
| **Phase 1** | Schema ACK+idempotency+expiry · ACK endpoint · Escalation cron · UI priority hierarchy + time sections + ACK button | **2.5 ngày** | ✅ Implemented |
| **Phase 2** | Redis/DB grouping buffer · Group notification với count · Exception surface riêng | 2 ngày backend | Planned |
| **Phase 3** | Actionable payload populate · `POST /action/:key` endpoint · Security controls | 2 ngày full-stack | Planned |
| **Phase 4** | notification_preferences table · UI settings toggle matrix · Per-role presets · Redis caching | 1.5 ngày full-stack | Planned |
| **Phase 5** | Zalo OA integration (khi có credentials) · Push/FCM · Email digest | 2 ngày + BHL IT | Blocked by task 1.9 |

### 8.1 Không làm (scope creep cho v1)

- ❌ Email real-time transactional (P3 weekly digest email là khác)
- ❌ Notification sound custom
- ❌ Read receipt 2-way (is_acknowledged là đủ)
- ❌ Web Push browser (service worker — Phase 5)
- ❌ Full audit trail per-action (giai đoạn 3 trở đi)

---

## 9. Benchmark — World-Class Reference

| Product | Tính năng học được | Áp dụng |
|---------|-------------------|---------|
| **PagerDuty** | Progressive escalation: T+0/T+2/T+5, on-call policy | P0 progressive escalation (không phải parallel) |
| **Linear** | Clean notification center, action trong notification | Actionable payload + group |
| **Stripe Dashboard** | Exception-only escalation, signal clarity | P0/P1 only interrupt, P2/P3 ẩn |
| **Notion** | Per-channel preference UI | Settings > Notifications toggle |
| **Onfleet** | Predictive alert trước khi vấn đề xảy ra | AI exception explanation |

---

## 10. Frontend UX Architecture

```
Toast Layer (z-9000)
├── PersistentToast  — P0 urgent, manual dismiss + [Đã xử lý ✓] ACK button
└── AutoToast        — P1 high, 8s auto-dismiss + progress bar + queue count

Notification Bell Panel (slide-from-right)
├── Header: unread count + "Đọc hết"
├── Search bar (keyword search in title/body)
├── Category filter chips
├── Time sections: Hôm nay / Hôm qua / Tuần này / Cũ hơn
├── Notification items với:
│   ├── Priority left-border: red=urgent, orange=high, blue=normal, gray=low
│   ├── "Đã xử lý" badge nếu is_acknowledged=true
│   ├── "Đã giải quyết" badge nếu resolved_at set
│   └── ACK button cho urgent items trong list
└── Footer: "Xem tất cả" → /dashboard/notifications

Full Page /dashboard/notifications (Phase 4)
├── History 90 ngày với pagination
├── Bulk select + archive
└── Preferences settings per category × channel
```

---

*Tài liệu này là nguồn sự thật duy nhất cho notification system. Cập nhật khi có quyết định thiết kế mới.*
