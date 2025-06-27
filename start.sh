#!/bin/sh

# Exit on any error
set -e

echo "Starting container..."

# Note: Database migrations should be run separately before deployment
# This ensures the container starts quickly and doesn't fail due to migration issues
echo "Skipping migrations (run them separately via your deployment pipeline)"

echo "Starting Next.js server..."
exec node server.js 
