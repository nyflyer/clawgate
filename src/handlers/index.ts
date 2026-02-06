/**
 * Handler module public API
 *
 * Re-exports types and registry for use by other modules.
 */

export type {
  Handler,
  HandlerClass,
  ExecutionContext,
  ExecutionResult,
  ValidationResult,
} from './types'

export { HandlerRegistry } from './registry'

export { GenericHandler, createGenericHandlerClass } from './generic'

export { GogHandler } from './gog'
