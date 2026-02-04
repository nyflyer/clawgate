/**
 * Credential provider type definitions for Clawgate v0.2
 *
 * These types define the contract for credential providers.
 * Providers implement the CredentialProvider interface.
 */

/**
 * Result of credential lookup.
 * Discriminated union for type-safe success/failure handling.
 */
export type CredentialResult =
  | { readonly ok: true; readonly credentials: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly missing: readonly string[] }

/**
 * Provider interface for credential access.
 * Implementations load credentials from various sources (env, vault, etc.)
 */
export interface CredentialProvider {
  /**
   * Get a single credential by key.
   * @param key - Credential key (case-sensitive, matches env var name)
   * @returns Credential value or undefined if not found
   */
  get(key: string): string | undefined

  /**
   * Get multiple credentials by key.
   * All-or-nothing: returns error with ALL missing keys if any are missing.
   * @param keys - Credential keys to fetch
   * @returns Success with credential map, or failure with missing keys list
   */
  getMany(keys: readonly string[]): CredentialResult

  /**
   * Check if a credential exists.
   * @param key - Credential key to check
   * @returns true if credential is defined (including empty string)
   */
  has(key: string): boolean
}
