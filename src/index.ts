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
const CREDENTIALS: Record<string, string> = JSON.parse(
  process.env.CLAWGATE_CREDENTIALS || '{}'
)

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

  // Check allowlist (MVP: just check if command starts with allowed prefix)
  const isAllowed = ALLOWLIST.some(prefix => command === prefix || command.startsWith(`${prefix} `))
  if (!isAllowed) {
    console.log(`[DENIED] Command not in allowlist: ${command}`)
    return c.json({ ok: false, error: { code: 'OPERATION_DENIED', message: `Command '${command}' not allowed` } }, 403)
  }

  // Build command array
  const cmdArray = [command, ...args]
  console.log(`[EXEC] ${cmdArray.join(' ')}`)

  // Execute with credentials injected
  try {
    // Extend PATH to include common tool locations
    const extraPaths = [
      '/home/linuxbrew/.linuxbrew/bin',
      '/home/linuxbrew/.linuxbrew/sbin',
      '/usr/local/bin',
    ]
    const PATH = [...extraPaths, process.env.PATH].join(':')

    const proc = Bun.spawn(cmdArray, {
      env: {
        ...process.env,
        PATH,
        ...CREDENTIALS,
        // Don't leak our own config to subprocesses
        CLAWGATE_CREDENTIALS: undefined,
        CLAWGATE_AUTH_TOKEN: undefined,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Wait for completion with timeout
    const timeout = 30000 // 30 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill('SIGKILL')
        reject(new Error('Command timed out'))
      }, timeout)
    })

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
