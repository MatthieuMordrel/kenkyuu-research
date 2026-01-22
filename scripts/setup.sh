#!/bin/bash

set -e

echo "Setting up the monorepo..."

# Install dependencies
echo "Installing dependencies..."
bun install

# Initialize Convex (this will prompt for authentication)
echo ""
echo "Initializing Convex..."
echo "This will open a browser for authentication if needed."
cd packages/convex
bunx convex dev --once
cd ../..

echo ""
echo "Setup complete!"
echo ""
echo "Available commands:"
echo "  bun run dev:elysia - Start the Elysia API server"
echo "  bun run dev:web    - Start the TanStack Router web app"
echo "  bun run dev:convex - Start Convex development server"
echo ""
