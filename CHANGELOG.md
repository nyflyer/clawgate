# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Handler abstraction layer for extensible multi-tool support (v0.2 Phase 1)
  - `Handler` interface with `id`, `execute()`, `validate()`, `blockedArgs`
  - `HandlerClass` type for static `requiredCredentials` property
  - `ValidationResult` discriminated union for type-safe validation
  - `ExecutionContext` and `ExecutionResult` types
  - `HandlerRegistry` class with register/get/has/getRequiredCredentials/getIds
  - Case-insensitive handler ID lookup
  - Duplicate registration detection (fail-fast)
- Handler registry test suite (21 tests)

## [0.1.1] - 2026-02-01

### Fixed

- Shim now uses `printf '%s'` instead of `echo` to prevent escape sequence expansion (e.g., `\n` in output no longer becomes actual newlines)

### Added

- Shell-based unit tests for gog shim (`shim/gog.test.sh`) with curl mocking
- Escape sequence tests in `src/index.test.ts` (multiline, tabs, backslashes, quotes, JSON special chars)
- CI pipeline (`.github/workflows/ci.yml`) with bun tests, shim tests, and ShellCheck
- New npm scripts: `test:shim`, `test:all`

## [0.1.0] - 2026-02-01

### Added

- HTTP proxy server using Hono framework on Bun runtime
- `POST /v1/exec` endpoint for proxied command execution
- `GET /healthz` health check endpoint
- Command execution with credential injection via environment variables
- Operation allowlist with deny-by-default security model
- Configurable via environment variables:
  - `CLAWGATE_PORT` - Server port (default: 9876)
  - `CLAWGATE_HOST` - Bind address (default: 0.0.0.0)
  - `CLAWGATE_CREDENTIALS` - JSON object of env vars to inject
  - `CLAWGATE_ALLOWLIST` - Comma-separated allowed commands
  - `CLAWGATE_AUTH_TOKEN` - Optional bearer token for auth
- Shell shim script (`shim/gog`) for transparent command proxying in sandboxes
- Linuxbrew path support for tools installed via Homebrew
- Deploy script for rsync-based deployment
- Install script for copying shims into Docker containers
- Test suite with 6 passing tests

### Security

- Credentials never enter the sandbox environment
- Commands executed via `Bun.spawn` with args array (no shell injection)
- Subprocess environment sanitized (CLAWGATE_* vars stripped)
- 30-second command timeout with SIGKILL enforcement

### Known Limitations

- No rate limiting (DoS protection planned for v1.1)
- Output limited to 10MB per stream

[Unreleased]: https://github.com/nyflyer/clawgate/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/nyflyer/clawgate/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/nyflyer/clawgate/releases/tag/v0.1.0
