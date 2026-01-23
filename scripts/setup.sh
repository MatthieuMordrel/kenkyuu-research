#!/bin/bash

set -e

echo "Setting up the monorepo..."
echo ""

# Remove the template remote so user can link their own repo
if git remote get-url origin &>/dev/null; then
  echo "Unlinking template remote repository..."
  git remote remove origin
  echo "Remote 'origin' removed. You can now link your own repo with:"
  echo "  git remote add origin <your-repo-url>"
  echo ""
fi

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

# Copy .env.example files to .env
echo "Creating environment files from examples..."
if [ -f "apps/web/.env.example" ] && [ ! -f "apps/web/.env" ]; then
  cp apps/web/.env.example apps/web/.env
  echo "  Created apps/web/.env"
fi
if [ -f "apps/elysia/.env.example" ] && [ ! -f "apps/elysia/.env" ]; then
  cp apps/elysia/.env.example apps/elysia/.env
  echo "  Created apps/elysia/.env"
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

# Reset git history to start fresh
echo ""
read -p "Reset git history to a fresh 'Initial commit'? (y/N): " RESET_GIT
if [[ "$RESET_GIT" =~ ^[Yy]$ ]]; then
  echo "Resetting git history..."
  rm -rf .git
  git init
  git add -A
  git commit -m "Initial commit"
  echo "Git history reset. You have a fresh start!"
fi

echo ""
echo "Setup complete!"
echo ""
echo "Convex deployment URL is automatically configured in packages/convex/.env.local"
echo ""
echo "Next step:"
echo "  Link your remote repository:"
echo "  git remote add origin <your-repo-url>"
echo ""
echo "Available commands:"
echo "  bun run dev        - Start all services"
echo "  bun run dev:elysia - Start the Elysia API server"
echo "  bun run dev:web    - Start the TanStack Router web app"
echo "  bun run dev:convex - Start Convex development server"
echo ""
