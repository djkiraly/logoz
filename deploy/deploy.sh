#!/bin/bash
# Quick deployment script - pull, build, and reload
#
# Usage: ./deploy/deploy.sh
# Run from the project root (/var/www/logoz)

set -euo pipefail

APP_DIR="/var/www/logoz"
cd "$APP_DIR"

echo "Deploying Logoz..."

# Pull latest changes
echo "[1/5] Pulling latest code..."
git pull origin main

# Install dependencies (if changed)
echo "[2/5] Installing dependencies..."
npm ci --production=false

# Sync the database schema. This project manages its schema with `prisma db
# push` (there is no prisma/migrations directory), so `migrate deploy` would be
# a no-op and silently skip schema changes. db push is idempotent.
echo "[3/5] Syncing database schema..."
npx prisma db push
npx prisma generate

# Build
echo "[4/5] Building application..."
npm run build

# Reload PM2 (zero downtime)
echo "[5/5] Reloading PM2..."
pm2 reload ecosystem.config.cjs

VERSION=$(node -p "require('./package.json').version")
echo ""
echo "Deployed v${VERSION} successfully!"
echo ""
