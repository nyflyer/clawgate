import { describe, test, expect } from 'bun:test'
import { GhHandler } from './gh'

describe('GhHandler', () => {
  const handler = new GhHandler()

  test('has id "gh"', () => {
    expect(handler.id).toBe('gh')
  })

  test('declares GH_TOKEN as required credential', () => {
    expect(GhHandler.requiredCredentials).toEqual(['GH_TOKEN'])
  })

  test('blockedArgs contains credential-exposing subcommands', () => {
    expect(handler.blockedArgs).toEqual([
      'auth', 'ssh-key', 'gpg-key', 'secret', 'variable', 'config',
    ])
  })

  describe('validate - allows normal subcommands', () => {
    test('allows pr list', () => {
      const result = handler.validate(['pr', 'list'])
      expect(result).toEqual({ ok: true })
    })

    test('allows issue create', () => {
      const result = handler.validate(['issue', 'create', '--title', 'bug'])
      expect(result).toEqual({ ok: true })
    })

    test('allows api call', () => {
      const result = handler.validate(['api', '/repos'])
      expect(result).toEqual({ ok: true })
    })

    test('allows repo view', () => {
      const result = handler.validate(['repo', 'view'])
      expect(result).toEqual({ ok: true })
    })

    test('allows empty args (gh prints help)', () => {
      const result = handler.validate([])
      expect(result).toEqual({ ok: true })
    })
  })

  describe('validate - rejects credential-exposing subcommands', () => {
    test('rejects auth (token extraction)', () => {
      const result = handler.validate(['auth', 'token'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('auth')
      }
    })

    test('rejects auth status --show-token', () => {
      const result = handler.validate(['auth', 'status', '--show-token'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('auth')
      }
    })

    test('rejects ssh-key', () => {
      const result = handler.validate(['ssh-key', 'add'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('ssh-key')
      }
    })

    test('rejects gpg-key', () => {
      const result = handler.validate(['gpg-key', 'add'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('gpg-key')
      }
    })

    test('rejects secret', () => {
      const result = handler.validate(['secret', 'set', 'MY_SECRET'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('secret')
      }
    })

    test('rejects variable', () => {
      const result = handler.validate(['variable', 'set', 'MY_VAR'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('variable')
      }
    })

    test('rejects config', () => {
      const result = handler.validate(['config', 'set', 'editor'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('config')
      }
    })
  })

  describe('validate - error messages', () => {
    test('error message follows expected format', () => {
      const result = handler.validate(['auth', 'login'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("Subcommand 'auth' is not allowed")
      }
    })

    test('error message contains blocked subcommand name', () => {
      const result = handler.validate(['secret', 'list'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('secret')
      }
    })
  })
})
