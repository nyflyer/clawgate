/**
 * CurlHandler - Concrete handler for the curl CLI tool
 *
 * Extends GenericHandler with:
 * - CURL_AUTH_TOKEN credential requirement
 * - Comprehensive blocked flags: file write, upload, data exfiltration, config/credential
 *   file access, TLS manipulation, verbose modes (leak injected auth), shared library
 *   loading, and arbitrary write-out
 * - Rejects file:// URLs (case-insensitive) to prevent local file access
 * - Overrides execute() to inject Authorization Bearer header when CURL_AUTH_TOKEN is present
 *
 * This is the only handler that overrides execute() -- curl does not read auth from
 * environment variables, so the token must be injected as a -H flag.
 */

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
      // Check for file:// protocol URLs (case-insensitive)
      if (arg.toLowerCase().startsWith('file://')) {
        return { ok: false, error: 'file:// URLs are not allowed' }
      }

      // Check against blocked flags (exact match or prefix with =)
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

    const augmentedArgs = token
      ? ['-H', `Authorization: Bearer ${token}`, ...ctx.args]
      : [...ctx.args]

    return super.execute({ ...ctx, args: augmentedArgs })
  }
}
