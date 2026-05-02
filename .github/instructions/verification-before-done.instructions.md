# Verification Before Marking Task "DONE"

> **CRITICAL RULE:** Never say "xong" / "done" unless you've verified working locally. This file is the source of truth.

## 🔴 MANDATORY Checklist (EVERY TIME)

### Phase 1: Code Edit → Compile
- [ ] Read source file completely before editing
- [ ] Make changes with full context (3+ lines before/after)
- [ ] Run `get_errors()` on modified files immediately
- [ ] **STOP if ANY compile errors** → fix before proceeding

### Phase 2: Build & Rebuild
- [ ] If backend Go code changed: rebuild binary, verify timestamp changed
- [ ] If frontend TypeScript changed: `npm run build`, verify NO errors in output
- [ ] If build fails → inspect error, fix root cause, rebuild again
- [ ] **NEVER skip rebuild**

### Phase 3: Dev Server Restart (EXACT SEQUENCE)
```powershell
# STEP 1: Kill all node processes
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# STEP 2: Start dev server fresh
cd "d:\Beer HL\bhl-oms\web"
npm run dev

# STEP 3: WAIT for "Ready in Xs" message in terminal
#         DO NOT reload browser before seeing this message
#         If "Starting..." hangs > 30s → stop server, investigate

# STEP 4: Wait 3 more seconds after "Ready"
Start-Sleep -Seconds 3
```

**VERIFICATION:**
- [ ] Terminal shows exactly: `▲ Next.js 14.2.5`
- [ ] Terminal shows: `Ready in Xs`
- [ ] Terminal shows: `- Local: http://localhost:3000`
- [ ] NO red error messages in terminal

### Phase 4: Browser Cache Clear + Reload
```javascript
// In Playwright console:
const client = await page.context().newCDPSession(page);
await client.send('Network.clearBrowserCache');
await page.goto('http://localhost:PORT/ROUTE', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
```

**VERIFICATION:**
- [ ] Page URL changed correctly
- [ ] Page loaded (not blank)
- [ ] Open DevTools Console → **Check for red errors**

### Phase 5: Diagnostic Check (CRITICAL)
```javascript
// In DevTools Console, check:
const errors = [];
const logLines = console.log.toString();

// 1. Check for 404 errors
if (document.documentElement.innerText.includes('404')) 
  errors.push('❌ 404 error visible on page');

// 2. Check Network tab for failed requests
// Manually inspect: should be 0 failed requests with 404/500 status
```

**VERIFICATION:**
- [ ] Console has NO red error messages
- [ ] Network tab shows: NO 404 (Not Found), NO 500 (Server Error), NO ERR_ABORTED
- [ ] Page renders completely (not blank, not partial)
- [ ] All mockups/images visible (not broken image icons)

### Phase 6: Feature Validation
- [ ] **Take screenshot** of modified section
- [ ] **Manually interact:** click buttons, scroll, type in forms
- [ ] **Verify expected behavior:** new FAQ visible, mockups show, colors correct
- [ ] **Compare to requirements:** "Tôi muốn X" → X đang hiển thị đúng không?

### Phase 7: Update Documentation
- [ ] If code changed significantly → update `CURRENT_STATE_COMPACT.md`
- [ ] If new feature added → update `CHANGELOG.md`
- [ ] If new test case needed → update `AQF_BHL_SETUP.md` or `TST_BHL_OMS_TMS_WMS.md`

---

## ⚠️ Common Failure Modes (Quick Diagnosis)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Page shows 404 in browser | Dev server not serving build | Wait for "Ready" + reload |
| Console shows "Failed to load resource: 404" | New CSS/JS not compiled | Check `.next/server` exists, restart dev server |
| "Failed to load resource: ERR_ABORTED" | Dev server crashed | Check terminal for error, restart |
| Page shows OLD content (stale) | Browser cache | Clear cache: `client.send('Network.clearBrowserCache')` |
| Terminal shows "Starting..." forever | Dev server hung | Kill node, investigate `.next` folder, rebuild |
| Blank page / nothing renders | Build broken | Check `get_errors()` output, fix TypeScript errors |

---

## 📋 Final Checklist Before "Done"

**MUST be checked in this exact order:**

1. ✅ Code compiles: `get_errors()` = empty
2. ✅ Dev server running: Terminal shows "Ready in Xs"
3. ✅ Browser reloaded fresh: URL correct, not cached
4. ✅ Console clean: NO red errors (warnings OK)
5. ✅ Network clean: NO 404/500/ERR_ABORTED
6. ✅ Page visible: Can see actual content, not blank
7. ✅ Feature works: Manual interaction confirms expected behavior
8. ✅ Screenshot taken: Shows final state
9. ✅ Documentation updated: If applicable

**ONLY when all 9 items are ✅ can you say "Done"**

---

## 🚫 Rules You CANNOT Break

- **NEVER say "code mới chạy"** if you haven't verified dev server "Ready" message
- **NEVER skip `get_errors()`** after code edit
- **NEVER rebuild without checking** for compile errors
- **NEVER reload browser** while dev server shows "Starting..."
- **NEVER ignore 404/500 errors** in console or network tab
- **NEVER batch too many files** — max 2-3 independent files per cycle
- **NEVER proceed to next feature** until current one verified working locally

---

## Example: Correct Workflow

```
TASK: Add new Help section

1. Edit help/page.tsx
   ↓
2. get_errors() → ✅ empty
   ↓
3. npm run build (in web folder)
   ↓
4. Kill node + start dev server
   ↓
5. Wait for "Ready in Xs" message
   ↓
6. Clear browser cache + reload
   ↓
7. Check console: ✅ NO red errors
   ↓
8. Check network tab: ✅ NO 404/500
   ↓
9. Screenshot + verify visible
   ↓
10. Update CURRENT_STATE_COMPACT.md
    ↓
11. ✅ DONE (not before)
```

**Time estimate:** 3-5 minutes per feature (most time = waiting for dev server)

---

## Git Integration (For Future)

```bash
# After marking "Done":
git add src/app/dashboard/help/page.tsx
git commit -m "feat: add [feature] to help page

- Verified: dev server ready, console clean, page renders
- Testing: manual interaction confirmed [expected behavior]
- Docs: CURRENT_STATE_COMPACT.md updated"
```

---

## When to Escalate (Break the Rules)

Only break these rules if:
- [ ] Backend service is down (Docker service crashed)
- [ ] System disk full (can't compile)
- [ ] Network completely down
- [ ] Hardware failure (can't restart dev server)

**Otherwise: ALWAYS follow this checklist.** No exceptions.
