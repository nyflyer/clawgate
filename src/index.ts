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

// Allowlist of commands (MVP: simple prefix matching)
// e.g., CLAWGATE_ALLOWLIST='gog,gh,curl'
const ALLOWLIST = (process.env.CLAWGATE_ALLOWLIST || 'gog').split(',').map(s => s.trim())

// Middleware
app.use('*', logger())

// Health check
app.get('/healthz', (c) => c.json({ ok: true, version: '0.1.0' }))

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
  let body: { command: string; args?: string[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } }, 400)
  }

  const { command, args = [] } = body

  if (!command || typeof command !== 'string') {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Missing command' } }, 400)
  }

  // Validate args is an array of strings
  if (!Array.isArray(args) || !args.every(a => typeof a === 'string')) {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'args must be array of strings' } }, 400)
  }

  // Check allowlist (exact match only - no prefix matching to prevent bypass)
  const isAllowed = ALLOWLIST.includes(command)
  if (!isAllowed) {
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
    const timeout = 30000 // 30 seconds
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        proc.kill('SIGKILL')
        reject(new Error('Command timed out'))
      }, timeout)
    })

    try {
      const exitCode = await Promise.race([proc.exited, timeoutPromise])

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      console.log(`[DONE] exit=${exitCode} stdout=${stdout.length}b stderr=${stderr.length}b`)

      return c.json({
        ok: true,
        data: {
          stdout,
          stderr,
          exitCode,
        },
      })
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Command execution failed'
    console.error(`[ERROR] ${message}`)
    return c.json({ ok: false, error: { code: 'EXEC_ERROR', message } }, 500)
  }
})

// Start server
console.log(`
╔═══════════════════════════════════════════════════════════╗
║  CLAWGATE v0.1.0                                          ║
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
