# BHL OMS-TMS-WMS — Phản biện AI-native UX và Blueprint Vibe Coding One-shot

**Ngày:** 27/04/2026  
**Người viết:** GitHub Copilot — vai trò phản biện UX/UI + vibe coding  
**Phạm vi đọc:** BRD v3.8, Design System BHL v1.0, `BHL_AI_Native_UX_Analysis.md`, `BHL_AI_Native_UX_Per_Role_Spec_v1.md`, `AI_UX_WorldClass_Proposal.md`, `AI_UX_WorldClass_v2.md`, và code hiện trạng trong `D:\Beer HL\bhl-oms`.

---

## 1. Kết luận điều hành

Ý kiến của chuyên gia trong hai file AI-native UX là **đúng hướng ở tầng triết lý**: BHL không nên có AI như một khu riêng tách khỏi nghiệp vụ; AI phải xuất hiện ngay tại điểm ra quyết định, có confidence, có giải thích, có human-in-the-loop, và có voice/camera cho nhóm thực địa.

Tuy nhiên, nếu đưa nguyên văn hai file đó vào vibe coding one-shot thì có 5 rủi ro lớn:

1. **Quá rộng cho one-shot:** cố triển khai cả 9 role, 20+ touchpoint, voice, vision, adaptive UI, command palette, approval queue, WMS prediction cùng lúc sẽ tạo nhiều UI nửa vời.
2. **Nhầm giữa “AI-native” và “AI luôn hiện”:** với hệ vận hành bia, AI-native vẫn phải progressive enhancement; AI OFF không phải điểm yếu mà là điều kiện an toàn bắt buộc.
3. **Có nguy cơ widget creep:** thêm nhiều strip/card/panel AI vào mọi màn hình có thể làm người dùng phải đọc nhiều hơn, trái mục tiêu giảm cognitive load.
4. **Confidence UX đang đơn giản hóa quá mức:** một con số % không đủ. BHL cần phân biệt confidence theo dữ liệu, độ mới, số mẫu, rule/ML/LLM, và mức rủi ro nghiệp vụ.
5. **Không bám đủ vào code hiện trạng:** repo đã có AI Inbox, ExplainabilityPopover, DispatchBriefCard, SimulationCard, CommandPalette, AI flags và endpoint backend. Vibe coding đúng phải nâng cấp/hợp nhất, không tạo song song component mới gây trùng lặp.

Đề xuất của tôi: **không làm “AI layer cho toàn hệ thống” trong one-shot. Hãy làm “Decision Intelligence Layer” cho 5 workflow vàng**:

- OMS tạo đơn: NPP risk + ATP/demand context.
- Approval queue: AI-ranked nhưng vẫn hard-gate theo R15.
- Planning/VRP: solver result explainer + simulation/diff trước khi duyệt.
- Control Tower: anomaly triage + ETA uncertainty.
- Driver PWA: voice assist an toàn, không auto-submit.

Nếu 5 workflow này đạt chất lượng cao, BHL sẽ có cảm giác world-class thật. Các role còn lại có thể nhân pattern sau.

---

## 2. Hiện trạng code đã có gì

Qua đọc repo `D:\Beer HL\bhl-oms`, BHL không phải bắt đầu từ số 0.

### 2.1 Frontend hiện có

- Next.js 14 + Tailwind + TypeScript + Lucide React trong `web`.
- Routes chính đã có:
  - `/dashboard/orders/new`
  - `/dashboard/planning`
  - `/dashboard/control-tower`
  - `/dashboard/approvals`
  - `/dashboard/driver`
  - `/dashboard/pda-scanner`
  - `/dashboard/warehouse/*`
  - `/dashboard/ai/simulations`
  - `/dashboard/ai/transparency`
  - `/dashboard/settings/ai`
- AI components đã có:
  - `AIInboxPanel`
  - `AIStatusBadge`
  - `ApprovalCard`
  - `CreditRiskChip`
  - `DemandIntelligencePanel`
  - `DispatchBriefCard`
  - `ExplainabilityPopover`
  - `OutreachQueueWidget`
  - `SeasonalDemandAlert`
  - `SimulationCard`
  - `UndoBanner`
- Global command palette đã có `CommandPalette` và đã gọi `/ai/intents` khi bật `ai.intent`.

### 2.2 Backend hiện có

AI flags trong code backend gồm:

- `ai.master`
- `ai.copilot`
- `ai.briefing`
- `ai.voice`
- `ai.camera`
- `ai.simulation`
- `ai.intent`
- `ai.automation.t3`
- `ai.automation.t2`
- `ai.gps_anomaly`
- `ai.forecast`
- `ai.credit_score`
- `ai.adaptive_ui`
- `ai.transparency`
- `ai.trust_loop`
- `ai.explainability`
- `ai.feedback`

Endpoint backend đã có hoặc đã được khai báo:

- `GET /v1/ai/dispatch-brief`
- `GET /v1/ai/customers/:id/risk-score`
- `POST /v1/ai/simulations`
- `GET /v1/ai/simulations/:id`
- `POST /v1/ai/simulations/:id/apply`
- `GET /v1/ai/inbox`
- `PATCH /v1/ai/inbox/:id/action`
- `POST /v1/ml/feedback`

### 2.3 Hàm ý thiết kế

Vì code đã có nền, tài liệu one-shot không nên yêu cầu “tạo mới toàn bộ AIContext/Inbox/Simulation/Explainability”. Cách đúng là:

- Chuẩn hóa visual language cho component AI hiện có.
- Thêm các component thiếu thật sự: `AIContextStrip`, `ConfidenceMeter`, `AIReasoningDrawer` nếu `ExplainabilityPopover` chưa đủ.
- Hợp nhất feedback endpoint, không để `ml/feedback` và `ai/feedback` rời nhau mãi.
- Chỉnh flag name trong spec theo code thật: dùng `ai.credit_score`, không dùng `ai.credit_risk` nếu backend chưa có alias.
- Chỉnh cách dùng hook: `useAIFeature()` hiện trả `{ enabled, loading, error }`, không phải boolean.

---

## 3. Những điểm tôi đồng ý với chuyên gia

### 3.1 Chẩn đoán “AI Isolation” là đúng

BHL đã có các route như `/dashboard/ai/simulations`, `/dashboard/ai/transparency`, `/dashboard/anomalies`. Các route này cần tồn tại cho admin, audit, governance. Nhưng với user vận hành, insight quan trọng không nên bị nhốt ở đó.

Credit risk phải nằm trong form tạo đơn và approval queue. VRP insight phải nằm ngay sau solver. GPS anomaly phải nằm trên Control Tower. Forecast phải nằm cạnh ATP/product selection.

### 3.2 AI Communication Design là thiếu thật

Hiện `DispatchBriefCard` dùng tông sky, `AIInboxPanel` dùng brand icon, `ExplainabilityPopover` dùng modal trắng/slate, `SimulationCard` dùng brand-50. Từng component ổn riêng lẻ, nhưng chưa tạo thành một ngôn ngữ AI nhất quán.

Cần chuẩn hóa:

- AI output khác dữ liệu thực.
- Suggestion khác hard business rule.
- Warning do rule khác inference do ML.
- AI action khác navigation thông thường.

### 3.3 Trust Loop là yêu cầu bắt buộc

BRD có các rule cứng như R01, R02, R15, R16, R17, R18. Vì vậy mọi action có tác động vận hành phải có:

- lý do,
- người duyệt,
- thời điểm,
- trạng thái trước/sau,
- override reason nếu bác AI,
- audit trail.

### 3.4 Voice cho tài xế là đúng hướng

Driver PWA là nơi AI có ROI rất cao vì tài xế thao tác trong môi trường di chuyển, ồn, một tay, màn nhỏ. Voice assist cho các intent như “giao thất bại”, “chỉ đường”, “gọi khách”, “trạng thái hiện tại” là hợp lý.

### 3.5 Simulation before action là điểm nên giữ

BHL có VRP, cost engine, credit override, stock transfer. Đây là domain rất hợp với “what-if simulation”. Trước khi bấm duyệt, user cần thấy trade-off: số xe, chi phí, OTD, rủi ro trễ, shipment không xếp được.

---

## 4. Phản biện các điểm cần chỉnh

### 4.1 “Feature flags OFF by default” không phải anti-pattern

Chuyên gia viết rằng feature flags OFF by default làm AI bị động. Tôi không đồng ý nếu áp dụng thẳng cho BHL.

Với hệ thống vận hành có tài chính, kho, tài xế, đối soát, AI OFF là **cơ chế an toàn**, không phải biểu hiện thiếu AI-native. World-class trong BHL phải là:

- Core UX chạy hoàn chỉnh khi AI OFF.
- AI ON tăng tốc ra quyết định.
- AI lỗi thì biến mất hoặc fallback rule-based.
- Admin có quyền bật theo role/user/feature.

Tức là AI-native không đồng nghĩa AI always-on. AI-native nghĩa là kiến trúc và UX được thiết kế để AI xuất hiện đúng ngữ cảnh khi được phép.

### 4.2 “Không có trang AI” là tuyên bố quá tuyệt đối

Tôi đồng ý không nên bắt user vận hành đi vào trang AI để xem insight. Nhưng BHL vẫn cần các trang AI riêng cho:

- AI Settings.
- Transparency Center.
- Simulation Lab.
- Audit/Feedback review.
- Admin trust-loop promotion.

Nguyên tắc nên là:

- **Decision insight:** inline trong workflow.
- **Governance insight:** nằm ở trang AI riêng.
- **Exploration/simulation nâng cao:** có thể nằm ở trang AI riêng, nhưng kết quả quan trọng phải quay lại workflow.

### 4.3 Dùng quá nhiều strip AI sẽ tăng cognitive load

Tài liệu role spec đề xuất nhiều `AIContextStrip` trong form, bảng, toast, queue. Nếu triển khai dày đặc, user sẽ thấy màn hình “đầy lời khuyên”. Điều này nguy hiểm trong vận hành vì user cần scan nhanh.

Cần áp dụng **attention budget**:

- Mỗi màn hình chỉ có 1 AI surface chính ở trạng thái expanded.
- Insight P2/P3 chỉ hiện chip nhỏ hoặc trong drawer.
- AI chỉ interrupt khi có action cụ thể hoặc rủi ro vượt ngưỡng.
- Dismiss phải nhớ theo entity/session, không chỉ ẩn tạm.

### 4.4 Confidence % không đủ để tạo trust

Một số đề xuất chỉ nói “confidence 87%”. Với user vận hành, câu hỏi thật là: “tin vì dữ liệu gì?”.

BHL nên thay một confidence đơn bằng **Trust Badge đa yếu tố**:

- `confidence`: độ tự tin model/rule.
- `data_freshness`: dữ liệu mới đến đâu.
- `sample_size`: số đơn/chuyến/lịch sử được dùng.
- `source`: rules, Prophet, IsolationForest, Gemini, Groq.
- `impact_level`: read-only, draft, operational write, financial write.

Ví dụ hiển thị:

> Tin cậy 82% · 43 đơn lịch sử · dữ liệu cập nhật 07:10 · nguồn: rules + forecast

### 4.5 Adaptive UI không nên tự đảo layout dashboard

Tài liệu đề xuất dashboard tile tự sắp xếp theo hành vi. Với BHL, người dùng vận hành cần muscle memory. Tự đổi layout có thể làm dispatcher/kế toán mất nhịp.

Đề xuất chỉnh:

- Không tự reorder layout mặc định.
- Chỉ gợi ý shortcut cá nhân hóa ở vùng phụ.
- Cho user pin/unpin thủ công.
- Adaptive chỉ ưu tiên alert trong inbox, không đổi vị trí KPI cốt lõi.

### 4.6 Voice command không được auto-execute write action

Tài liệu voice-first đúng hướng nhưng cần safety guard rõ hơn:

- Voice chỉ mở flow hoặc prefill.
- Write action như giao thất bại, đã giao, sự cố xe phải có xác nhận visual/tap.
- Timeout không xác nhận thì auto-cancel.
- Không dùng wake word trong MVP vì dễ nhận nhầm và tốn pin.
- Không phụ thuộc Web Speech API cho toàn bộ Android fleet nếu chưa UAT tiếng Việt/noise.

### 4.7 Camera AI không được thay checklist pháp lý

Đề xuất “quay xe 30 giây thay checklist tay” là hấp dẫn nhưng rủi ro. Checklist đầu/cuối ca có giá trị kiểm soát nội bộ và trách nhiệm. Vision AI nên hỗ trợ, không thay thế.

MVP đúng:

- Tài xế vẫn tick checklist.
- Camera/OCR/vision chỉ phát hiện bất thường và gợi ý.
- AI prefill nhưng tài xế xác nhận cuối cùng.
- Ảnh là bằng chứng, không phải quyết định tự động.

### 4.8 AI-ranked Approval Queue dễ tạo automation bias

Kế toán có thể tin chip “AI có thể duyệt nhanh” và bỏ qua rủi ro. Với R15, hệ thống phải hard-gate:

- NPP không có hạn mức: không check hạn mức.
- NPP có hạn mức và vượt: phải chờ kế toán duyệt.
- AI không được tự approve đơn vượt hạn mức.
- Bulk approve chỉ cho nhóm thật sự low-risk và vẫn cần confirm.
- Row phải hiển thị yếu tố rủi ro, không chỉ điểm tổng.

### 4.9 Command Palette phải registry-driven, không free-form

Tôi đồng ý với Intent Layer trong v2, nhưng cần nhấn mạnh: không để LLM tự quyết action. Với BHL, intent phải whitelist:

- navigate,
- query read-only,
- create draft,
- simulate,
- explain.

Không cho free-form write trực tiếp vào nghiệp vụ.

### 4.10 Spec hiện tại có mismatch với code

Một số điểm cần chỉnh trước khi đưa vào one-shot:

- Spec dùng `ai.credit_risk`, code dùng `ai.credit_score`.
- Spec nói `useAIFeature()` trả boolean, code trả object `{ enabled, loading, error }`.
- Spec yêu cầu tạo `ExplainabilityPopover`/`SimulationCard`, code đã có.
- Spec đề xuất `POST /v1/ai/feedback`, code hiện có `POST /v1/ml/feedback` và các endpoint AI khác; cần unify hoặc adapter.
- Spec nói tạo trang AI Settings, code đã có `/dashboard/settings/ai`.
- Spec nói tạo AI Simulation, code đã có `/dashboard/ai/simulations` và backend simulation snapshot.

---

## 5. Bổ sung quan trọng: Decision Intelligence Layer

Tôi đề xuất đổi tên tư duy từ “AI-native UX layer” sang **Decision Intelligence Layer**.

Lý do: user BHL không mua “AI”. Họ cần ra quyết định nhanh và đúng:

- Có nhận đơn này không?
- Có duyệt vượt hạn mức không?
- Có duyệt kế hoạch VRP không?
- Có đổi tuyến không?
- Có cho xe xuất cổng không?
- Có chấp nhận đối soát không?

Decision Intelligence Layer gồm 6 phần.

### 5.1 Signal

Thu thập tín hiệu từ dữ liệu thật:

- order status,
- ATP,
- AR aging,
- credit limit,
- shipment/trip,
- GPS,
- driver history,
- SKU velocity,
- stock/bin state,
- reconciliation discrepancy.

### 5.2 Sensemaking

Chuyển tín hiệu thành ý nghĩa:

- “NPP này vượt hạn mức 8% nhưng 90 ngày qua trả đúng hạn.”
- “Xe HD-007 tải 98%, vẫn hợp lệ nhưng rủi ro bốc dỡ cao.”
- “Nếu giữ thứ tự giao này, stop 4 có khả năng trễ 18 phút.”

### 5.3 Recommendation

Đề xuất hành động cụ thể:

- Duyệt / từ chối / yêu cầu gọi lại NPP.
- Tách shipment khỏi trip.
- Chạy lại VRP với objective khác.
- Gửi Zalo nhắc xác nhận.
- Mở case đối soát.

### 5.4 Simulation

Trước hành động lớn, hiển thị trade-off:

- phương án hiện tại,
- phương án đề xuất,
- chi phí,
- OTD,
- rủi ro,
- tác động đến NPP/trip/kho.

### 5.5 Trust

Mọi suggestion có:

- nguồn,
- confidence,
- yếu tố ảnh hưởng,
- dữ liệu dùng,
- last updated,
- “Vì sao?”,
- feedback.

### 5.6 Accountability

Mọi action có:

- user,
- timestamp,
- before/after,
- reason,
- AI suggestion id,
- override reason,
- audit log.

---

## 6. Đề xuất one-shot đã chỉnh scope

### 6.1 Không làm trong one-shot

Không nên đưa các mục này vào one-shot đầu:

- Adaptive UI tự reorder dashboard.
- Vision AI cho toàn bộ PDA/vehicle inspection.
- Trust escalator promote/demote automation.
- AI learning/retraining thật.
- Copilot chat generic cho mọi role.
- Auto-approve nghiệp vụ tài chính.
- Wake word voice.
- AI quyết định HR/lương/blacklist/NPP.

### 6.2 Làm trong one-shot

One-shot nên tập trung vào 5 workflow vàng.

#### Workflow 1 — OMS Create Order Intelligence

Mục tiêu: DVKH nhập đơn nhanh hơn nhưng không bỏ sót risk.

Cần làm:

- Dưới customer selector trong `/dashboard/orders/new`, hiển thị risk/context strip nếu `ai.credit_score` ON.
- Dùng endpoint `GET /v1/ai/customers/:id/risk-score`.
- Thêm cache 5 phút trên frontend.
- Strip chỉ hiện khi có risk hoặc insight đáng nói; không spam nếu mọi thứ bình thường.
- Drawer “Vì sao?” hiển thị factors: công nợ, hạn mức, lịch sử trả, đơn bất thường, data freshness.
- Trong product row, nếu `ai.forecast` ON, thêm demand/ATP warning dạng chip nhỏ.

#### Workflow 2 — Approval Queue Intelligence

Mục tiêu: kế toán duyệt nhanh hơn nhưng không bị AI bias.

Cần làm:

- Thêm mode/tab “Ưu tiên xử lý” trong `/dashboard/approvals`.
- Không đổi business rule R15.
- Sort theo: SLA urgency, over-limit ratio, payment behavior, order value, data freshness.
- Row có `CreditRiskChip` + reason drawer.
- Bulk action chỉ cho nhóm low-risk và vẫn mở confirm.
- Override reason bắt buộc khi bác AI ở high-risk case.

#### Workflow 3 — VRP Result Explainer + Simulation

Mục tiêu: dispatcher hiểu kế hoạch VRP trong 30 giây.

Cần làm:

- Sau khi solver xong trong `/dashboard/planning`, hiển thị panel “Điểm cần xem trước khi duyệt”.
- Build highlights từ result hiện có, không nhất thiết gọi LLM:
  - xe >90% tải,
  - unassigned shipment,
  - route cost cao,
  - OTD risk,
  - toll/fuel outlier,
  - vehicle/driver missing.
- Dùng/extend `SimulationCard` hiện có cho “what-if”: thêm 1 xe, đổi objective, tách overload trip.
- Không tự duyệt kế hoạch. AI chỉ giúp review.

#### Workflow 4 — Control Tower Anomaly Triage

Mục tiêu: dispatcher biết xe nào cần xử lý trước.

Cần làm:

- Trên `/dashboard/control-tower`, tính anomaly score rule-based nếu `ai.gps_anomaly` ON.
- Marker pulse theo severity, nhưng không làm map nhiễu.
- Side panel gom anomalies cùng root cause nếu có.
- Nút “Phân tích” lazy-call endpoint explain anomaly.
- ETA hiển thị range: “14:32 ± 8 phút” khi đủ dữ liệu.

#### Workflow 5 — Driver Voice Assist Safe MVP

Mục tiêu: tài xế thao tác ít hơn, nhưng không auto-submit sai.

Cần làm:

- Tạo/extend `VoiceCommandFAB` chỉ khi `ai.voice` ON và browser support.
- Intent rule-based tiếng Việt:
  - giao thất bại,
  - chỉ đường,
  - gọi khách,
  - xe hỏng/sự cố,
  - trạng thái hiện tại,
  - đã giao.
- TTS đọc lại.
- Write action phải mở confirm dialog, không submit ngay.
- Timeout không xác nhận thì hủy.

---

## 7. Design rules cần thêm vào BHL Design System

### 7.1 AI surface hierarchy

Không phải AI nào cũng dùng card lớn.

| Loại AI | UI nên dùng | Khi nào |
|---|---|---|
| Passive hint | chip nhỏ | insight phụ, không cần action |
| Context warning | strip inline | có rủi ro vừa, cần user chú ý |
| Decision support | side panel/drawer | cần giải thích nhiều yếu tố |
| High-stakes action | confirmation flow | có tác động tài chính/vận hành |
| Governance | dedicated page | admin/audit/transparency |

### 7.2 Màu AI không được đồng nhất với warning

Brand orange `#F68634` nên là AI accent/dot, không biến mọi AI card thành warning. Nếu mọi AI đều cam, user sẽ bị mỏi cảnh báo.

Quy tắc:

- AI dot: brand orange.
- AI neutral insight: white/slate surface + AI dot.
- AI warning: amber/rose theo severity nghiệp vụ.
- AI success: emerald.
- AI info: sky.

### 7.3 Copy pattern

AI copy nên ngắn, hành động được, không khoe model.

Sai:

> AI đã phân tích dữ liệu và đưa ra đề xuất tối ưu.

Đúng:

> Xe 29H-12345 tải 96%. Vẫn hợp lệ, nhưng nếu thêm stop nữa sẽ vượt tải.

Sai:

> Confidence 87%.

Đúng:

> Tin cậy 87% · 42 chuyến tương tự · cập nhật 07:10.

### 7.4 Attention budget

- Mỗi page chỉ có tối đa 1 expanded AI card mặc định.
- Tối đa 3 AI chips visible trong một viewport bảng.
- P0/P1 mới được push/interruption.
- P2/P3 vào inbox hoặc drawer.

---

## 8. Vibe coding one-shot prompt đề xuất

Dùng prompt này thay cho spec gốc nếu muốn chạy one-shot có kiểm soát.

```md
Bạn là senior product engineer + world-class UX/UI designer. Hãy nâng cấp BHL OMS-TMS-WMS thành AI-native Decision Intelligence experience, nhưng bám chặt code hiện trạng. Không tạo lại các component đã có nếu có thể extend.

Repo: Go backend + Next.js 14 web trong `D:\Beer HL\bhl-oms`.
Frontend: `web/src`.
Design system: Tailwind, Lucide, BHL brand orange `#F68634`, UI vận hành dense/professional.

Nguyên tắc không thương lượng:
1. AI OFF thì baseline vẫn chạy 100%.
2. AI lỗi thì silent fail hoặc fallback rule-based.
3. AI không auto-execute action write/high-risk.
4. Mọi AI suggestion phải có nguồn, confidence/data freshness nếu có, và “Vì sao?”.
5. Không thêm AI widget dày đặc. Mỗi page chỉ có một AI surface chính expanded.
6. Reuse existing components: `AIInboxPanel`, `ExplainabilityPopover`, `DispatchBriefCard`, `SimulationCard`, `ApprovalCard`, `CreditRiskChip`, `CommandPalette`.
7. Flag name dùng theo backend thật: `ai.master`, `ai.credit_score`, `ai.forecast`, `ai.briefing`, `ai.gps_anomaly`, `ai.voice`, `ai.intent`, `ai.simulation`, `ai.explainability`, `ai.feedback`.
8. `useAIFeature(flag)` trả object `{ enabled, loading, error }`.

Scope one-shot: implement 5 golden workflows.

A. Foundation polish
- Tạo hoặc chuẩn hóa `web/src/styles/ai-tokens.css` và import vào global style nếu chưa có.
- Thêm AI token: dot, surface, confidence, pulse, shimmer.
- Nếu thiếu, tạo `AIContextStrip` và `ConfidenceMeter`; nếu đã có component tương tự thì extend.
- Extend `ExplainabilityPopover` để hỗ trợ factors có label/value/impact/source/computedAt/dataFreshness/sampleSize.
- Tạo `web/src/lib/ai-cache.ts` TTL cache nhỏ.
- Tạo `web/src/lib/ai-feedback.ts` fire-and-forget. Nếu backend chưa có `/ai/feedback`, adapter sang `/ml/feedback`.
- Không làm vỡ API hiện tại.

B. OMS create order intelligence
- File mục tiêu: route `/dashboard/orders/new`.
- Khi chọn customer, nếu `ai.credit_score` ON, gọi `GET /v1/ai/customers/:id/risk-score` bằng `aiCacheFetch` TTL 5 phút.
- Render `AIContextStrip` ngay dưới customer selector chỉ khi có insight đáng chú ý.
- Strip gồm message tiếng Việt ngắn, confidence/trust metadata, “Vì sao?”.
- “Vì sao?” mở explainability với factors: current debt, limit, overdue days, payment behavior, unusual order size, data freshness.
- Nếu API fail: không render.
- Nếu `ai.forecast` ON, thêm demand/ATP chip nhỏ trong product row; không làm bảng vỡ trên 1366px.

C. Approval queue intelligence
- File mục tiêu: `/dashboard/approvals`.
- Thêm view/tab “Ưu tiên xử lý”.
- Enrich row bằng risk score nếu có endpoint; cache batch hoặc per customer.
- Sort theo urgency + credit risk + order value + data freshness.
- Không tự approve đơn vượt hạn mức.
- Bulk approve chỉ cho group low-risk, vẫn cần confirm.
- Add reason drawer cho mỗi risk chip.
- Override high-risk suggestion phải yêu cầu reason.

D. Planning/VRP intelligence
- File mục tiêu: `/dashboard/planning`.
- Sau khi VRP solver có result, hiển thị panel “Điểm cần xem trước khi duyệt”.
- Build highlights rule-based từ result: overload >90%, unassigned shipments, cost outlier, toll/fuel high, route uncertainty, missing driver/vehicle.
- Reuse/extend `SimulationCard` cho what-if if `ai.simulation` ON.
- Simulation chỉ dry-run/snapshot; apply phải revalidate/confirm.
- Không thay đổi logic approve hiện tại ngoài UI support.

E. Control Tower anomaly triage
- File mục tiêu: `/dashboard/control-tower`.
- Nếu `ai.gps_anomaly` ON, tính anomaly score rule-based từ deviation, idle, ETA lateness, speed anomaly.
- Marker severity: normal no pulse, medium subtle pulse, high strong pulse.
- Side panel exception card có “Phân tích” lazy action.
- API fail dùng fallback text theo exception type.
- ETA nếu có đủ dữ liệu: hiển thị range `HH:mm ± N phút`.

F. Driver voice assist safe MVP
- File mục tiêu: driver PWA route `/dashboard/driver` hoặc trip detail route hiện có.
- Tạo/extend `VoiceCommandFAB` nếu chưa có.
- Render only khi `ai.voice` ON và SpeechRecognition available.
- Long press 500ms, lang `vi-VN`.
- Intent rule-based: giao thất bại, chỉ đường, gọi khách, sự cố xe, trạng thái hiện tại, đã giao.
- TTS đọc lại kết quả.
- Action write chỉ mở confirm dialog/pre-fill. Không auto-submit.
- Timeout confirm thì cancel.

G. Verification
- Chạy lint/typecheck/build frontend nếu khả thi.
- Kiểm tra AI OFF: các page vẫn render.
- Kiểm tra API AI fail: không crash.
- Kiểm tra desktop 1366px và mobile driver 390px.
- Không động vào Docker lifecycle command.
- Không refactor unrelated business logic.

Deliverable:
- Code changes focused.
- Update docs nếu cần.
- Final summary gồm files changed, test result, known limitations.
```

---

## 9. Acceptance criteria cho one-shot

### 9.1 UX acceptance

- DVKH nhìn thấy risk NPP trong lúc tạo đơn, không phải mở trang khác.
- Kế toán có hàng đợi ưu tiên nhưng vẫn thấy lý do và rule hard-gate.
- Dispatcher hiểu VRP result qua 3-5 điểm quan trọng, không phải đọc từng trip.
- Control Tower làm nổi bật xe cần xử lý trước, không làm map rối.
- Tài xế dùng voice để mở flow nhanh, nhưng mọi ghi nhận quan trọng vẫn cần xác nhận.

### 9.2 Safety acceptance

- AI OFF không làm mất tính năng nào.
- AI API fail không crash page.
- Không có AI action write nào auto-submit.
- Không có bulk approval cho case vượt hạn mức high-risk.
- Every AI suggestion high-impact có explainability.

### 9.3 Engineering acceptance

- Không duplicate component AI hiện có nếu extend được.
- Flag name khớp backend.
- Hook usage khớp `{ enabled, loading, error }`.
- Feedback fire-and-forget.
- Dismiss/personalization không đổi layout cốt lõi.

---

## 10. Roadmap sau one-shot

### Sprint tiếp theo 1 — Unify AI governance

- Hợp nhất `ml/feedback` và `ai/feedback`.
- Chuẩn hóa `ai_audit_log` cho all AI suggestions.
- Transparency Center hiển thị model/source/latency/error/feedback.

### Sprint tiếp theo 2 — Simulation deepening

- VRP what-if thật với OR-Tools dry-run.
- Credit override simulation.
- Stock transfer simulation.
- Re-route simulation.

### Sprint tiếp theo 3 — WMS/PDA vision

- OCR/vision chỉ prefill, không submit.
- Bin visual validation sau barcode scan.
- Damaged returns evidence assist.

### Sprint tiếp theo 4 — Intent execution

- Registry-driven intents.
- Disambiguation flow.
- Query read-only và create-draft.
- Không free-form production write.

### Sprint tiếp theo 5 — Trust loop

- Suggest promote/demote automation tier.
- Admin approval cho promotion.
- Rollback/demotion rule.
- Quarterly audit.

---

## 11. Điểm khác biệt so với hai file chuyên gia

| Chủ đề | File chuyên gia | Đề xuất chỉnh |
|---|---|---|
| AI-native | AI thấm vào mọi touchpoint | AI thấm vào điểm quyết định, có attention budget |
| AI pages | Không nên có trang AI | Có trang AI cho governance, inline cho decision |
| Feature flags | OFF by default là bị động | OFF là safety requirement |
| Confidence | Một score % | Trust metadata đa yếu tố |
| Adaptive UI | Tự reorder theo hành vi | Gợi ý/pin thủ công, không phá muscle memory |
| Voice | Voice-first | Voice-assist safe MVP, confirm mọi write action |
| Camera | Có thể thay checklist | Chỉ augment/prefill, không thay control pháp lý |
| One-shot | 9 role toàn diện | 5 workflow vàng, chất lượng sâu |
| Components | Tạo mới nhiều | Reuse/extend component hiện có |
| Intent | Conversational command | Registry-driven, whitelist, tiered action |

---

## 12. Định nghĩa “world-class” cho BHL

BHL đạt world-class không phải khi có nhiều AI card nhất, mà khi:

1. User mở màn hình là thấy việc cần quyết định trước.
2. AI nói bằng ngôn ngữ nghiệp vụ, không bằng ngôn ngữ model.
3. Mọi đề xuất đều có lý do, nguồn, độ mới dữ liệu.
4. User có thể duyệt/sửa/từ chối trong ít thao tác.
5. AI không bao giờ vượt quyền rule cứng.
6. Core vận hành không phụ thuộc AI.
7. Feedback của user quay lại cải thiện ranking/suggestion.
8. Dispatcher, DVKH, kế toán, tài xế đều thấy hệ thống “hiểu việc của mình” mà không phải học thêm một sản phẩm AI mới.

---

## 13. Kết luận cuối

Hai file chuyên gia rất có giá trị ở tầng định hướng, nhưng để biến thành one-shot thành công cho BHL cần cắt scope, bám code hiện trạng, và tăng guardrail vận hành.

Tôi đề xuất gọi bản triển khai là:

> **BHL Decision Intelligence One-shot**

Không phải “AI everywhere”, mà là:

> **Right intelligence, right decision point, right level of control.**

Nếu triển khai đúng 5 workflow vàng ở trên, BHL sẽ không chỉ có giao diện “có AI”, mà có một trải nghiệm vận hành thế hệ mới: ít đoán hơn, ít chuyển màn hơn, ít bỏ sót rủi ro hơn, và vẫn giữ con người ở đúng vị trí chịu trách nhiệm.
