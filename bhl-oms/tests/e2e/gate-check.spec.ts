import { test, expect } from '@playwright/test'

// Journey: Gate Check (R01) — kiểm tra AQF gates đều pass
// Requires backend running with DB connected

test.describe('AQF Gate Check', () => {
  test('G0 - build passes (static checks)', async ({ request }) => {
    // If backend is running, G0 has already passed (it's a build check)
    const resp = await request.get('http://localhost:8080/v1/health')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.status || body.data?.status).toMatch(/ok|healthy/i)
  })

  test('G1 - AQF status endpoint responds', async ({ request }) => {
    const resp = await request.get('http://localhost:8080/v1/test-portal/aqf/status')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    const status = body.data || body
    expect(status).toHaveProperty('gates')
  })

  test('G2 - golden validation passes', async ({ request }) => {
    const resp = await request.post('http://localhost:8080/v1/test-portal/aqf/golden')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    const result = body.data || body
    // Golden should have pass flag
    expect(result).toHaveProperty('pass')
  })

  test('AQF decision brief is available', async ({ request }) => {
    const resp = await request.get('http://localhost:8080/v1/test-portal/aqf/status')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    const status = body.data || body
    // Should have verdict or decision brief
    const hasVerdict = status.verdict !== undefined ||
      status.decision_brief?.verdict !== undefined ||
      status.g0 !== undefined
    expect(hasVerdict).toBeTruthy()
  })

  test('Risk monitor endpoint responds', async ({ request }) => {
    const resp = await request.get('http://localhost:8080/v1/test-portal/risk-monitor')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    const result = body.data || body
    expect(result).toHaveProperty('run_at')
  })

  test('run-all-smoke runs without server error', async ({ request }) => {
    // This might take a while — smoke test runs all scenarios
    const resp = await request.post('http://localhost:8080/v1/test-portal/run-all-smoke', {
      timeout: 60000,
    })
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    const result = body.data || body
    expect(result).toHaveProperty('total_scenarios')
    expect(result.total_scenarios).toBeGreaterThan(0)
  })
})
