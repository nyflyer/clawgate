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
  /** Get a single credential by key. */
  get(key: string): string | undefined {
    return process.env[key]
  }

  /**
   * Get multiple credentials by key.
   * All-or-nothing: returns error with ALL missing keys if any are missing.
   */
  getMany(keys: readonly string[]): CredentialResult {
    const missing = keys.filter(key => process.env[key] === undefined)

    if (missing.length > 0) {
      return { ok: false, missing }
    }

    const credentials = Object.fromEntries(
      keys.map(key => [key, process.env[key]!])
    )
    return { ok: true, credentials }
  }

  /** Check if a credential exists (including empty string). */
  has(key: string): boolean {
    return process.env[key] !== undefined
  }
}
