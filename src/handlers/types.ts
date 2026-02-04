/**
 * Handler type definitions for Clawgate v0.2
 *
 * These types define the contract for all tool handlers (gog, gh, curl, etc.)
 * Handlers implement the Handler interface and are registered with HandlerRegistry.
 */

/**
 * Result of argument validation.
 * Discriminated union for type-safe success/failure handling.
 */
export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

/**
 * Context passed to handler execution.
 * Contains arguments, credentials, and execution constraints.
 */
export interface ExecutionContext {
  /** Command arguments (excluding the command name itself) */
  readonly args: readonly string[]
  /** Credential key-value pairs to inject into environment */
  readonly credentials: Readonly<Record<string, string>>
  /** Timeout in milliseconds for command execution */
  readonly timeout: number
}

/**
 * Result of command execution.
 * Contains stdout, stderr, and exit code.
 */
export interface ExecutionResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

/**
 * Handler interface that all tool handlers must implement.
 * Each handler wraps a specific CLI tool (gog, gh, curl, etc.)
 */
export interface Handler {
  /** Handler ID (command name, lowercase) */
  readonly id: string
  /** Arguments to reject for security reasons */
  readonly blockedArgs: readonly string[]
  /** Validate command arguments before execution */
  validate(args: readonly string[]): ValidationResult
  /** Execute the command with injected credentials */
  execute(ctx: ExecutionContext): Promise<ExecutionResult>
}

/**
 * Constructor type for handler classes.
 * Used by HandlerRegistry for instantiation and credential lookup.
 */
export interface HandlerClass {
  /** Constructor that creates a Handler instance */
  new (): Handler
  /** Static property listing required credential environment variable names */
  readonly requiredCredentials: readonly string[]
}
