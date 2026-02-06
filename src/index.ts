#!/usr/bin/env bun
/**
 * Clawgate v0.2
 * Credential proxy for AI agent sandboxes
 *
 * Your keys stay home.
 */

import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { HandlerRegistry, createGenericHandlerClass } from './handlers'
import { EnvCredentialProvider } from './credentials'

const app = new Hono()

const PORT = parseInt(process.env.CLAWGATE_PORT || '9876')
const HOST = process.env.CLAWGATE_HOST || '0.0.0.0'
const AUTH_TOKEN = process.env.CLAWGATE_AUTH_TOKEN || ''

// Parse credentials from CLAWGATE_CREDENTIALS JSON blob
let credentialKeys: string[] = []
try {
  const parsed = JSON.parse(process.env.CLAWGATE_CREDENTIALS || '{}')

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      console.error(`ERROR: Credential '${key}' must be a string`)
      process.exit(1)
    }
    if (/[\x00\r\n]/.test(value)) {
      console.error(`ERROR: Credential '${key}' contains invalid characters`)
      process.exit(1)
    }
    // Set in process.env so EnvCredentialProvider can find them
    process.env[key] = value
    credentialKeys.push(key)
  }
} catch (err) {
  console.error('ERROR: Invalid JSON in CLAWGATE_CREDENTIALS environment variable')
  console.error('Expected format: \'{"KEY":"value","KEY2":"value2"}\'')
  process.exit(1)
}

// Registry setup
const registry = new HandlerRegistry()
const credentialProvider = new EnvCredentialProvider()

const toolList = (process.env.CLAWGATE_ALLOWLIST || 'gog').split(',').map(s => s.trim())
for (const tool of toolList) {
  registry.register(createGenericHandlerClass(tool, credentialKeys))
}

const TIMEOUT_MS = 30000

app.use('*', logger())

app.get('/healthz', (c) => c.json({ ok: true, version: '0.1.1' }))

app.post('/v1/exec', async (c) => {
  if (AUTH_TOKEN) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${AUTH_TOKEN}`) {
      return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } }, 401)
    }
  }

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

  if (!Array.isArray(args) || !args.every(a => typeof a === 'string')) {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'args must be array of strings' } }, 400)
  }

  const handler = registry.get(command)
  if (!handler) {
    console.log(`[DENIED] Command not in allowlist: ${command}`)
    return c.json({ ok: false, error: { code: 'OPERATION_DENIED', message: `Command '${command}' not allowed` } }, 403)
  }

  const validation = handler.validate(args)
  if (!validation.ok) {
    return c.json({ ok: false, error: { code: 'INVALID_REQUEST', message: validation.error } }, 400)
  }

  const requiredKeys = registry.getRequiredCredentials(command)
  const credResult = credentialProvider.getMany(requiredKeys ?? [])
  if (!credResult.ok) {
    return c.json({ ok: false, error: { code: 'EXEC_ERROR', message: 'Server configuration error' } }, 500)
  }

  const ctx = {
    args: args as string[],
    credentials: credResult.credentials,
    timeout: TIMEOUT_MS,
  }

  console.log(`[EXEC] ${command} (${ctx.args.length} args)`)

  try {
    const { stdout, stderr, exitCode } = await handler.execute(ctx)

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

console.log(`
Clawgate v0.2.0
Listening on http://${HOST}:${PORT}
Handlers: ${registry.getIds().join(', ')}
Credentials: ${credentialKeys.length} keys loaded
Auth: ${AUTH_TOKEN ? 'enabled' : 'disabled'}
`)

export default {
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
}
