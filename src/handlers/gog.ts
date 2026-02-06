/**
 * GogHandler - Concrete handler for the gog CLI tool
 *
 * Extends GenericHandler with:
 * - GOG_KEYRING_PASSWORD credential requirement
 * - Blocks --keyring-password argument to prevent credential override
 */

import { GenericHandler } from './generic'
import type { ValidationResult } from './types'

export class GogHandler extends GenericHandler {
  static readonly requiredCredentials = ['GOG_KEYRING_PASSWORD'] as const
  readonly blockedArgs = ['--keyring-password'] as const

  constructor() {
    super('gog')
  }

  validate(args: readonly string[]): ValidationResult {
    for (const arg of args) {
      for (const blocked of this.blockedArgs) {
        if (arg === blocked || arg.startsWith(blocked + '=')) {
          return { ok: false, error: `Argument '${blocked}' is not allowed` }
        }
      }
    }
    return { ok: true }
  }
}
