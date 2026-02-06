import { GenericHandler } from './generic'
import type { ValidationResult } from './types'

export class GhHandler extends GenericHandler {
  static readonly requiredCredentials = ['GH_TOKEN'] as const
  readonly blockedArgs = ['auth', 'ssh-key', 'gpg-key', 'secret', 'variable', 'config'] as const

  constructor() {
    super('gh')
  }

  validate(args: readonly string[]): ValidationResult {
    const subcommand = args[0]
    if (subcommand && (this.blockedArgs as readonly string[]).includes(subcommand)) {
      return { ok: false, error: `Subcommand '${subcommand}' is not allowed` }
    }
    return { ok: true }
  }
}
