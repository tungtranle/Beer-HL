# ROADMAP — BHL OMS-TMS-WMS Ecosystem

> **Mục đích:** Kế hoạch phát triển ngoài Core (BRD v3.0). Bao gồm 20 Ecosystem components, đánh giá tính thực tế cho BHL, phân phase triển khai, và chi phí ước tính.
>
> **Nguồn gốc:** Trích từ BRD v4.0 (sections 14-18). Nội dung này mang tính How/When — chỉ để tham khảo, không phải business requirement.
>
> **Cập nhật:** Session 18 — 20/03/2026 · **World-Class Strategy Sprint 0 — 23/04/2026** (EC-12 reclassified C→A, see DEC-WC-01) · **AI Intelligence Sprint 2 — 24/04/2026** (EC-19 reclassified C→A, EC-21 mới, DEC-AI-01)

---

## 1. ĐÁNH GIÁ 20 ECOSYSTEM COMPONENTS

> **Nguyên tắc:** BHL quy mô 80 users nội bộ, 2 kho, ~1000 đơn/ngày, 70 xe. Nhiều component trong danh sách dưới đây là **overengineering** cho quy mô này. Chỉ 6/20 thực sự cần thiết trong 12 tháng đầu.

### Nhóm A — Thực tế, nên làm (6 components)

| ID | Tên | Mô tả | Effort | BHL Rating | Ghi chú |
|----|-----|-------|--------|------------|---------|
| EC-01 | Disaster Recovery | Patroni PostgreSQL HA + pgBackRest PITR. RPO ≤ 5 phút, RTO ≤ 15 phút | 1W | ★★★★★ | **Bắt buộc** trước go-live. Data loss = thảm họa |
| EC-02 | Observability | Grafana + Prometheus + Loki. Dashboards Ops/Dev. Alerts Zalo | 1W | ★★★★★ | **Bắt buộc**. Không có monitoring = mù vận hành |
| EC-03 | Security Layer | MFA (TOTP) cho admin/KT. Immutable audit log. Session management | 1W | ★★★★☆ | **Cần thiết** cho compliance. Có thể đơn giản hóa (tự build MFA thay Authelia) |
| EC-05 | Load Testing | k6 scripts: stress test VRP, GPS WS 70 conn, payment batch | 1W | ★★★★☆ | **Nên có** trước go-live. Test cao điểm Tết/Hè |
| EC-06 | Data Privacy NĐ13 | GPS tài xế = dữ liệu cá nhân. Consent flow. Retention cron | 1W | ★★★☆☆ | **Nên có** cho pháp lý. Có thể phát triển dần |
| EC-13 | Fleet Management | Fuel log, cost per trip, maintenance schedule | 3W | ★★★★☆ | **Giá trị cao** cho BHL. Us-NEW-11 đã có entity_events |
| EC-12 | Demand Forecasting (BHL-tuned) | Prophet + Croston cho 21 SKUs (forecastable) + 8 Tết SKUs. Hierarchical warehouse→NPP. **Reclassified C→A on 23/04/2026** | 3W | ★★★★☆ | **Re-evaluation:** dữ liệu enriched 5 năm LENH chứng minh 21 SKU đủ data (≥100 active days) cho Prophet. Xem `docs/specs/WORLDCLASS_EXECUTION_PLAN.md` Sprint 2 |
| EC-19 | AI Intelligence Layer (BHL-tuned) | **Reclassified C→A on 24/04/2026.** Smart Rules scoring + Gemini free API generative text + Python :8090 ML extension. Không cần infra mới. Xem DEC-AI-01. | 3W | ★★★★★ | **Zero infra, $0/tháng.** 3 phases: Rules (AI-R), Gemini (AI-G), ML (AI-M). 11 tasks Sprint 2. |

### Nhóm B — Có giá trị nhưng chưa cần ngay (8 components)

| ID | Tên | Lý do hoãn |
|----|-----|-----------|
| EC-04 | API Gateway (Kong) | BHL 80 users, chưa cần rate limiting phức tạp. Gin middleware đủ dùng |
| EC-07 | Universal Search | Tốt nhưng PostgreSQL full-text search + ILIKE đủ cho ~300 NPP |
| EC-08 | Document Mgmt | ePOD photos lưu local/S3 đủ. Paperless-ngx là nice-to-have |
| EC-09 | MDM Lifecycle | NPP state machine đơn giản, tự code nhanh hơn deploy DataHub |
| EC-10 | Feature Flags | **Reclassified for AI scope on 26/04/2026.** Không cần flag toàn hệ thống, nhưng AI Toggle là bắt buộc để đảm bảo AI OFF không phá baseline UX. Xem DEC-AI-02. |
| EC-11 | BI Platform | ClickHouse + Superset quá nặng. PostgreSQL materialized views + KPI dashboard hiện tại đủ |
| EC-14 | ML ETA Prediction | Cần 6+ tháng data lịch sử. OSRM distance-based ETA đang dùng tốt |
| EC-15 | Event Streaming | Redpanda cho 1000 đơn/ngày là overkill. PostgreSQL LISTEN/NOTIFY + Redis pub/sub đủ |

### Nhóm C — Không phù hợp BHL hiện tại (4 components)

> ~~EC-12 Demand Forecasting~~ — **moved to Nhóm A on 23/04/2026** sau khi enriched data 5 năm LENH chứng minh 21 SKU forecastable. Xem DEC-WC-01.  
> ~~EC-19 AI Anomaly/Intelligence~~ — **moved to Nhóm A on 24/04/2026** với approach mới: Smart Rules + free API thay LLM on-premise. Xem DEC-AI-01.

| ID | Tên | Lý do không phù hợp |
|----|-----|---------------------|
| EC-16 | Config & Rules Engine | Camunda 8 BPMN cho 4 approval flows = búa tạ đập muỗi |
| EC-17 | NPP Self-Service Portal | 300 NPP tương lai, Zalo OA link đủ cho xác nhận. Portal riêng = project mới |
| EC-18 | Power UX Features | Dark mode, drag-drop board. Nice-to-have sau khi core ổn định |
| EC-20 | AI On-Premise LLM | LLaMA/Ollama on-premise yêu cầu VPS ≥16GB RAM. Thay bằng EC-19/EC-21 với free-tier API |

**EC-21 (Mới — 24/04/2026): AI Generative Features — Gemini free tier**

| Feature | Approach | Quota cần | Cost |
|---------|---------|-----------|------|
| Daily Dispatch Briefing | Gemini 2.0 Flash free | 1 req/ngày | $0 |
| Exception Explanation | Gemini + context từ DB | ~10 req/ngày | $0 |
| NPP Zalo Auto-Draft | Gemini generate text | ~5 req/ngày | $0 |
| Demand Intelligence Panel | Prophet từ Python :8090 | 0 API calls | $0 |
| **Tổng** | | ~50 req/ngày vs 1,500 free | **$0/tháng** |

---

## 2. PHASE PLAN

| Phase | Thời gian | Mục tiêu | Components |
|-------|-----------|----------|------------|
| **Core** | Hiện tại | OMS + TMS + WMS + Đối soát (BRD v3.0) | 50+ User Stories | ✅ Đang phát triển |
| **P0** | Tuần 0–4 pre go-live | Nền tảng an toàn bắt buộc | EC-01, EC-02, EC-03, EC-05, EC-06 |
| **P1** | Tháng 1–3 | Fleet + Search cơ bản + **World-Class S1 Quick Wins** | EC-13, EC-07 (simplified), F2/F3/F7 + H2/H4 (xem WORLDCLASS_EXECUTION_PLAN) |
| **P1.5** | 24/04–20/05/2026 | **Sprint 2 AI Intelligence Layer** | EC-19 (reclassified), EC-21 mới: 11 tasks AI-R/G/M — xem TASK_TRACKER Sprint 2 |
| **P2** | Tháng 4–6 | **World-Class S2 Intelligence Core** | EC-12 (Prophet + Croston), F1/F4/F15 + H9 Feedback Loop |
| **P2.5** | Tháng 6–9 | **World-Class S3 Customer-Centric Polish** + BI | F5/F6/F10/F13/F14, EC-11 (Metabase) |
| **P3** | Năm 2+ | AI/ML nâng cao + NPP Portal | EC-14, EC-17, F8 NPP Portal, F11 AI Copilot nâng cấp (Claude API khi có revenue) |

### P0 — Bắt buộc trước Go-live (4 tuần)

| Tuần | Task | Owner | Deliverable |
|------|------|-------|-------------|
| W1–2 | EC-02 Observability | DevOps | Grafana dashboards + Prometheus metrics + Loki logs |
| W2–3 | EC-01 DR | DevOps | Patroni HA + pgBackRest + failover runbook |
| W2–3 | EC-03 Security | Backend | MFA cho admin/KT + immutable audit trigger |
| W3–4 | EC-05 Load Test | QA | k6 scripts: VRP stress, GPS WS 70 conn, Tết simulation |
| W3–4 | EC-06 Privacy | Backend | Consent flow + retention cron (GPS 2yr, ePOD 3yr) |

### P1 — Tháng 1–3

| Tháng | Task | Owner | Deliverable |
|-------|------|-------|-------------|
| M1 | EC-13 Fleet: Fuel log + maintenance | Backend | Fuel log screens, cost per trip report |
| M2 | EC-07 Search (simplified) | Full-stack | PostgreSQL FTS + search bar (không cần Meilisearch) |

---

## 3. CHI PHÍ ƯỚC TÍNH

| Hạng mục | /tháng | /năm | Ghi chú |
|----------|--------|------|---------|
| Infrastructure (VPS/Cloud) | $200–400 | $2,400–4,800 | Tùy nhà cung cấp |
| OSS License | $0 | $0 | Toàn bộ self-hosted OSS |
| OBD2 dongles 70 xe (one-time) | — | ~$1,400–3,500 | $20–50/xe, cho Fleet Phase P1 |
| **TỔNG** | **$200–400/tháng** | **$2,400–4,800/năm** | Chưa tính hardware |

> So sánh: Enterprise SaaS (Samsara + Tableau + Blue Yonder) = $80,000–150,000/năm. OSS tiết kiệm ~97%.

---

## 4. TECH STACK BỔ SUNG (khi cần)

> Danh sách tool **tham khảo** — chỉ deploy khi thực sự cần, không deploy "vì có trong danh sách".

| Nhóm | Tool | Mục đích | License | Khi nào cần |
|------|------|---------|---------|------------|
| HA Database | Patroni + pgBackRest | PostgreSQL HA + PITR | MIT | P0 — trước go-live |
| Observability | Grafana + Prometheus + Loki | Metrics, logs, dashboards | AGPL (OSS free) | P0 — trước go-live |
| Auth MFA | Authelia hoặc tự build | 2FA/TOTP | Apache 2.0 | P0 — trước go-live |
| Load Testing | k6 | Performance test CI/CD | AGPL | P0 — trước go-live |
| Fleet GPS | Traccar | Fleet tracking, OBD2 | Apache 2.0 | P1 — tháng 1–3 |
| Search | PostgreSQL FTS | Full-text search | Built-in | P1 — tháng 1–3 |
| OLAP (simplified) | PostgreSQL materialized views | Analytics views | Built-in | P2 — nếu cần |
| BI | Metabase hoặc Superset | Self-serve analytics | AGPL | P2 — nếu cần |
| **AI Generative (free)** | Gemini 2.0 Flash API | Dispatch brief, exception explain, Zalo draft | Free 1,500/ngày | **P1.5 — Sprint 2 AI** |
| **AI Fallback (free)** | Groq API (Llama/Qwen) | Fallback khi Gemini quota hết | Free 14,400/ngày | **P1.5 — Sprint 2 AI** |
| **AI Rules Engine** | Go internal/ai/ package | Scoring formulas: anomaly, credit risk, seasonal | Built-in | **P1.5 — Sprint 2 AI** |
| **ML Forecast** | Prophet + sklearn trong Python :8090 | Demand forecast, NPP churn | OSS | P1.5/P2 — extend hiện có |

---

## 5. UAT ECOSYSTEM (tham khảo từ v4.0)

> Các UAT test case cho Ecosystem components. Chỉ applicable khi component tương ứng được deploy.

| # | Tiêu chí | EC liên quan |
|---|----------|-------------|
| 13 | Failover PostgreSQL: RTO ≤ 15 phút, RPO ≤ 5 phút, application tự reconnect | EC-01 |
| 14 | Grafana dashboard phản ánh real-time (< 30s delay). Alert gửi được qua Zalo/SMS | EC-02 |
| 15 | MFA bắt buộc cho admin/KT. Immutable audit log không DELETE/UPDATE được | EC-03 |
| 16 | Load test 3x traffic peak (3000 đơn/ngày) không service degradation | EC-05 |
| 17 | GPS data auto-purge sau retention period. Consent form bắt buộc khi onboard tài xế | EC-06 |
| 18 | Fuel log ghi nhận theo chuyến, cross-check GPS odometer, biên bản sai lệch > 20% | EC-13 |
| 19 | Search trả kết quả < 200ms cho SO number, NPP name, biển số | EC-07 |

---

*Tạo mới: Session 18, 20/03/2026 — Trích từ BRD v4.0 gap analysis.*
