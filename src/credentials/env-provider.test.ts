import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { EnvCredentialProvider } from './env-provider'
import type { CredentialProvider } from './types'

describe('EnvCredentialProvider', () => {
  const TEST_ENV_KEYS = ['TEST_CRED', 'ANOTHER_CRED', 'EMPTY_CRED'] as const

  let provider: EnvCredentialProvider

  beforeEach(() => {
    process.env.TEST_CRED = 'test-value'
    process.env.ANOTHER_CRED = 'another-value'
    process.env.EMPTY_CRED = ''
    provider = new EnvCredentialProvider()
  })

  afterEach(() => {
    for (const key of TEST_ENV_KEYS) delete process.env[key]
  })

  test('implements CredentialProvider interface', () => {
    const typed: CredentialProvider = provider
    expect(typed).toBeDefined()
  })

  describe('get()', () => {
    test('returns value for existing credential', () => {
      expect(provider.get('TEST_CRED')).toBe('test-value')
    })

    test('returns undefined for missing credential', () => {
      expect(provider.get('NONEXISTENT_KEY')).toBeUndefined()
    })

    test('returns empty string for credential set to empty string', () => {
      expect(provider.get('EMPTY_CRED')).toBe('')
    })
  })

  describe('has()', () => {
    test('returns true for existing credential', () => {
      expect(provider.has('TEST_CRED')).toBe(true)
    })

    test('returns false for missing credential', () => {
      expect(provider.has('NONEXISTENT_KEY')).toBe(false)
    })

    test('returns true for empty string credential', () => {
      expect(provider.has('EMPTY_CRED')).toBe(true)
    })
  })

  describe('getMany()', () => {
    test('returns success with all credentials when all exist', () => {
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
      const result = provider.getMany(['TEST_CRED', 'MISSING_A', 'MISSING_B'])

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(new Set(result.missing)).toEqual(new Set(['MISSING_A', 'MISSING_B']))
      }
    })

    test('returns success with empty credentials for empty array', () => {
      const result = provider.getMany([])

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.credentials).toEqual({})
      }
    })

    test('treats empty string as present (not missing)', () => {
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
