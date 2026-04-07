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

# Run database migrations
echo "[3/5] Running database migrations..."
npx prisma migrate deploy
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
