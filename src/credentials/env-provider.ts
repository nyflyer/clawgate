/**
 * EnvCredentialProvider - Credential provider for environment variables
 *
 * Reads credentials directly from process.env.
 * Direct mapping: credential key matches env var name exactly.
 */

import type { CredentialProvider, CredentialResult } from './types'

/**
 * Credential provider that reads from process.env.
 * Direct mapping: credential key matches env var name exactly.
 */
export class EnvCredentialProvider implements CredentialProvider {
  /**
   * Get a single credential by key.
   * @param key - Credential key (case-sensitive, matches env var name)
   * @returns Credential value or undefined if not found
   */
  get(key: string): string | undefined {
    return process.env[key]
  }

  /**
   * Get multiple credentials by key.
   * All-or-nothing: returns error with ALL missing keys if any are missing.
   * @param keys - Credential keys to fetch
   * @returns Success with credential map, or failure with missing keys list
   */
  getMany(keys: readonly string[]): CredentialResult {
    // Collect ALL missing keys (not just first) - uses === undefined to allow empty strings
    const missing = keys.filter(key => process.env[key] === undefined)

    if (missing.length > 0) {
      return { ok: false, missing }
    }

    // Build credential map
    const credentials: Record<string, string> = {}
    for (const key of keys) {
      credentials[key] = process.env[key]! // Safe: already checked above
    }

    return { ok: true, credentials }
  }

  /**
   * Check if a credential exists.
   * @param key - Credential key to check
   * @returns true if credential is defined (including empty string)
   */
  has(key: string): boolean {
    return process.env[key] !== undefined
  }
}
