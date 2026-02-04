/**
 * Handler type definitions for Clawgate v0.2
 *
 * Handlers implement the Handler interface and are registered with HandlerRegistry.
 */

/** Result of argument validation (success or failure with error message). */
export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

/** Context passed to handler execution. */
export interface ExecutionContext {
  readonly args: readonly string[]
  readonly credentials: Readonly<Record<string, string>>
  readonly timeout: number
}

/** Result of command execution. */
export interface ExecutionResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

/** Handler interface that all tool handlers must implement. */
export interface Handler {
  readonly id: string
  readonly blockedArgs: readonly string[]
  validate(args: readonly string[]): ValidationResult
  execute(ctx: ExecutionContext): Promise<ExecutionResult>
}

/** Constructor type for handler classes. Used by HandlerRegistry. */
export interface HandlerClass {
  new (): Handler
  readonly requiredCredentials: readonly string[]
}
