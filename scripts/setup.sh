#!/bin/bash

set -e

echo "Setting up the monorepo..."
echo ""

# Ask for project name
read -p "Enter project name (leave empty to keep 'base-repo'): " PROJECT_NAME

if [ -n "$PROJECT_NAME" ]; then
  # Convert to lowercase and replace spaces with hyphens
  PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

  echo ""
  read -p "Enter package scope (leave empty to use '@$PROJECT_NAME'): " SCOPE

  if [ -z "$SCOPE" ]; then
    SCOPE="@$PROJECT_NAME"
  else
    # Ensure scope starts with @
    if [[ ! "$SCOPE" == @* ]]; then
      SCOPE="@$SCOPE"
    fi
  fi

  echo ""
  echo "Renaming project to '$PROJECT_NAME' with scope '$SCOPE'..."

  # Update root package.json name
  sed -i "s/\"name\": \"base-repo\"/\"name\": \"$PROJECT_NAME\"/" package.json

  # Update all @repo/ scoped package names and dependencies
  find . -name "package.json" -not -path "./node_modules/*" -exec sed -i "s/@repo\//$SCOPE\//g" {} \;

  echo "Project renamed successfully!"
fi

echo ""

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
