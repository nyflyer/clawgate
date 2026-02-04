/**
 * Credential provider type definitions for Clawgate v0.2
 */

/** Result of credential lookup (success with credentials or failure with missing keys). */
export type CredentialResult =
  | { readonly ok: true; readonly credentials: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly missing: readonly string[] }

/**
 * Provider interface for credential access.
 * Implementations load credentials from various sources (env, vault, etc.)
 */
export interface CredentialProvider {
  /** Get a single credential by key. */
  get(key: string): string | undefined

  /** Get multiple credentials. All-or-nothing: fails with ALL missing keys if any are missing. */
  getMany(keys: readonly string[]): CredentialResult

  /** Check if a credential exists (including empty string). */
  has(key: string): boolean
}
