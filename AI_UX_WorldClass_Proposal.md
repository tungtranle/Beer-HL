# AI-native UX Proposal — BHL OMS/TMS/WMS

**Phiên bản:** 1.0  
**Ngày:** 2026-04-26

---

## Nhận định Chính

Tôi đồng ý với anh: bản audit hiện tại đã “đẹp hơn, gọn hơn, có AI feature”, nhưng chưa thật sự là **AI-native operations experience**. Nó vẫn đang xoay quanh mô hình cũ: người dùng đi qua nhiều màn hình, đọc nhiều bảng, tự quyết định nhiều bước. World-class ở giai đoạn 2026 phải chuyển sang mô hình mới:

> Hệ thống không chỉ hiển thị dữ liệu. Hệ thống phải hiểu tình huống, đề xuất việc cần làm tiếp theo, tự động chuẩn bị phương án, và để con người duyệt ở điểm rủi ro cao.

Với BHL, trải nghiệm nên được thiết kế lại quanh 5 trụ cột.

---

## 1. Từ Dashboard Sang “AI Operations Cockpit”

- Dashboard phải trở thành nơi ra quyết định trong 5 giây.
- Gom các cảnh báo vào một "Today's Focus" list có actions: `[Xem lý do] [Gọi tài xế] [Chạy lại VRP] [Giao cho điều phối] [Bỏ qua]`.

---

## 2. Thiết Kế Theo “Intent”, Không Theo Module

- Người dùng ra lệnh theo mục tiêu (intent), không phải mò menu.
- Thêm Command Palette / AI Search (Cmd+K) với intents như: `Tạo đơn cho NPP HD-53`, `Chạy lại VRP cho Hải Dương`, `Tại sao kho Hạ Long thiếu?`.

---

## 3. AI Copilot Theo Vai Trò

- Tạo copilot riêng cho mỗi vai trò (DVKH, Dispatcher, Warehouse, Accountant, Management).
- Copilot đưa phán đoán có ngữ cảnh và actionable recommendation.

Ví dụ (DVKH):

> “NPP HD-53 thường đặt 340 vỉ/tuần. Hôm nay chỉ đặt 180 vỉ, thấp hơn 47%. Đề xuất gọi chăm sóc trước khi xác nhận đơn.”

---

## 4. Tự Động Hóa Nhưng Có Human-in-the-loop

- Phân cấp tự động: Auto (low-risk), Recommend (medium), Approve (high-impact), Block (hard rules).
- AI chỉ đề xuất; người dùng duyệt ở điểm rủi ro cao; mọi quyết định có audit + undo.

---

## 5. Trải Nghiệm Phải Dự Báo Trước, Không Chỉ Phản Ứng

- Chuyển từ “Xe đang trễ” sang “Xe này có 78% khả năng trễ nếu giữ thứ tự hiện tại”.
- Stock prediction: “Kho Hạ Long sẽ thiếu 280 keg vào sáng mai nếu không chuyển từ Đông Mai trước 16:00.”

---

## Đề Xuất UX World-class Cho BHL

Thiết kế lại experience thành 6 lớp:

1. **AI Inbox** — thay notification/toast bằng inbox caseable action.
2. **Universal Timeline** — timeline duy nhất cho order/trip/NPP, cross-role.
3. **AI Command Center** — ô tìm/lệnh toàn hệ thống (intent-first).
4. **Simulation Before Action** — show trade-offs trước khi apply.
5. **Explainability Bắt Buộc** — nút “Vì sao?” cho mọi gợi ý AI.
6. **AI Feedback Loop** — user feedback để retrain.

---

## Thiết Kế Hạ Tầng Với Mac mini M1 16GB

- Mac mini M1 16GB đủ cho MVP nội bộ nếu tối giản: backend, Postgres, Redis, VRP service chạy local.
- Không chạy nhiều container nặng cùng lúc; ưu tiên dùng hosted LLM (Gemini free tier + Groq fallback) để tránh tiêu thụ GPU/RAM local.

**Kiến trúc gợi ý:**
- Web app / backend: Mac mini
- PostgreSQL + pgvector (optional): Mac mini
- Redis (queue, WS): Mac mini
- VRP (OR-Tools): Mac mini
- LLMs: Gemini/Groq APIs (hosted)

---

## AI Stack Đề Xuất (MVP thực dụng)

- LLM: Gemini free tier (primary), Groq (fallback)
- Embeddings: `text-embedding` nhỏ hoặc `sentence-transformers` nếu cần local
- Vector DB: `pgvector` (Postgres) để tránh infra thêm
- Queue: Redis
- Rule engine: backend (business rules critical)

Nguyên tắc: LLM chỉ tóm tắt, giải thích, đề xuất; business rules vẫn do code xử lý.

---

## Roadmap Ngắn Hạn (Sprint Plan)

- Sprint 1 (P0): AI Inbox, Today's Focus, Command Palette, Explainability component.
- Sprint 2 (P1): Role Copilots (DVKH, Dispatcher, Warehouse, Accountant).
- Sprint 3 (P1): Predictive ops (dự báo nhu cầu, trip delay, stock shortage).
- Sprint 4 (P2): Automation with approval (draft plans, draft messages, draft transfers).

---

## Tiêu Chuẩn "World-class" — Checklist 7 câu

1. Mở màn hình có việc quan trọng nhất không?
2. Hệ thống đề xuất hành động tiếp theo không?
3. AI giải thích vì sao không?
4. Duyệt/sửa/từ chối trong ít thao tác không?
5. Có undo hoặc audit trail không?
6. Có đo feedback để cải thiện AI không?
7. UX có giảm cognitive load không?

Nếu chưa đáp ứng, chưa world-class.

---

## Kết Luận

- Hướng đúng: thiết kế lại trải nghiệm thành **AI-assisted operations system** — Inbox + Command Center + Role Copilot + Simulation + Explainability + Audit.  
- Với Mac mini M1 16GB: làm MVP rất khả thi nếu tối ưu infra và dùng LLM hosted.  

Nếu anh muốn, tôi có thể:
- Sinh ngay một README + prototype UI wireframe (Markdown) hoặc
- Tạo một repository mẫu (backend + frontend minimal) để demo Inbox + Command Palette + Copilot flow.

Chọn 1 trong 2 để tôi triển khai tiếp.
