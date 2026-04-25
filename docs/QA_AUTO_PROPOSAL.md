# ĐỀ XUẤT: QUY TRÌNH QA TỰ ĐỘNG — VIBE CODE & BHL OMS-TMS-WMS

> **Dành cho:** Người không có kỹ thuật (non-tech founder/PM)  
> **Mục đích:** Giải thích QA automation là gì, tại sao cần, và hệ thống này hoạt động như thế nào  
> **Cập nhật:** 26/04/2026

---

## PHẦN 1 — NẾN TẢNG: QA TỰ ĐỘNG LÀ GÌ?

### Vấn đề của Vibe Coding không có QA

Khi dùng AI để code nhanh ("Vibe coding"), bạn build được rất nhiều tính năng trong thời gian ngắn.
**Nhưng:** AI code nhanh → bug cũng xuất hiện nhanh → không có lưới bắt → production bị lỗi.

| Cách cũ (không QA) | Cách mới (có QA tự động) |
|---|---|
| AI code xong → push → xong | AI code → gate check → test tự động → push |
| Bug phát hiện khi user dùng | Bug phát hiện ngay khi commit |
| Fix bug mất 1–3 ngày | Fix bug mất 10 phút (context còn tươi) |
| Không biết cái gì đang hoạt động | Dashboard real-time: xanh/đỏ rõ ràng |
| 1 người test thủ công | Máy test 24/7 liên tục |

### Triết lý cốt lõi

```
🤖 AI sinh code  →  🔍 Máy kiểm tra  →  🚦 Gate quyết định  →  ✅/❌ Push hoặc block
```

Người không cần hiểu code. Người chỉ cần đọc kết quả: **PASS** hoặc **FAIL**.

---

## PHẦN 2 — FRAMEWORK CHUNG CHO MỌI DỰ ÁN VIBE CODE

### 5 tầng QA (từ nhanh đến toàn diện)

```
┌──────────────────────────────────────────────────────────────────┐
│  TẦNG 5 — Synthetic Monitoring  (chạy 24/7, cứ 15 phút/lần)    │
│           Giả lập user thật, alert Telegram khi có vấn đề       │
├──────────────────────────────────────────────────────────────────┤
│  TẦNG 4 — E2E Test              (chạy mỗi đêm tự động)          │
│           Playwright: click từ đầu đến cuối như user thật        │
├──────────────────────────────────────────────────────────────────┤
│  TẦNG 3 — API Contract Test     (chạy mỗi lần deploy)           │
│           Bruno: gọi mọi API endpoint, kiểm tra response         │
├──────────────────────────────────────────────────────────────────┤
│  TẦNG 2 — Business Rule Test    (chạy mỗi lần AI thay đổi code) │
│           Go test: kiểm tra các quy tắc nghiệp vụ cốt lõi       │
├──────────────────────────────────────────────────────────────────┤
│  TẦNG 1 — Pre-commit Check      (chạy trước mỗi commit, < 10s)  │
│           PowerShell: quét code tìm pattern nguy hiểm đã biết   │
└──────────────────────────────────────────────────────────────────┘
```

### Ai làm gì — bảng phân công

| Việc | Người làm | Cách làm |
|------|-----------|----------|
| Viết test case từ code | **AI tự làm** | AI đọc handler.go → sinh Bruno test |
| Chạy kiểm tra trước commit | **Máy tự chạy** | hook git → PowerShell script |
| Deploy và test sau push | **CI tự chạy** | GitHub Actions → Mac mini |
| Monitor 24/7 | **Bot tự chạy** | Python script → Telegram alert |
| Xem báo cáo UX | **Bạn xem** | Clarity dashboard + Telegram |
| Quyết định release | **Bạn quyết định** | Dựa trên đèn xanh/đỏ |

### Bộ công cụ tối thiểu cho mọi dự án Vibe Code

| Công cụ | Chi phí | Làm gì |
|---------|---------|--------|
| **GitHub Actions** | Miễn phí (self-hosted) | Tự động chạy khi push code |
| **Bruno** | Miễn phí | Test API, lưu trong git |
| **Playwright** | Miễn phí | Test UI như người dùng |
| **Microsoft Clarity** | Miễn phí | Xem người dùng làm gì (replay) |
| **Telegram Bot** | Miễn phí | Alert ngay khi hệ thống gặp vấn đề |
| **PowerShell/Bash** | Miễn phí | Check code trước khi commit |

**Tổng chi phí: $0/tháng** cho quy trình QA đầy đủ.

---

## PHẦN 3 — TRIỂN KHAI CỤ THỂ CHO BHL OMS-TMS-WMS

### 3.1 — Bản đồ hệ thống QA hiện tại

```
┌─────────────────────────────────────────────────────┐
│                    BHL QA SYSTEM                     │
│                                                      │
│  Bạn push code                                      │
│       ↓                                              │
│  [1] Pre-commit Hook ──────────────────────────────→ BLOCK nếu có LH-02/LH-03
│       ↓ PASS                                         │
│  [2] GitHub Actions (deploy.yml)                    │
│       ├─ Build Docker images                         │
│       ├─ Deploy lên Mac mini (bhl.symper.us)         │
│       └─ Health check sau deploy                     │
│                                                      │
│  Sau deploy, 2 luồng song song:                     │
│       ↓                                              │
│  [3] QA CI (qa.yml — mới tạo)                       │
│       ├─ Bruno API tests (5 business rules)          │
│       └─ Playwright E2E (3 luồng chính)              │
│                                                      │
│  Liên tục (15 phút/lần):                            │
│  [4] Windows Task Scheduler → telegram_alert.py     │
│       └─ Telegram alert nếu /health fail            │
│                                                      │
│  Liên tục (session người dùng):                     │
│  [5] Microsoft Clarity                              │
│       └─ Replay session, heatmap, alert bất thường   │
└─────────────────────────────────────────────────────┘
```

### 3.2 — Trạng thái từng phần (26/04/2026)

| # | Thành phần | Trạng thái | Ghi chú |
|---|-----------|-----------|---------|
| 1 | **Pre-commit hook** | ✅ Script tồn tại | `check-code-quality.ps1` |
| | → Hook git tự kích hoạt | 🔴 Chưa cài | **Vừa cài xong (bước này)** |
| 2 | **GitHub Actions deploy** | ✅ Hoạt động | `deploy.yml` — đang dùng |
| 3 | **GitHub Actions QA CI** | 🔴 Chưa có | **Vừa tạo xong (bước này)** |
| | → Bruno API tests | ✅ File test tồn tại | `tests/api/business-rules/` |
| | → Playwright E2E | ✅ File test tồn tại | `web/tests/e2e/` |
| 4 | **Telegram health monitor** | ✅ Script tồn tại | `scripts/telegram_alert.py` |
| | → Task Scheduler Windows | 🔴 Chưa cài | **Vừa tạo script cài (bước này)** |
| 5 | **Microsoft Clarity** | ✅ Đang chạy | `bhl.symper.us` |
| | → Project ID trong .env | 🔴 Chưa set | **Vừa tạo .env.local (bước này)** |

### 3.3 — 3 Gate bảo vệ trước go-live (15/05/2026)

```
GATE A — "Không có lỗ hổng chết người"          ← Phải PASS trước mọi thứ
─────────────────────────────────────────────────
✅ LH-03: Silent error đã sửa (handleError)
✅ LH-04: Offline queue đã wire
✅ LH-02: safeParseVND đã tạo + dùng
→ Kiểm tra: Tắt backend → form phải hiện warning

GATE B — "Nghiệp vụ cốt lõi đúng"              ← Phải PASS 1 tuần trước go-live
─────────────────────────────────────────────────
☐ R01: Gate check zero tolerance → API trả 400
☐ R08: Cutoff 16h → API block đơn muộn
☐ R15: Credit limit → order vào pending_approval
☐ R18: Biên bản C immutable → không sửa được sau ký
☐ C08: Duplicate submit → chỉ tạo 1 đơn dù submit 2 lần
→ Chạy: Bruno collection trong CI

GATE C — "Hệ thống ổn định 48h liên tục"       ← Phải PASS trước ngày go-live
─────────────────────────────────────────────────
☐ Telegram: 0 alert trong 48h
☐ Clarity: không có rage-click, không có dead-click
☐ Error rate: < 1% (Clarity + backend logs)
→ Xem: Clarity dashboard + Telegram history
```

### 3.4 — 5 Quy tắc kinh doanh phải không bao giờ sai

| ID | Quy tắc | Hệ quả nếu sai |
|----|---------|----------------|
| R01 | Số hàng giao PHẢI khớp lệnh xuất | Mất hàng, sai kho |
| R08 | Đơn đặt sau 16:00 không giao hôm nay | Nhầm lịch, phàn nàn KH |
| R15 | NPP vượt hạn mức tín dụng → phải duyệt | Mất tiền, nợ xấu |
| R18 | Biên bản C đã ký không được sửa | Tranh chấp pháp lý |
| C08 | Không được tạo 2 đơn giống nhau | Giao trùng, hoàn tiền |

### 3.5 — Lịch chạy tự động

| Khi nào | Gì chạy | Kết quả ở đâu |
|---------|---------|--------------|
| Trước mỗi commit | Pre-commit hook → kiểm tra code | Terminal của bạn |
| Mỗi lần push code | GitHub Actions deploy → build + deploy | GitHub Actions tab |
| Mỗi lần push code | GitHub Actions QA → Bruno + Playwright | GitHub Actions tab |
| Mỗi 15 phút | Telegram health check | Telegram |
| Liên tục | Microsoft Clarity | Clarity dashboard |
| Mỗi đêm 2:00 AM | Playwright synthetic E2E | GitHub Actions + Telegram |

---

## PHẦN 4 — HƯỚNG DẪN ĐỌC KẾT QUẢ (Dành cho Non-tech)

### Khi nhận Telegram alert

```
❌ BHL ALERT (1 lần fail) → Theo dõi, chưa cần hành động
❌❌ BHL ALERT (2 lần fail liên tiếp) → Kiểm tra bhl.symper.us ngay
❌❌❌ BHL ALERT (3+ lần) → Gọi dev ngay, có thể server down
✅ BHL OK: All systems healthy → Bình thường
```

### Khi xem GitHub Actions

```
🟢 All checks passed → Code OK, deploy thành công
🔴 Check failed → AI sẽ tự phân tích và báo bạn
🟡 In progress → Đang chạy, chờ 5 phút
```

### Khi xem Clarity

- **Sessions tab:** Xem replay người dùng thật đang làm gì
- **Heatmaps tab:** Màu đỏ = nhiều click → nội dung quan trọng / confusing
- **Rage clicks** (biểu tượng lửa): Người dùng bấm liên tục = UI bị bug hoặc confusing
- **Dead clicks** (biểu tượng X): Bấm vào chỗ không làm gì = UI misleading

---

## PHẦN 5 — CHECKLIST MỖI TUẦN (Non-tech)

```
□ Mở Telegram → kiểm tra alert 7 ngày qua → có alert lạ không?
□ Mở Clarity → tab "Recordings" → xem 2-3 session → có gì kỳ lạ không?
□ Mở GitHub Actions → tab "Actions" → QA ci có xanh không?
□ Mở bhl.symper.us → login với tài khoản demo → thử tạo 1 đơn → OK không?
□ Hỏi AI: "Tuần này có bug nào mới không? Kiểm tra KNOWN_ISSUES.md"
```

---

## PHẦN 6 — TỔNG KẾT CHI PHÍ & CÔNG SỨC

| Hạng mục | Chi phí tiền | Công sức bạn (non-tech) | AI/Máy làm |
|----------|-------------|------------------------|-----------|
| Setup ban đầu | $0 | 1 lần, ~30 phút | 95% |
| Duy trì hàng ngày | $0 | 5 phút/ngày | 95% |
| Khi có alert | $0 | 10 phút/incident | 60% |
| Review tuần | $0 | 15 phút/tuần | 80% |
| **Tổng** | **$0** | **~2 giờ/tuần** | **90%** |

### So sánh với không có QA

| | Không có QA | Có QA tự động |
|---|---|---|
| Bug production/tháng | 10–20 | 1–3 |
| Thời gian fix bug | 1–3 ngày/bug | 10 phút/bug |
| Mất dữ liệu | Có thể xảy ra | Rất khó xảy ra |
| User experience | Không ổn định | Ổn định |
| Bạn biết gì đang hỏng | Không biết cho đến khi user báo | Biết ngay (< 15 phút) |

---

*Tài liệu này được tạo bởi AI Copilot — 26/04/2026*  
*Cập nhật khi framework thay đổi hoặc có gate mới*
