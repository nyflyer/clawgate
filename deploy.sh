#!/bin/bash
# Deploy Clawgate to remote machine
# Usage: ./deploy.sh [host]

set -e

HOST="${1:-ocm}"
REMOTE_DIR="${CLAWGATE_REMOTE_DIR:-/opt/clawgate}"

echo "Deploying to $HOST..."

# Sync files (exclude node_modules, .git, .planning)
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.planning' \
  --exclude 'bun.lockb' \
  ./ "$HOST:$REMOTE_DIR/"

echo "Installing dependencies on $HOST..."
ssh "$HOST" "cd $REMOTE_DIR && bun install"

echo ""
echo "Deployed! To start Clawgate on $HOST:"
echo ""
echo "  ssh $HOST"
echo "  cd $REMOTE_DIR"
echo "  export CLAWGATE_CREDENTIALS='{\"GOG_KEYRING_PASSWORD\":\"your-password\"}'"
echo "  bun run start"
echo ""
