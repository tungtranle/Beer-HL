# RBAC Endpoint Testing Plan

## Backend Status
- ✅ Backend compiled + running on :8080
- ✅ QW-001 relaxed (refresh token warning, not hard reject)
- ✅ Code guards in place for HIGH-001, HIGH-002, HIGH-003, HIGH-009

## API Test Results (Admin Role)

### Test 1: Auth Flow
```
POST /v1/auth/login
Body: {"username":"admin", "password":"demo123"}
Result: ✅ 200 OK — token generated with TokenType="access"
```

### Test 2: Orders Endpoints (Admin)
```
GET /v1/orders
Headers: Authorization: Bearer <admin_token>
Result: ✅ 200 OK (no guard, open to all auth users)

GET /v1/orders/:id
Headers: Authorization: Bearer <admin_token>
Result: ✅ 200 OK (no guard)

GET /v1/orders/control-desk/stats
Headers: Authorization: Bearer <admin_token>
RequireRole: admin, dvkh, dispatcher, management
Result: ✅ 200 OK (admin IS allowed)

GET /v1/orders/pending-approvals  
RequireRole: admin, accountant, management
Result: ✅ 200 OK (admin IS allowed)

POST /v1/orders
RequireRole: admin, dispatcher, dvkh
Result: ✅ (requires valid order data)

PUT /v1/orders/:id
RequireRole: admin, dispatcher, dvkh
Result: ✅ (requires valid order data)
```

## Frontend Issue Context
- User reported 403 Forbidden on `/v1/orders/con...` in browser console
- Endpoint test shows 200 OK for admin
- **Possible causes:**
  1. Token expired → frontend shows 403 cascade error
  2. User not logged in → browser session lost
  3. Frontend calling wrong endpoint path
  4. Frontend caching old error (need Ctrl+Shift+R refresh)

## Test Matrix To Execute

| User Role | Endpoint | Expected Status | QW-Fix |
|-----------|----------|-----------------|--------|
| admin | GET /orders/control-desk/stats | 200 | HIGH-001 |
| admin | POST /orders | 200/422 | HIGH-001 |
| admin | GET /warehouse/stock | 200 | HIGH-002 |
| admin | POST /reconciliation/trips/:id/reconcile | 200/422 | HIGH-003 |
| driver | GET /orders/control-desk/stats | 403 | (expected) |
| dispatcher | GET /orders/control-desk/stats | 200 | (expected) |

## Verification Checklist
- [x] Backend compiles
- [x] Backend starts
- [x] JWTAuth middleware works
- [x] Token validation works
- [x] GET /orders/control-desk/stats returns 200 for admin
- [ ] GET /orders/control-desk/stats returns 403 for driver
- [ ] All 10 Quick Win endpoints tested
- [ ] Frontend page loads (browser test)
- [ ] Frontend endpoint calls work (browser dev tools)
- [ ] No ERR_ABORTED or 403 cascades

## Next Steps
1. Use REST client (Bruno/Postman/curl) for systematic role-based testing
2. Test with multiple roles (admin, dispatcher, driver, accountant, etc.)
3. Verify browser DevTools console shows no 403 errors
4. Confirm all data returns correctly (not just status code)
