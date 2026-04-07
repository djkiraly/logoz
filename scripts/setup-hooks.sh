#!/bin/bash
# Install git hooks for this project
# Run once after cloning: bash scripts/setup-hooks.sh

HOOK_DIR=".git/hooks"
SCRIPT_DIR="scripts/hooks"

if [ ! -d "$HOOK_DIR" ]; then
  echo "Error: Not in a git repository root"
  exit 1
fi

cp "$SCRIPT_DIR/pre-commit" "$HOOK_DIR/pre-commit"
chmod +x "$HOOK_DIR/pre-commit"

echo "Git hooks installed successfully."
