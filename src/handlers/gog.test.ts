import { describe, test, expect } from 'bun:test'
import { GogHandler } from './gog'

describe('GogHandler', () => {
  const handler = new GogHandler()

  test('has id "gog"', () => {
    expect(handler.id).toBe('gog')
  })

  test('declares GOG_KEYRING_PASSWORD as required credential', () => {
    expect(GogHandler.requiredCredentials).toEqual(['GOG_KEYRING_PASSWORD'])
  })

  test('blockedArgs contains --keyring-password', () => {
    expect(handler.blockedArgs).toEqual(['--keyring-password'])
  })

  describe('validate', () => {
    test('allows normal arguments', () => {
      const result = handler.validate(['gmail', 'search', '--query', 'test'])
      expect(result).toEqual({ ok: true })
    })

    test('allows empty args', () => {
      const result = handler.validate([])
      expect(result).toEqual({ ok: true })
    })

    test('rejects --keyring-password (exact match)', () => {
      const result = handler.validate(['gmail', '--keyring-password'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('--keyring-password')
      }
    })

    test('rejects --keyring-password=VALUE (prefix match)', () => {
      const result = handler.validate(['gmail', '--keyring-password=override'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('--keyring-password')
      }
    })

    test('rejects blocked arg regardless of position', () => {
      const result = handler.validate(['--keyring-password', 'gmail', 'search'])
      expect(result.ok).toBe(false)
    })

    test('error message follows expected format', () => {
      const result = handler.validate(['--keyring-password'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("Argument '--keyring-password' is not allowed")
      }
    })
  })
})
