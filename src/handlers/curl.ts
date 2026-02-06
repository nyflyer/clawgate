import { GenericHandler } from './generic'
import type { ExecutionContext, ExecutionResult, ValidationResult } from './types'

export class CurlHandler extends GenericHandler {
  static readonly requiredCredentials = ['CURL_AUTH_TOKEN'] as const

  readonly blockedArgs = [
    // File write
    '-o', '--output',
    '-O', '--remote-name',
    // File upload / data exfiltration
    '-T', '--upload-file',
    '-F', '--form',
    '-d', '--data', '--data-raw', '--data-binary', '--data-urlencode',
    // Config/credential file access
    '-K', '--config',
    '--netrc', '--netrc-file', '--netrc-optional',
    // TLS/cert manipulation
    '-k', '--insecure',
    '--cert', '--key',
    '--cacert', '--capath',
    // Verbose modes that leak injected auth headers
    '-v', '--verbose',
    '--trace', '--trace-ascii', '--trace-time',
    // Shared library loading (code execution)
    '--engine',
    // Arbitrary write-out (can expose internals)
    '-w', '--write-out',
  ] as const

  constructor() {
    super('curl')
  }

  validate(args: readonly string[]): ValidationResult {
    for (const arg of args) {
      if (arg.toLowerCase().startsWith('file://')) {
        return { ok: false, error: 'file:// URLs are not allowed' }
      }

      for (const blocked of this.blockedArgs) {
        if (arg === blocked || arg.startsWith(blocked + '=')) {
          return { ok: false, error: `Argument '${blocked}' is not allowed` }
        }
      }
    }
    return { ok: true }
  }

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    const token = ctx.credentials['CURL_AUTH_TOKEN']
    if (!token) return super.execute(ctx)

    const args = ['-H', `Authorization: Bearer ${token}`, ...ctx.args]
    return super.execute({ ...ctx, args })
  }
}
