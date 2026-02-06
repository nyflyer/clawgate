/**
 * GhHandler - Concrete handler for the GitHub CLI (gh)
 *
 * Extends GenericHandler with:
 * - GH_TOKEN credential requirement
 * - Blocks credential-exposing subcommands (auth, ssh-key, gpg-key, secret, variable, config)
 *
 * Validation checks only the first argument (positional subcommand) since gh uses
 * subcommand routing (e.g., `gh auth token`, `gh pr list`). Exact match only --
 * subcommands are words, not flags with `=` values.
 *
 * Does not override execute() -- gh reads GH_TOKEN from env, which GenericHandler
 * passes through via ctx.credentials.
 */

import { GenericHandler } from './generic'
import type { ValidationResult } from './types'

export class GhHandler extends GenericHandler {
  static readonly requiredCredentials = ['GH_TOKEN'] as const
  readonly blockedArgs = ['auth', 'ssh-key', 'gpg-key', 'secret', 'variable', 'config'] as const

  constructor() {
    super('gh')
  }

  validate(args: readonly string[]): ValidationResult {
    if (args.length > 0) {
      const subcommand = args[0]
      for (const blocked of this.blockedArgs) {
        if (subcommand === blocked) {
          return { ok: false, error: `Subcommand '${blocked}' is not allowed` }
        }
      }
    }
    return { ok: true }
  }
}
