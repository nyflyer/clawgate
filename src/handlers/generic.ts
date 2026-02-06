import type { Handler, HandlerClass, ExecutionContext, ExecutionResult, ValidationResult } from './types'

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024 // 10MB

async function readLimited(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalSize = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalSize += value.length
    if (totalSize > maxBytes) {
      reader.cancel()
      chunks.push(value.slice(0, maxBytes - (totalSize - value.length)))
      break
    }
    chunks.push(value)
  }

  return new TextDecoder().decode(Buffer.concat(chunks))
}

export class GenericHandler implements Handler {
  readonly id: string
  readonly blockedArgs: readonly string[] = []
  static readonly requiredCredentials: readonly string[] = []

  constructor(id: string) {
    this.id = id
  }

  validate(_args: readonly string[]): ValidationResult {
    return { ok: true }
  }

  async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
    const extraPaths = [
      '/home/linuxbrew/.linuxbrew/bin',
      '/home/linuxbrew/.linuxbrew/sbin',
      '/usr/local/bin',
    ]
    const PATH = [...extraPaths, process.env.PATH].filter(Boolean).join(':')

    const proc = Bun.spawn([this.id, ...ctx.args], {
      env: {
        PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        TERM: process.env.TERM || 'xterm-256color',
        ...ctx.credentials,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    let timeoutId: Timer | undefined

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        proc.kill('SIGKILL')
        reject(new Error('Command timed out'))
      }, ctx.timeout)
    })

    const exitCode = await Promise.race([proc.exited, timeoutPromise]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId)
    })

    const stdout = await readLimited(proc.stdout, MAX_OUTPUT_BYTES)
    const stderr = await readLimited(proc.stderr, MAX_OUTPUT_BYTES)

    return { stdout, stderr, exitCode }
  }
}

export function createGenericHandlerClass(id: string, credentialKeys: readonly string[]): HandlerClass {
  return class extends GenericHandler {
    static readonly requiredCredentials = credentialKeys
    constructor() { super(id) }
  } as HandlerClass
}
