#!/usr/bin/env python3
"""
BHL Telegram Alert Bot
Dùng cho synthetic monitoring — gửi cảnh báo khi health check fail liên tiếp.

Cách dùng:
  python telegram_alert.py check   # check health + gửi alert nếu fail
  python telegram_alert.py test    # gửi 1 tin nhắn test
  python telegram_alert.py status  # xem trạng thái hiện tại

Biến môi trường (tạo file .env hoặc set trong Windows):
  TELEGRAM_BOT_TOKEN  = token từ @BotFather
  TELEGRAM_CHAT_ID    = chat/group ID nhận cảnh báo
  BHL_BACKEND_URL     = http://localhost:8080  (default)
  BHL_FRONTEND_URL    = http://localhost:3000  (default)
  FAIL_THRESHOLD      = 2  (số lần fail liên tiếp trước khi gửi alert, default=2)
"""

import os, sys, json, urllib.request, urllib.error, time
from pathlib import Path
from datetime import datetime

# ─── Config ─────────────────────────────────────────────
BOT_TOKEN    = os.getenv('TELEGRAM_BOT_TOKEN', '')
CHAT_ID      = os.getenv('TELEGRAM_CHAT_ID', '')
BACKEND_URL  = os.getenv('BHL_BACKEND_URL', 'http://localhost:8080')
FRONTEND_URL = os.getenv('BHL_FRONTEND_URL', 'http://localhost:3000')
FAIL_THRESHOLD = int(os.getenv('FAIL_THRESHOLD', '2'))

STATE_FILE = Path(__file__).parent / '.alert_state.json'

# ─── Health checks ──────────────────────────────────────
CHECKS = [
    {'name': 'Backend /health',    'url': f'{BACKEND_URL}/health',          'timeout': 5},
    {'name': 'Backend /v1/auth',   'url': f'{BACKEND_URL}/v1/auth/login',   'timeout': 5, 'method': 'POST',
     'body': b'{}', 'ok_codes': [400, 401, 422]},  # endpoint exists = OK
    {'name': 'Frontend /login',    'url': f'{FRONTEND_URL}/login',          'timeout': 10},
]

def http_check(check: dict) -> tuple[bool, str]:
    """Returns (ok, message)"""
    try:
        method = check.get('method', 'GET')
        body = check.get('body', None)
        req = urllib.request.Request(check['url'], data=body, method=method)
        req.add_header('Content-Type', 'application/json')
        with urllib.request.urlopen(req, timeout=check['timeout']) as resp:
            ok_codes = check.get('ok_codes', [200, 201, 204])
            if resp.status in ok_codes or resp.status == 200:
                return True, f'✅ {check["name"]}: {resp.status}'
            return False, f'⚠️ {check["name"]}: HTTP {resp.status}'
    except urllib.error.HTTPError as e:
        ok_codes = check.get('ok_codes', [])
        if e.code in ok_codes:
            return True, f'✅ {check["name"]}: {e.code}'
        return False, f'❌ {check["name"]}: HTTP {e.code}'
    except Exception as e:
        return False, f'❌ {check["name"]}: {type(e).__name__} — {str(e)[:80]}'

def send_telegram(message: str) -> bool:
    if not BOT_TOKEN or not CHAT_ID:
        print(f'[Telegram] TOKEN/CHAT_ID chưa set. Message:\n{message}')
        return False
    try:
        payload = json.dumps({
            'chat_id': CHAT_ID,
            'text': message,
            'parse_mode': 'HTML',
        }).encode()
        req = urllib.request.Request(
            f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
            data=payload,
            method='POST',
        )
        req.add_header('Content-Type', 'application/json')
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        print(f'[Telegram] Gửi thất bại: {e}')
        return False

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {'fail_count': 0, 'last_alert': 0, 'last_status': 'unknown'}

def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2))

def run_checks() -> tuple[bool, list[str]]:
    results = [http_check(c) for c in CHECKS]
    all_ok = all(ok for ok, _ in results)
    messages = [msg for _, msg in results]
    return all_ok, messages

def cmd_check():
    state = load_state()
    all_ok, messages = run_checks()
    now = datetime.now().strftime('%d/%m/%Y %H:%M')

    if all_ok:
        if state['fail_count'] > 0:
            # Recovered — gửi recovery alert nếu trước đó đã fail
            send_telegram(
                f'✅ <b>BHL OMS — Hệ thống đã phục hồi</b>\n'
                f'⏰ {now}\n'
                f'Sau {state["fail_count"]} lần fail liên tiếp, tất cả services đã OK:\n'
                + '\n'.join(messages)
            )
        state['fail_count'] = 0
        state['last_status'] = 'ok'
    else:
        state['fail_count'] = state.get('fail_count', 0) + 1
        state['last_status'] = 'fail'
        fail_msgs = [m for m in messages if m.startswith('❌') or m.startswith('⚠️')]

        if state['fail_count'] >= FAIL_THRESHOLD:
            # Gửi alert
            alert_sent = send_telegram(
                f'🚨 <b>BHL OMS — CẢNH BÁO!</b>\n'
                f'⏰ {now}\n'
                f'Fail {state["fail_count"]} lần liên tiếp:\n'
                + '\n'.join(fail_msgs)
                + f'\n\nKiểm tra: {BACKEND_URL}/health'
            )
            if alert_sent:
                state['last_alert'] = int(time.time())
                print(f'[Alert] Đã gửi Telegram alert ({state["fail_count"]} fails)')
            else:
                print(f'[Alert] Gửi Telegram thất bại!')
        else:
            print(f'[Check] Fail #{state["fail_count"]}/{FAIL_THRESHOLD} — chưa gửi alert')

    save_state(state)
    for m in messages:
        print(m)
    return all_ok

def cmd_test():
    now = datetime.now().strftime('%d/%m/%Y %H:%M')
    ok = send_telegram(
        f'🔔 <b>BHL OMS — Test Alert</b>\n'
        f'⏰ {now}\n'
        f'Telegram alert đã cấu hình đúng.\n'
        f'Ngưỡng cảnh báo: {FAIL_THRESHOLD} lần fail liên tiếp.'
    )
    print('✅ Tin nhắn test đã gửi' if ok else '❌ Gửi thất bại — kiểm tra TOKEN/CHAT_ID')

def cmd_status():
    state = load_state()
    print(json.dumps(state, indent=2, ensure_ascii=False))
    _, messages = run_checks()
    for m in messages:
        print(m)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    if cmd == 'check':
        ok = cmd_check()
        sys.exit(0 if ok else 1)
    elif cmd == 'test':
        cmd_test()
    elif cmd == 'status':
        cmd_status()
    else:
        print(f'Lệnh không hợp lệ: {cmd}')
        print('Dùng: check | test | status')
        sys.exit(1)
