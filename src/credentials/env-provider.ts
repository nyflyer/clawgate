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
  get(key: string): string | undefined {
    // TODO: Implement in GREEN phase
    throw new Error('Not implemented')
  }

  getMany(keys: readonly string[]): CredentialResult {
    // TODO: Implement in GREEN phase
    throw new Error('Not implemented')
  }

  has(key: string): boolean {
    // TODO: Implement in GREEN phase
    throw new Error('Not implemented')
  }
}
