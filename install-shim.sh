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
