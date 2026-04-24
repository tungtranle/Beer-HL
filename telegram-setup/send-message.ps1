Param([string]$BotToken, [string]$ChatId, [string]$Text)
if (-not $BotToken) { $BotToken = Read-Host "Nhập BOT_TOKEN" }
if (-not $ChatId) { $ChatId = Read-Host "Nhập CHAT_ID" }
if (-not $Text) { $Text = Read-Host "Nhập nội dung tin nhắn" }
try {
    $body = @{ chat_id = $ChatId; text = $Text } | ConvertTo-Json
    $url = "https://api.telegram.org/bot$BotToken/sendMessage"
    $resp = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
    $resp | ConvertTo-Json -Depth 4
} catch {
    Write-Error "Lỗi khi gửi tin: $_"
    exit 1
}
