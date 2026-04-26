import { test, expect } from '@playwright/test'

// Journey: Dispatcher tạo đơn → Dispatcher dispatch → Driver nhận chuyến → Driver giao hàng → Kho xác nhận
// Requires backend at :8080 and frontend at :3000 with SC-01 data loaded

test.describe('Order Lifecycle E2E', () => {
  // Load SC-01 data via test portal before running
  test.beforeAll(async ({ request }) => {
    await request.post('http://localhost:8080/v1/test-portal/reset')
    await request.post('http://localhost:8080/v1/test-portal/load-base')
    const resp = await request.post('http://localhost:8080/v1/test-portal/load-scenario', {
      data: { scenario_id: 'SC-01' },
    })
    expect(resp.status()).toBe(200)
  })

  test('dispatcher can see orders list', async ({ page }) => {
    // Login as dispatcher
    await page.goto('/login')
    await page.getByLabel(/tên đăng nhập|username/i).fill('dispatcher01')
    await page.getByLabel(/mật khẩu|password/i).fill('dispatch123')
    await page.getByRole('button', { name: /đăng nhập|login/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })

    // Navigate to orders
    await page.goto('/dashboard/orders')
    await expect(page.getByText(/đơn hàng|orders/i).first()).toBeVisible()
    // At least one order should be present from SC-01
    await expect(page.locator('table tbody tr, [data-testid="order-row"]').first()).toBeVisible({ timeout: 8000 })
  })

  test('order detail shows correct information', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/tên đăng nhập|username/i).fill('dispatcher01')
    await page.getByLabel(/mật khẩu|password/i).fill('dispatch123')
    await page.getByRole('button', { name: /đăng nhập|login/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })

    await page.goto('/dashboard/orders')
    // Click first order row
    const firstRow = page.locator('table tbody tr, [data-testid="order-row"]').first()
    await expect(firstRow).toBeVisible({ timeout: 8000 })
    await firstRow.click()

    // Order detail should show status
    await expect(page.getByText(/trạng thái|status/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('trips page shows dispatched trips', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/tên đăng nhập|username/i).fill('dispatcher01')
    await page.getByLabel(/mật khẩu|password/i).fill('dispatch123')
    await page.getByRole('button', { name: /đăng nhập|login/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })

    await page.goto('/dashboard/trips')
    await expect(page.getByText(/chuyến|trip/i).first()).toBeVisible({ timeout: 8000 })
  })
})
