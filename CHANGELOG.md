# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/nyflyer/clawgate/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nyflyer/clawgate/releases/tag/v0.1.0
