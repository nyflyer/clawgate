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
