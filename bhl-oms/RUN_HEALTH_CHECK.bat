@echo off
:: BHL Synthetic Monitor — chạy mỗi 15 phút qua Windows Task Scheduler
:: Setup: mở Task Scheduler → New Task → Trigger: every 15 min → Action: run file này
cd /d "%~dp0"
python scripts\telegram_alert.py check
