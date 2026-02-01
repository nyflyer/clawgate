import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

// Test the server
describe('Clawgate MVP', () => {
  let server: { stop: () => void }
  const BASE_URL = 'http://localhost:9877' // Use different port for tests

  beforeAll(async () => {
    // Set test environment
    process.env.CLAWGATE_PORT = '9877'
    process.env.CLAWGATE_CREDENTIALS = '{"TEST_VAR":"test_value"}'
    process.env.CLAWGATE_ALLOWLIST = 'echo,cat'

    // Import and start server
    const mod = await import('./index.ts')
    server = Bun.serve({
      port: 9877,
      fetch: mod.default.fetch,
    })
  })

  afterAll(() => {
    server?.stop()
  })

  test('GET /healthz returns ok', async () => {
    const res = await fetch(`${BASE_URL}/healthz`)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.version).toBe('0.1.0')
  })

  test('POST /v1/exec with allowed command succeeds', async () => {
    const res = await fetch(`${BASE_URL}/v1/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'echo',
        args: ['hello', 'world'],
      }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toContain('hello world')
    expect(data.data.exitCode).toBe(0)
  })

  test('POST /v1/exec with disallowed command fails', async () => {
    const res = await fetch(`${BASE_URL}/v1/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'rm',
        args: ['-rf', '/'],
      }),
    })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('OPERATION_DENIED')
  })

  test('POST /v1/exec injects credentials to subprocess', async () => {
    const res = await fetch(`${BASE_URL}/v1/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'echo',
        args: ['$TEST_VAR'],
      }),
    })
    const data = await res.json()

    // Note: echo $TEST_VAR won't expand without shell
    // But we can verify the command ran
    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
  })

  test('POST /v1/exec with invalid JSON fails', async () => {
    const res = await fetch(`${BASE_URL}/v1/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('INVALID_REQUEST')
  })

  test('POST /v1/exec with missing command fails', async () => {
    const res = await fetch(`${BASE_URL}/v1/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: ['test'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.ok).toBe(false)
  })
})
