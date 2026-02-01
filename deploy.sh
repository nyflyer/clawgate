#!/bin/bash
# Deploy Clawgate to remote machine
# Usage: ./deploy.sh [host]

set -euo pipefail

HOST="${1:-ocm}"
REMOTE_DIR="${CLAWGATE_REMOTE_DIR:-/opt/clawgate}"

echo "Deploying to $HOST..."

# Verify SSH connectivity
if ! ssh -q -o ConnectTimeout=5 "$HOST" exit 2>/dev/null; then
  echo "ERROR: Cannot connect to $HOST via SSH" >&2
  exit 1
fi

# Sync files (exclude node_modules, .git, .planning)
if ! rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.planning' \
  --exclude 'bun.lockb' \
  ./ "$HOST:$REMOTE_DIR/"; then
  echo "ERROR: Failed to sync files to $HOST" >&2
  exit 1
fi

echo "Installing dependencies on $HOST..."
if ! ssh "$HOST" "cd $REMOTE_DIR && bun install"; then
  echo "ERROR: Failed to install dependencies on $HOST" >&2
  exit 1
fi

echo ""
echo "Deployed! To start Clawgate on $HOST:"
echo ""
echo "  ssh $HOST"
echo "  cd $REMOTE_DIR"
echo "  export CLAWGATE_CREDENTIALS='{\"GOG_KEYRING_PASSWORD\":\"your-password\"}'"
echo "  bun run start"
echo ""
