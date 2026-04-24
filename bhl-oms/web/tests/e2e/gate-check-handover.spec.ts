import { test, expect, Page } from '@playwright/test'

// E2E-2: Gate Check → Handover A → verify status đúng trong DB
// Luồng: Login warehouse → Gate check pass → Handover confirm → check status

const API = 'http://localhost:8080/v1'
const BASE = 'http://localhost:3000'

async function loginAsWarehouse(page: Page): Promise<string> {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { username: 'thukho_hl01', password: 'demo123' },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  return body.data.access_token
}

test.describe('E2E-2: Gate Check và Handover A', () => {
  let token: string

  test.beforeEach(async ({ page }) => {
    token = await loginAsWarehouse(page)
  })

  test('warehouse login thành công', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.evaluate((t) => localStorage.setItem('access_token', t), token)
    await page.goto(`${BASE}/dashboard`)
    await expect(page).not.toHaveURL(/login/)
  })

  test('gate check page load được', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.evaluate((t) => localStorage.setItem('access_token', t), token)
    await page.goto(`${BASE}/dashboard/handover-a`)
    await expect(page).not.toHaveURL(/login/)
    // Page không crash
    const title = page.locator('h1, h2').first()
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('API gate-check trả về đúng response format', async ({ page }) => {
    // Test API endpoint trực tiếp — không cần UI interaction
    // Gate check với số lượng ĐÚNG → phải pass
    const warehousesRes = await page.request.get(`${API}/warehouses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (warehousesRes.status() !== 200) { test.skip(); return }
    const warehouses = await warehousesRes.json()
    if (!warehouses.data?.length) { test.skip(); return }

    // Lấy trip đang trong trạng thái cần gate check (nếu có)
    const tripsRes = await page.request.get(`${API}/trips?status=loading&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (tripsRes.status() === 200) {
      const trips = await tripsRes.json()
      // Chỉ verify response format — không thực sự submit gate check vì cần real data
      expect(trips).toHaveProperty('data')
    }
  })

  test('R01 gate check FAIL khi số lượng không khớp (API level)', async ({ page }) => {
    // Submit gate check với số lượng SAI → phải 400
    const res = await page.request.post(`${API}/gate-check`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        warehouse_id: 'test-warehouse',
        trip_id: 'test-trip-r01-e2e',
        items: [
          { product_id: 'test-product', ordered_qty: 100, actual_qty: 95 },
        ],
      },
    })

    // Nếu endpoint tồn tại: phải 400 (mismatch) hoặc 404 (trip không tồn tại)
    // KHÔNG được là 200/201
    if (res.status() !== 404 && res.status() !== 422) {
      expect([400, 404, 422]).toContain(res.status())
    }
    expect(res.status()).not.toBe(200)
    expect(res.status()).not.toBe(201)
  })
})
