---
description: "Use when making code changes, adding features, fixing bugs, or modifying any functionality that differs from the original BRD. Ensures BRD and related documentation stay in sync with actual implementation."
applyTo: "**/*.{go,ts,tsx,sql,py}"
---

# Quy tắc đồng bộ tài liệu dự án

## Nguyên tắc bắt buộc

Tất cả các thay đổi, bổ sung so với BRD ban đầu **PHẢI** được cập nhật lại trong BRD và các file tài liệu liên quan.

## Quy trình thực hiện

Khi hoàn thành một thay đổi code (tính năng mới, sửa lỗi, thay đổi logic), thực hiện kiểm tra:

1. **So sánh với BRD**: Thay đổi này có khác với mô tả trong `BRD_BHL_OMS_TMS_WMS.md` không?
2. **Nếu có khác biệt**, cập nhật các file sau (tùy phạm vi thay đổi):

| Loại thay đổi | File cần cập nhật |
|----------------|-------------------|
| Yêu cầu nghiệp vụ / User Story mới | `BRD_BHL_OMS_TMS_WMS.md` |
| API endpoint mới / thay đổi | `API_BHL_OMS_TMS_WMS.md` |
| Schema DB / migration | `DBS_BHL_OMS_TMS_WMS.md` |
| Kiến trúc hệ thống | `SAD_BHL_OMS_TMS_WMS.md` |
| Giao diện / UX flow | `UIX_BHL_OMS_TMS_WMS.md` |
| Test case | `TST_BHL_OMS_TMS_WMS.md` |
| Tích hợp bên ngoài | `INT_BHL_OMS_TMS_WMS.md` |
| Hạ tầng / deployment | `INF_BHL_OMS_TMS_WMS.md` |
| Migration data | `MIG_BHL_OMS_TMS_WMS.md` |
| Hiệu năng | `PEP_BHL_OMS_TMS_WMS.md` |

3. **Ghi nhận phiên bản**: Khi cập nhật BRD, tăng version number và ghi changelog ngắn gọn.

## Ví dụ

- Thêm tính năng drag-drop điều chỉnh VRP → Cập nhật BRD (User Story mới), API doc (endpoint mới nếu có), UIX (mô tả UX flow mới).
- Sửa bug hiển thị địa chỉ → Cập nhật TST (thêm test case regression).
- Thêm OSRM routing trên bản đồ → Cập nhật BRD (User Story), SAD (kiến trúc tích hợp OSRM), INT (external service mới).
