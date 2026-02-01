import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

describe('Clawgate MVP', () => {
  let server: { stop: () => void; port: number }
  let baseUrl: string

  beforeAll(async () => {
    // Set test environment
    process.env.CLAWGATE_CREDENTIALS = '{"TEST_VAR":"test_value"}'
    process.env.CLAWGATE_ALLOWLIST = 'echo,cat,printenv'

    // Import and start server
    const mod = await import('./index.ts')
    server = Bun.serve({
      port: 0, // ephemeral port
      fetch: mod.default.fetch,
    })
    baseUrl = `http://localhost:${server.port}`
  })

  afterAll(() => {
    server?.stop()
  })

  test('GET /healthz returns ok', async () => {
    const res = await fetch(`${baseUrl}/healthz`)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.version).toBe('0.1.0')
  })

  test('POST /v1/exec with allowed command succeeds', async () => {
    const res = await fetch(`${baseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'echo', args: ['hello', 'world'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toContain('hello world')
    expect(data.data.exitCode).toBe(0)
  })

  test('POST /v1/exec with disallowed command fails', async () => {
    const res = await fetch(`${baseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'rm', args: ['-rf', '/'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('OPERATION_DENIED')
  })

  test('POST /v1/exec injects credentials to subprocess', async () => {
    const res = await fetch(`${baseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'printenv', args: ['TEST_VAR'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toContain('test_value')
  })

  test('POST /v1/exec with invalid JSON fails', async () => {
    const res = await fetch(`${baseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: 'not json',
    })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('INVALID_REQUEST')
  })

  test('POST /v1/exec with missing command fails', async () => {
    const res = await fetch(`${baseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ args: ['test'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.ok).toBe(false)
  })
})
