Hướng dẫn thiết lập Telegram bot (dành cho người không chuyên)

Mục tiêu: giúp bạn lấy `BOT_TOKEN` và `CHAT_ID`, rồi kiểm tra bằng script PowerShell đơn giản.

1) Tạo bot và lấy `BOT_TOKEN` (bạn cần làm bước này với Telegram)
- Mở Telegram, chat với @BotFather
- Gửi `/newbot` và làm theo hướng dẫn (đặt tên + username)
- BotFather sẽ trả `BOT_TOKEN` (ví dụ `123456:ABCDEF...`) — giữ bí mật.

2) Gửi tin nhắn tới bot
- Mở Telegram, tìm bot theo username vừa tạo, nhấn Start hoặc gửi 1 tin nhắn (ví dụ "hi").
- Hoặc thêm bot vào 1 group và gửi 1 tin trong group.

3) Chạy script `get-updates.ps1` để lấy `chat_id`
- Mở PowerShell trong thư mục gốc dự án (hoặc mở terminal ở `D:\Beer HL`).
- Chạy (nếu bị chặn, mở PowerShell as Administrator hoặc cho phép execution):

```powershell
powershell -ExecutionPolicy Bypass -File "D:\Beer HL\telegram-setup\get-updates.ps1"
```

- Script sẽ yêu cầu `BOT_TOKEN`; dán token từ BotFather.
- Script in ra JSON updates và liệt kê `chat.id` tìm được (ví dụ `987654321` hoặc group id như `-1001234567890`).

4) Gửi tin thử bằng `send-message.ps1`

```powershell
powershell -ExecutionPolicy Bypass -File "D:\Beer HL\telegram-setup\send-message.ps1"
```

- Khi script yêu cầu, dán `BOT_TOKEN`, `CHAT_ID`, và nội dung tin nhắn.
- Nếu thành công, bạn sẽ thấy JSON trả về xác nhận.

Ghi chú bảo mật:
- KHÔNG gửi `BOT_TOKEN` công khai. Nếu nghi ngờ token bị lộ, vào @BotFather -> `/revoke` hoặc tạo token mới.

Nếu bạn muốn, tôi có thể:
- Hướng dẫn bạn qua từng bước bằng ảnh chụp màn hình.
- Nếu bạn cho phép, hướng dẫn an toàn để bạn paste `BOT_TOKEN` vào script và tôi kiểm tra kết quả (tôi KHÔNG thể tự thao tác Telegram thay bạn).
