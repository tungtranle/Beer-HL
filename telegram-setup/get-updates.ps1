Param([string]$BotToken)
if (-not $BotToken) { $BotToken = Read-Host "Nhập BOT_TOKEN (ví dụ 123456:ABCDEF...)" }
try {
    $url = "https://api.telegram.org/bot$BotToken/getUpdates"
    $resp = Invoke-RestMethod -Uri $url -UseBasicParsing -ErrorAction Stop
} catch {
    Write-Error "Lỗi khi gọi Telegram API: $_"
    exit 1
}

# Lấy thông tin bot (username, first_name)
try {
    $me = Invoke-RestMethod -Uri "https://api.telegram.org/bot$BotToken/getMe" -UseBasicParsing -ErrorAction Stop
    Write-Host "Bot info:" -NoNewline; Write-Host ($me.result.username) -ForegroundColor Green
} catch {
    Write-Host "Không lấy được thông tin bot (getMe)." -ForegroundColor Yellow
}

# Hiển thị JSON rõ ràng
$resp | ConvertTo-Json -Depth 6

# Tìm các chat.id
$chatIds = @()
if ($resp.result) {
    foreach ($u in $resp.result) {
        if ($u.message) { $chatIds += $u.message.chat.id }
        if ($u.channel_post) { $chatIds += $u.channel_post.chat.id }
        if ($u.edited_message) { $chatIds += $u.edited_message.chat.id }
    }
}
if ($chatIds.Count -eq 0) {
    Write-Host "Không tìm thấy chat.id nào. Hãy chắc bạn đã gửi tin nhắn tới bot hoặc thêm bot vào group và gửi tin." -ForegroundColor Yellow
} else {
    $unique = $chatIds | Sort-Object -Unique
    Write-Host "Tìm thấy chat.id(s): " -NoNewline
    Write-Host ($unique -join ", ") -ForegroundColor Cyan
}
