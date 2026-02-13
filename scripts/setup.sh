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

# Store current folder info for later renaming
CURRENT_DIR=$(pwd)
CURRENT_FOLDER=$(basename "$CURRENT_DIR")
PARENT_DIR=$(dirname "$CURRENT_DIR")
SHOULD_RENAME_FOLDER=false

if [ -n "$PROJECT_NAME" ]; then
  # Convert to lowercase, replace spaces with hyphens, strip dangerous characters
  PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9._-]//g')

  if [ -z "$PROJECT_NAME" ]; then
    echo "Invalid project name. Using 'base-repo'."
    PROJECT_NAME="base-repo"
  fi

  echo ""
  read -p "Enter package scope (leave empty to use '@$PROJECT_NAME'): " SCOPE

  if [ -z "$SCOPE" ]; then
    SCOPE="@$PROJECT_NAME"
  else
    # Ensure scope starts with @, strip dangerous characters
    SCOPE=$(echo "$SCOPE" | sed 's/[^a-zA-Z0-9@._-]//g')
    if [[ ! "$SCOPE" == @* ]]; then
      SCOPE="@$SCOPE"
    fi
  fi

  echo ""
  echo "Renaming project to '$PROJECT_NAME' with scope '$SCOPE'..."

  # Update root package.json name (inputs are sanitized to [a-z0-9._-] so safe for sed)
  sed -i "s/\"name\": \"base-repo\"/\"name\": \"$PROJECT_NAME\"/" package.json

  # Update all @repo/ scoped package names and dependencies
  find . -name "package.json" -not -path "./node_modules/*" -exec sed -i "s/@repo\//$SCOPE\//g" {} \;

  # Check if we should rename the folder
  if [ "$CURRENT_FOLDER" != "$PROJECT_NAME" ]; then
    SHOULD_RENAME_FOLDER=true
  fi

  echo "Project renamed successfully!"
fi

echo ""

# Copy .env.example files to .env
echo "Creating environment files from examples..."
if [ -f "apps/web/.env.example" ] && [ ! -f "apps/web/.env" ]; then
  cp apps/web/.env.example apps/web/.env
  echo "  Created apps/web/.env"
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

# Copy Convex URL to web app
if [ -f ".env.local" ]; then
  CONVEX_URL=$(grep "^CONVEX_URL=" .env.local | cut -d'=' -f2)
  if [ -n "$CONVEX_URL" ]; then
    cd ../../apps/web
    # Add or update VITE_CONVEX_URL in .env
    if grep -q "^VITE_CONVEX_URL=" .env 2>/dev/null; then
      sed -i "s|^VITE_CONVEX_URL=.*|VITE_CONVEX_URL=$CONVEX_URL|" .env
    else
      echo "VITE_CONVEX_URL=$CONVEX_URL" >> .env
    fi
    echo "  Added VITE_CONVEX_URL to apps/web/.env"
    cd ../..
  else
    cd ../..
  fi
else
  cd ../..
fi

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

# Rename folder if needed (do this last)
if [ "$SHOULD_RENAME_FOLDER" = true ]; then
  echo ""
  echo "Renaming folder from '$CURRENT_FOLDER' to '$PROJECT_NAME'..."
  cd "$PARENT_DIR"
  mv "$CURRENT_FOLDER" "$PROJECT_NAME"
  cd "$PROJECT_NAME"
  echo "Folder renamed successfully!"
fi

echo ""
echo "Setup complete!"
echo ""
echo "Convex is configured:"
echo "  - Deployment config: packages/convex/.env.local"
echo "  - Web app URL: apps/web/.env (VITE_CONVEX_URL)"
echo ""
echo "Next step:"
echo "  Link your remote repository:"
echo "  git remote add origin <your-repo-url>"
echo ""
echo "Available commands:"
echo "  bun run dev        - Start all services"
echo "  bun run dev:web    - Start the TanStack Router web app"
echo "  bun run dev:convex - Start Convex development server"
echo ""

# Remind user if folder was renamed
if [ "$SHOULD_RENAME_FOLDER" = true ]; then
  echo "Note: Folder was renamed. Run 'cd $PARENT_DIR/$PROJECT_NAME' if your shell lost track."
  echo ""
fi
