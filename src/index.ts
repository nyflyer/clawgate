#!/usr/bin/env bun
/**
 * Clawgate v0.1 MVP
 * Credential proxy for AI agent sandboxes
 *
 * Your keys stay home.
 */

import { Hono } from 'hono'
import { logger } from 'hono/logger'

const app = new Hono()

// Configuration from environment
const PORT = parseInt(process.env.CLAWGATE_PORT || '9876')
const HOST = process.env.CLAWGATE_HOST || '0.0.0.0'
const AUTH_TOKEN = process.env.CLAWGATE_AUTH_TOKEN || '' // Optional for MVP

// Credentials to inject (JSON object of env vars)
// e.g., CLAWGATE_CREDENTIALS='{"GOG_KEYRING_PASSWORD":"secret"}'
let CREDENTIALS: Record<string, string> = {}
try {
  CREDENTIALS = JSON.parse(process.env.CLAWGATE_CREDENTIALS || '{}')
} catch (err) {
  console.error('ERROR: Invalid JSON in CLAWGATE_CREDENTIALS environment variable')
  console.error('Expected format: \'{"KEY":"value","KEY2":"value2"}\'')
  process.exit(1)
}

// Validate credential values
for (const [key, value] of Object.entries(CREDENTIALS)) {
  if (typeof value !== 'string') {
    console.error(`ERROR: Credential '${key}' must be a string`)
    process.exit(1)
  }
  if (/[\x00\r\n]/.test(value)) {
    console.error(`ERROR: Credential '${key}' contains invalid characters`)
    process.exit(1)
  }
}

// Allowlist of commands (exact match only)
// e.g., CLAWGATE_ALLOWLIST='gog,gh,curl'
const ALLOWLIST = (process.env.CLAWGATE_ALLOWLIST || 'gog').split(',').map(s => s.trim())

// Output size limit to prevent memory exhaustion
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024 // 10MB

async function readLimited(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalSize = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalSize += value.length
    if (totalSize > maxBytes) {
      reader.cancel()
      chunks.push(value.slice(0, maxBytes - (totalSize - value.length)))
      break
    }
    chunks.push(value)
  }

  return new TextDecoder().decode(Buffer.concat(chunks))
}

// Middleware
app.use('*', logger())

// Health check
app.get('/healthz', (c) => c.json({ ok: true, version: '0.1.1' }))

// Main exec endpoint
app.post('/v1/exec', async (c) => {
  // Optional auth check
  if (AUTH_TOKEN) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${AUTH_TOKEN}`) {
      return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } }, 401)
    }
  }

  // Parse request
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } }, 400)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, 400)
  }

  const { command, args = [] } = body as { command?: unknown; args?: unknown }

  if (!command || typeof command !== 'string') {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Missing command' } }, 400)
  }

  // Validate args is an array of strings
  if (!Array.isArray(args) || !args.every(a => typeof a === 'string')) {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'args must be array of strings' } }, 400)
  }

  // Check allowlist (exact match only - no prefix matching to prevent bypass)
  if (!ALLOWLIST.includes(command)) {
    console.log(`[DENIED] Command not in allowlist: ${command}`)
    return c.json({ ok: false, error: { code: 'OPERATION_DENIED', message: `Command '${command}' not allowed` } }, 403)
  }

  // Build command array
  const cmdArray = [command, ...args]
  console.log(`[EXEC] ${command} (${args.length} args)`)

  // Execute with credentials injected
  try {
    // Extend PATH to include common tool locations
    const extraPaths = [
      '/home/linuxbrew/.linuxbrew/bin',
      '/home/linuxbrew/.linuxbrew/sbin',
      '/usr/local/bin',
    ]
    const PATH = [...extraPaths, process.env.PATH].filter(Boolean).join(':')

    const proc = Bun.spawn(cmdArray, {
      env: {
        // Minimal environment - don't leak host env vars
        PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        TERM: process.env.TERM || 'xterm-256color',
        ...CREDENTIALS,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Wait for completion with timeout
    const TIMEOUT_MS = 30000
    let timeoutId: Timer | undefined

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        proc.kill('SIGKILL')
        reject(new Error('Command timed out'))
      }, TIMEOUT_MS)
    })

    const exitCode = await Promise.race([proc.exited, timeoutPromise]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId)
    })

    const stdout = await readLimited(proc.stdout, MAX_OUTPUT_BYTES)
    const stderr = await readLimited(proc.stderr, MAX_OUTPUT_BYTES)

    console.log(`[DONE] exit=${exitCode} stdout=${stdout.length}b stderr=${stderr.length}b`)

    return c.json({
      ok: true,
      data: {
        stdout,
        stderr,
        exitCode,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Command execution failed'
    console.error(`[ERROR] ${message}`)
    return c.json({ ok: false, error: { code: 'EXEC_ERROR', message } }, 500)
  }
})

// Start server
console.log(`
╔═══════════════════════════════════════════════════════════╗
║  CLAWGATE v0.1.1                                          ║
║  Credential proxy for AI agent sandboxes                  ║
╚═══════════════════════════════════════════════════════════╝

Listening on http://${HOST}:${PORT}
Allowlist: ${ALLOWLIST.join(', ')}
Credentials: ${Object.keys(CREDENTIALS).length} env vars configured
Auth: ${AUTH_TOKEN ? 'enabled' : 'disabled (open access)'}

Endpoints:
  GET  /healthz     Health check
  POST /v1/exec     Execute command
`)

export default {
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
}
