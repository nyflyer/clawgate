import { describe, test, expect, beforeEach } from 'bun:test'
import { HandlerRegistry } from './registry'
import type {
  Handler,
  HandlerClass,
  ExecutionContext,
  ExecutionResult,
  ValidationResult,
} from './types'

/**
 * Test handler implementation for registry testing.
 * Implements Handler interface with minimal functionality.
 */
class TestHandler implements Handler {
  static readonly requiredCredentials: readonly string[] = ['TEST_CREDENTIAL']

  readonly id = 'test'
  readonly blockedArgs = ['--dangerous'] as const

  validate(args: readonly string[]): ValidationResult {
    const blocked = this.blockedArgs.find((b) => args.includes(b))
    if (blocked) {
      return { ok: false, error: `Argument '${blocked}' is not allowed` }
    }
    return { ok: true }
  }

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    return {
      stdout: `executed with ${ctx.args.length} args`,
      stderr: '',
      exitCode: 0,
    }
  }
}

/**
 * Another test handler with different credentials.
 */
class AnotherHandler implements Handler {
  static readonly requiredCredentials: readonly string[] = [
    'CRED_A',
    'CRED_B',
  ]

  readonly id = 'another'
  readonly blockedArgs: readonly string[] = []

  validate(_args: readonly string[]): ValidationResult {
    return { ok: true }
  }

  async execute(_ctx: ExecutionContext): Promise<ExecutionResult> {
    return { stdout: '', stderr: '', exitCode: 0 }
  }
}

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry

  beforeEach(() => {
    registry = new HandlerRegistry()
  })

  describe('register()', () => {
    test('registers a handler successfully', () => {
      const handler = new TestHandler()
      registry.register(handler, TestHandler as unknown as HandlerClass)

      expect(registry.has('test')).toBe(true)
    })

    test('throws on duplicate registration', () => {
      const handler = new TestHandler()
      registry.register(handler, TestHandler as unknown as HandlerClass)

      expect(() => {
        registry.register(handler, TestHandler as unknown as HandlerClass)
      }).toThrow("Handler 'test' already registered")
    })

    test('normalizes ID to lowercase', () => {
      const handler = {
        id: 'UPPERCASE',
        blockedArgs: [],
        validate: () => ({ ok: true }) as ValidationResult,
        execute: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
      }

      registry.register(handler, TestHandler as unknown as HandlerClass)

      expect(registry.has('uppercase')).toBe(true)
      expect(registry.has('UPPERCASE')).toBe(true)
    })
  })

  describe('get()', () => {
    test('returns registered handler', () => {
      const handler = new TestHandler()
      registry.register(handler, TestHandler as unknown as HandlerClass)

      const retrieved = registry.get('test')
      expect(retrieved).toBe(handler)
    })

    test('returns undefined for unregistered handler', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    test('is case-insensitive', () => {
      const handler = new TestHandler()
      registry.register(handler, TestHandler as unknown as HandlerClass)

      expect(registry.get('TEST')).toBe(handler)
      expect(registry.get('Test')).toBe(handler)
      expect(registry.get('test')).toBe(handler)
    })
  })

  describe('has()', () => {
    test('returns true for registered handler', () => {
      const handler = new TestHandler()
      registry.register(handler, TestHandler as unknown as HandlerClass)

      expect(registry.has('test')).toBe(true)
    })

    test('returns false for unregistered handler', () => {
      expect(registry.has('nonexistent')).toBe(false)
    })

    test('is case-insensitive', () => {
      const handler = new TestHandler()
      registry.register(handler, TestHandler as unknown as HandlerClass)

      expect(registry.has('TEST')).toBe(true)
      expect(registry.has('Test')).toBe(true)
    })
  })

  describe('getRequiredCredentials()', () => {
    test('returns credentials for registered handler', () => {
      const handler = new TestHandler()
      registry.register(handler, TestHandler as unknown as HandlerClass)

      const creds = registry.getRequiredCredentials('test')
      expect(creds).toEqual(['TEST_CREDENTIAL'])
    })

    test('returns multiple credentials', () => {
      const handler = new AnotherHandler()
      registry.register(handler, AnotherHandler as unknown as HandlerClass)

      const creds = registry.getRequiredCredentials('another')
      expect(creds).toEqual(['CRED_A', 'CRED_B'])
    })

    test('returns undefined for unregistered handler', () => {
      expect(registry.getRequiredCredentials('nonexistent')).toBeUndefined()
    })

    test('is case-insensitive', () => {
      const handler = new TestHandler()
      registry.register(handler, TestHandler as unknown as HandlerClass)

      expect(registry.getRequiredCredentials('TEST')).toEqual([
        'TEST_CREDENTIAL',
      ])
    })
  })

  describe('getIds()', () => {
    test('returns empty array when no handlers registered', () => {
      expect(registry.getIds()).toEqual([])
    })

    test('returns all registered handler IDs', () => {
      registry.register(
        new TestHandler(),
        TestHandler as unknown as HandlerClass
      )
      registry.register(
        new AnotherHandler(),
        AnotherHandler as unknown as HandlerClass
      )

      const ids = registry.getIds()
      expect(ids).toContain('test')
      expect(ids).toContain('another')
      expect(ids.length).toBe(2)
    })

    test('returns lowercase IDs', () => {
      const handler = {
        id: 'MIXED_Case',
        blockedArgs: [],
        validate: () => ({ ok: true }) as ValidationResult,
        execute: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
      }
      registry.register(handler, TestHandler as unknown as HandlerClass)

      expect(registry.getIds()).toEqual(['mixed_case'])
    })
  })
})

describe('Handler interface implementation', () => {
  test('validate() returns success for valid args', () => {
    const handler = new TestHandler()
    const result = handler.validate(['--safe', 'arg'])

    expect(result.ok).toBe(true)
  })

  test('validate() returns error for blocked args', () => {
    const handler = new TestHandler()
    const result = handler.validate(['--dangerous'])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('--dangerous')
    }
  })

  test('execute() returns ExecutionResult', async () => {
    const handler = new TestHandler()
    const ctx: ExecutionContext = {
      args: ['arg1', 'arg2'],
      credentials: { TEST_CREDENTIAL: 'secret' },
      timeout: 5000,
    }

    const result = await handler.execute(ctx)

    expect(result.stdout).toContain('2 args')
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
  })

  test('handler has readonly properties', () => {
    const handler = new TestHandler()

    expect(handler.id).toBe('test')
    expect(handler.blockedArgs).toEqual(['--dangerous'])
  })

  test('static requiredCredentials is accessible on class', () => {
    expect(TestHandler.requiredCredentials).toEqual(['TEST_CREDENTIAL'])
    expect(AnotherHandler.requiredCredentials).toEqual(['CRED_A', 'CRED_B'])
  })
})
