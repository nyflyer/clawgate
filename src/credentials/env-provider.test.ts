/**
 * Tests for EnvCredentialProvider
 *
 * Follows TDD pattern - tests written before implementation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { EnvCredentialProvider } from './env-provider'
import type { CredentialProvider } from './types'

describe('EnvCredentialProvider', () => {
  // Save original env to restore after each test
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Set test credentials
    process.env.TEST_CRED = 'test-value'
    process.env.ANOTHER_CRED = 'another-value'
    process.env.EMPTY_CRED = ''
  })

  afterEach(() => {
    // Restore original env
    // Delete all keys first
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }
    // Restore original values
    Object.assign(process.env, originalEnv)
  })

  test('implements CredentialProvider interface', () => {
    const provider: CredentialProvider = new EnvCredentialProvider()
    expect(provider).toBeDefined()
  })

  describe('get()', () => {
    test('returns value for existing credential', () => {
      const provider = new EnvCredentialProvider()
      expect(provider.get('TEST_CRED')).toBe('test-value')
    })

    test('returns undefined for missing credential', () => {
      const provider = new EnvCredentialProvider()
      expect(provider.get('NONEXISTENT_KEY')).toBeUndefined()
    })

    test('returns empty string for credential set to empty string', () => {
      const provider = new EnvCredentialProvider()
      expect(provider.get('EMPTY_CRED')).toBe('')
    })
  })

  describe('has()', () => {
    test('returns true for existing credential', () => {
      const provider = new EnvCredentialProvider()
      expect(provider.has('TEST_CRED')).toBe(true)
    })

    test('returns false for missing credential', () => {
      const provider = new EnvCredentialProvider()
      expect(provider.has('NONEXISTENT_KEY')).toBe(false)
    })

    test('returns true for empty string credential', () => {
      const provider = new EnvCredentialProvider()
      expect(provider.has('EMPTY_CRED')).toBe(true)
    })
  })

  describe('getMany()', () => {
    test('returns success with all credentials when all exist', () => {
      const provider = new EnvCredentialProvider()
      const result = provider.getMany(['TEST_CRED', 'ANOTHER_CRED'])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.credentials).toEqual({
          TEST_CRED: 'test-value',
          ANOTHER_CRED: 'another-value',
        })
      }
    })

    test('returns failure listing ALL missing keys when any missing', () => {
      const provider = new EnvCredentialProvider()
      const result = provider.getMany(['TEST_CRED', 'MISSING_A', 'MISSING_B'])

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.missing).toContain('MISSING_A')
        expect(result.missing).toContain('MISSING_B')
        expect(result.missing).toHaveLength(2)
      }
    })

    test('returns success with empty credentials for empty array', () => {
      const provider = new EnvCredentialProvider()
      const result = provider.getMany([])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.credentials).toEqual({})
      }
    })

    test('treats empty string as present (not missing)', () => {
      const provider = new EnvCredentialProvider()
      const result = provider.getMany(['EMPTY_CRED', 'TEST_CRED'])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.credentials).toEqual({
          EMPTY_CRED: '',
          TEST_CRED: 'test-value',
        })
      }
    })
  })
})
