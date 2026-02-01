#!/bin/bash
# Install Clawgate shim in a Docker container
# Usage: ./install-shim.sh <container_name>

set -e

CONTAINER="${1:-}"
SHIM_DIR="$(dirname "$0")/shim"

if [ -z "$CONTAINER" ]; then
  echo "Usage: $0 <container_name>"
  echo ""
  echo "Available containers:"
  docker ps --format '  {{.Names}}'
  exit 1
fi

# Verify container exists and is running
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: Container '$CONTAINER' does not exist or is not running" >&2
  echo ""
  echo "Available containers:"
  docker ps --format '  {{.Names}}'
  exit 1
fi

# Verify shim exists
if [ ! -f "$SHIM_DIR/gog" ]; then
  echo "ERROR: Shim file not found at $SHIM_DIR/gog" >&2
  exit 1
fi

echo "Installing gog shim in container: $CONTAINER"

# Copy shim to container
docker cp "$SHIM_DIR/gog" "$CONTAINER:/usr/local/bin/gog"
docker exec "$CONTAINER" chmod +x /usr/local/bin/gog

echo ""
echo "Shim installed! Now set environment in container:"
echo ""
echo "  docker exec -it $CONTAINER sh"
echo "  export CLAWGATE_URL=http://host.docker.internal:9876"
echo "  gog gmail search 'is:unread'  # Test it!"
echo ""
