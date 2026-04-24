BHL — Microsoft Clarity quick test

Mục đích
- Kiểm tra request tới https://www.clarity.ms/tag/wgqlli4s7j bằng trình duyệt cục bộ.

Hướng dẫn nhanh
1) Mở file tĩnh trực tiếp
- Mở `bhl-oms/web/clarity-test.html` bằng trình duyệt (File → Open File...).
- Nhấn nút `Load Clarity` trên trang.
- Mở DevTools (F12) → tab Network → lọc `clarity.ms` → reload nếu cần.
- Bạn sẽ thấy request tới `https://www.clarity.ms/tag/wgqlli4s7j`.

Gợi ý nếu không thấy request
- Đảm bảo DevTools đã mở trước khi bấm `Load Clarity`.
- Chọn filter All trong Network (không để JS/Doc/Other giới hạn).
- Nếu mở file trực tiếp (file://) bị hạn chế, phục vụ bằng HTTP cục bộ:
  ```powershell
  cd "D:\Beer HL\bhl-oms\web"
  python -m http.server 8080
  # Mở http://localhost:8080/clarity-test.html
  ```
- Trên máy Windows, nếu muốn hostname là `bhl.symper.us` để bám sát production, thêm dòng vào `C:\Windows\System32\drivers\etc\hosts`:
  ```text
  127.0.0.1 bhl.symper.us
  ```
  rồi chạy server và mở http://bhl.symper.us:8080/clarity-test.html — nhưng sửa hosts cần quyền admin.

Kiểm tra thêm
- Console: `typeof window.clarity === 'function'` → true nếu script đã load.
- localStorage: `localStorage.getItem('bhl_consent_analytics')` có thể được dùng để test logic consent.

Nếu bạn muốn, tôi có thể:
- Tạo script PowerShell nhỏ để mở trang test tự động và chụp màn hình Network (cần bạn cho phép chạy). 
- Hướng dẫn chi tiết chỉnh hosts và chạy server (tôi sẽ viết các lệnh sẵn sàng để dán).

