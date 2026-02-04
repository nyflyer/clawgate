/**
 * HandlerRegistry - Central registry for tool handlers
 *
 * Stores handler instances and provides lookup by command name.
 * Used by the server to dispatch requests to the correct handler.
 */

import type { Handler, HandlerClass } from './types'

/**
 * Registry for handler instances.
 * Provides registration, lookup, and credential queries.
 */
export class HandlerRegistry {
  /** Handler instances indexed by lowercase ID */
  private handlers = new Map<string, Handler>()
  /** Handler classes indexed by lowercase ID (for credential lookup) */
  private handlerClasses = new Map<string, HandlerClass>()

  /**
   * Register a handler class.
   * @param handlerClass - The handler class to register
   * @throws Error if handler ID is already registered
   */
  register(handlerClass: HandlerClass): void {
    const handler = new handlerClass()
    const id = handler.id.toLowerCase()
    if (this.handlers.has(id)) {
      throw new Error(`Handler '${id}' already registered`)
    }
    this.handlers.set(id, handler)
    this.handlerClasses.set(id, handlerClass)
  }

  /**
   * Get a handler by ID.
   * @param id - Handler ID (case-insensitive)
   * @returns Handler instance or undefined if not found
   */
  get(id: string): Handler | undefined {
    return this.handlers.get(id.toLowerCase())
  }

  /**
   * Check if a handler is registered.
   * @param id - Handler ID (case-insensitive)
   * @returns true if handler exists
   */
  has(id: string): boolean {
    return this.handlers.has(id.toLowerCase())
  }

  /**
   * Get required credentials for a handler.
   * @param id - Handler ID (case-insensitive)
   * @returns Array of credential names or undefined if handler not found
   */
  getRequiredCredentials(id: string): readonly string[] | undefined {
    const handlerClass = this.handlerClasses.get(id.toLowerCase())
    return handlerClass?.requiredCredentials
  }

  /**
   * Get all registered handler IDs.
   * @returns Array of handler IDs
   */
  getIds(): string[] {
    return Array.from(this.handlers.keys())
  }
}
