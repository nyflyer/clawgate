import { describe, test, expect, beforeEach } from 'bun:test'
import { HandlerRegistry } from './registry'
import type { Handler, ExecutionContext, ExecutionResult, ValidationResult } from './types'

/** Creates a minimal test handler class with the given configuration. */
function createTestHandler(config: {
  id: string
  credentials?: readonly string[]
  blockedArgs?: readonly string[]
}): (new () => Handler) & { readonly requiredCredentials: readonly string[] } {
  const { id, credentials = [], blockedArgs = [] } = config

  return class implements Handler {
    static readonly requiredCredentials = credentials
    readonly id = id
    readonly blockedArgs = blockedArgs

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
}

const TestHandler = createTestHandler({
  id: 'test',
  credentials: ['TEST_CREDENTIAL'],
  blockedArgs: ['--dangerous'],
})

const AnotherHandler = createTestHandler({
  id: 'another',
  credentials: ['CRED_A', 'CRED_B'],
})

const MixedCaseHandler = createTestHandler({ id: 'MIXED_Case' })

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry

  beforeEach(() => {
    registry = new HandlerRegistry()
  })

  describe('register()', () => {
    test('registers a handler successfully', () => {
      registry.register(TestHandler)
      expect(registry.has('test')).toBe(true)
    })

    test('throws on duplicate registration', () => {
      registry.register(TestHandler)
      expect(() => registry.register(TestHandler)).toThrow("Handler 'test' already registered")
    })

    test('normalizes ID to lowercase', () => {
      registry.register(MixedCaseHandler)
      expect(registry.has('mixed_case')).toBe(true)
      expect(registry.has('MIXED_Case')).toBe(true)
    })
  })

  describe('get()', () => {
    test('returns registered handler', () => {
      registry.register(TestHandler)
      expect(registry.get('test')).toBeDefined()
      expect(registry.get('test')?.id).toBe('test')
    })

    test('returns undefined for unregistered handler', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    test('is case-insensitive', () => {
      registry.register(TestHandler)
      const handler = registry.get('test')
      expect(registry.get('TEST')).toBe(handler)
      expect(registry.get('Test')).toBe(handler)
    })
  })

  describe('has()', () => {
    test('returns true for registered handler', () => {
      registry.register(TestHandler)
      expect(registry.has('test')).toBe(true)
    })

    test('returns false for unregistered handler', () => {
      expect(registry.has('nonexistent')).toBe(false)
    })

    test('is case-insensitive', () => {
      registry.register(TestHandler)
      expect(registry.has('TEST')).toBe(true)
      expect(registry.has('Test')).toBe(true)
    })
  })

  describe('getRequiredCredentials()', () => {
    test('returns credentials for registered handler', () => {
      registry.register(TestHandler)
      expect(registry.getRequiredCredentials('test')).toEqual(['TEST_CREDENTIAL'])
    })

    test('returns multiple credentials', () => {
      registry.register(AnotherHandler)
      expect(registry.getRequiredCredentials('another')).toEqual(['CRED_A', 'CRED_B'])
    })

    test('returns undefined for unregistered handler', () => {
      expect(registry.getRequiredCredentials('nonexistent')).toBeUndefined()
    })

    test('is case-insensitive', () => {
      registry.register(TestHandler)
      expect(registry.getRequiredCredentials('TEST')).toEqual(['TEST_CREDENTIAL'])
    })
  })

  describe('getIds()', () => {
    test('returns empty array when no handlers registered', () => {
      expect(registry.getIds()).toEqual([])
    })

    test('returns all registered handler IDs', () => {
      registry.register(TestHandler)
      registry.register(AnotherHandler)

      const ids = registry.getIds()
      expect(ids).toContain('test')
      expect(ids).toContain('another')
      expect(ids).toHaveLength(2)
    })

    test('returns lowercase IDs', () => {
      registry.register(MixedCaseHandler)
      expect(registry.getIds()).toEqual(['mixed_case'])
    })
  })
})

describe('Handler interface implementation', () => {
  test('validate() returns success for valid args', () => {
    const handler = new TestHandler()
    expect(handler.validate(['--safe', 'arg']).ok).toBe(true)
  })

  test('validate() returns error for blocked args', () => {
    const handler = new TestHandler()
    expect(handler.validate(['--dangerous'])).toStrictEqual({
      ok: false,
      error: "Argument '--dangerous' is not allowed",
    })
  })

  test('execute() returns ExecutionResult', async () => {
    const handler = new TestHandler()
    const ctx: ExecutionContext = {
      args: ['arg1', 'arg2'],
      credentials: { TEST_CREDENTIAL: 'secret' },
      timeout: 5000,
    }

    const result = await handler.execute(ctx)
    expect(result).toStrictEqual({
      stdout: 'executed with 2 args',
      stderr: '',
      exitCode: 0,
    })
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
