#!/bin/sh

# Exit on any error
set -e

echo "Starting container..."

# If a CA file path is already provided, use it as-is. Otherwise, if the
# PEM content is provided via env (e.g. a container secret), write it to a
# temporary file and point NODE_EXTRA_CA_CERTS to it so Node trusts the CA.
if [ -n "$NODE_EXTRA_CA_CERTS" ]; then
  echo "Using custom CA file from NODE_EXTRA_CA_CERTS"
elif [ -n "$REDIS_CA_PEM" ]; then
  echo "Writing REDIS_CA_PEM to /tmp/redis-ca.pem"
  printf "%s" "$REDIS_CA_PEM" > /tmp/redis-ca.pem
  export NODE_EXTRA_CA_CERTS=/tmp/redis-ca.pem
fi

# Note: Database migrations should be run separately before deployment
# This ensures the container starts quickly and doesn't fail due to migration issues
echo "Skipping migrations (run them separately via your deployment pipeline)"

echo "Starting Next.js server..."
exec node server.js 
