import { test, expect } from '@playwright/test'

// Helper: get JWT token for a given role
async function loginAs(page: any, role: string): Promise<string> {
  const credentials: Record<string, { username: string; password: string }> = {
    admin: { username: 'admin', password: 'admin123' },
    dispatcher: { username: 'dispatcher01', password: 'dispatch123' },
    driver: { username: 'driver01', password: 'driver123' },
    warehouse_handler: { username: 'warehouse01', password: 'warehouse123' },
    dvkh: { username: 'dvkh01', password: 'dvkh123' },
    management: { username: 'management01', password: 'manage123' },
  }

  const creds = credentials[role] || credentials.admin
  const resp = await page.request.post('/api/v1/auth/login', {
    data: { username: creds.username, password: creds.password },
  })

  if (!resp.ok()) {
    throw new Error(`Login failed for ${role}: ${resp.status()}`)
  }

  const body = await resp.json()
  return body.data?.token || body.token || ''
}

// ─────────────────────────────────────────────────────────────
test.describe('Login', () => {
  test('admin can login and reach dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/tên đăng nhập|username/i).fill('admin')
    await page.getByLabel(/mật khẩu|password/i).fill('admin123')
    await page.getByRole('button', { name: /đăng nhập|login/i }).click()

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
    await expect(page.getByText(/bhl|dashboard/i).first()).toBeVisible()
  })

  test('invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/tên đăng nhập|username/i).fill('admin')
    await page.getByLabel(/mật khẩu|password/i).fill('wrong_password')
    await page.getByRole('button', { name: /đăng nhập|login/i }).click()

    await expect(page.getByText(/sai|invalid|không đúng|error/i)).toBeVisible({ timeout: 5000 })
    await expect(page).not.toHaveURL(/dashboard/)
  })

  test('driver can login and sees driver dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/tên đăng nhập|username/i).fill('driver01')
    await page.getByLabel(/mật khẩu|password/i).fill('driver123')
    await page.getByRole('button', { name: /đăng nhập|login/i }).click()

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
  })
})
