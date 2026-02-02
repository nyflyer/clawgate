import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

describe('Clawgate MVP', () => {
  let server: { stop: () => void; port: number }
  let baseUrl: string

  beforeAll(async () => {
    // Set test environment
    process.env.CLAWGATE_CREDENTIALS = '{"TEST_VAR":"test_value"}'
    process.env.CLAWGATE_ALLOWLIST = 'echo,cat,printenv,nonexistent_cmd_xyz'

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

  test('non-existent command returns error', async () => {
    const res = await fetch(`${baseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'nonexistent_cmd_xyz', args: [] }),
    })
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('EXEC_ERROR')
  })
})

describe('Authentication', () => {
  let authServer: { stop: () => void; port: number }
  let authBaseUrl: string

  beforeAll(async () => {
    process.env.CLAWGATE_AUTH_TOKEN = 'test-secret-token'
    process.env.CLAWGATE_CREDENTIALS = '{}'
    process.env.CLAWGATE_ALLOWLIST = 'echo'

    // Need fresh import to pick up AUTH_TOKEN
    // Use dynamic import with cache busting
    const mod = await import(`./index.ts?auth=${Date.now()}`)
    authServer = Bun.serve({ port: 0, fetch: mod.default.fetch })
    authBaseUrl = `http://localhost:${authServer.port}`
  })

  afterAll(() => {
    authServer?.stop()
    delete process.env.CLAWGATE_AUTH_TOKEN
  })

  test('valid token succeeds', async () => {
    const res = await fetch(`${authBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        Authorization: 'Bearer test-secret-token',
      },
      body: JSON.stringify({ command: 'echo', args: ['authenticated'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toContain('authenticated')
  })

  test('invalid token returns 401', async () => {
    const res = await fetch(`${authBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        Authorization: 'Bearer wrong-token',
      },
      body: JSON.stringify({ command: 'echo', args: ['test'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  test('missing token returns 401', async () => {
    const res = await fetch(`${authBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'echo', args: ['test'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })
})

describe('Timeout', () => {
  let timeoutServer: { stop: () => void; port: number }
  let timeoutBaseUrl: string

  beforeAll(async () => {
    delete process.env.CLAWGATE_AUTH_TOKEN
    process.env.CLAWGATE_CREDENTIALS = '{}'
    process.env.CLAWGATE_ALLOWLIST = 'sleep'

    const mod = await import(`./index.ts?timeout=${Date.now()}`)
    timeoutServer = Bun.serve({ port: 0, fetch: mod.default.fetch })
    timeoutBaseUrl = `http://localhost:${timeoutServer.port}`
  })

  afterAll(() => {
    timeoutServer?.stop()
  })

  test('command timeout returns error', async () => {
    const res = await fetch(`${timeoutBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'sleep', args: ['60'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.ok).toBe(false)
    expect(data.error.code).toBe('EXEC_ERROR')
    expect(data.error.message).toContain('timed out')
  }, 35000) // 35s timeout for test itself
})

describe('Escape Sequences', () => {
  let escapeServer: { stop: () => void; port: number }
  let escapeBaseUrl: string

  beforeAll(async () => {
    delete process.env.CLAWGATE_AUTH_TOKEN
    process.env.CLAWGATE_CREDENTIALS = '{}'
    process.env.CLAWGATE_ALLOWLIST = 'echo,printf,cat'

    const mod = await import(`./index.ts?escape=${Date.now()}`)
    escapeServer = Bun.serve({ port: 0, fetch: mod.default.fetch })
    escapeBaseUrl = `http://localhost:${escapeServer.port}`
  })

  afterAll(() => {
    escapeServer?.stop()
  })

  test('multiline output is preserved', async () => {
    const res = await fetch(`${escapeBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'printf', args: ['line1\\nline2\\nline3'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toBe('line1\nline2\nline3')
  })

  test('tab characters are preserved', async () => {
    const res = await fetch(`${escapeBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'printf', args: ['col1\\tcol2\\tcol3'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toBe('col1\tcol2\tcol3')
  })

  test('backslashes are preserved', async () => {
    const res = await fetch(`${escapeBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'printf', args: ['path\\\\to\\\\file'] }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toBe('path\\to\\file')
  })

  test('quotes in output are preserved', async () => {
    const res = await fetch(`${escapeBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'echo', args: ['"hello"', "'world'"] }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toContain('"hello"')
    expect(data.data.stdout).toContain("'world'")
  })

  test('response JSON with special characters is valid', async () => {
    const res = await fetch(`${escapeBaseUrl}/v1/exec`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ command: 'printf', args: ['{"key":"value\\nwith\\nnewlines"}'] }),
    })

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(() => JSON.parse(text)).not.toThrow()

    const data = JSON.parse(text)
    expect(data.ok).toBe(true)
    expect(data.data.stdout).toBe('{"key":"value\nwith\nnewlines"}')
  })
})
