#!/bin/bash
# Quick deployment script - pull, build, reload, and verify the web tier.
#
# Usage: ./deploy/deploy.sh
# Run from the project root (/var/www/logoz)
#
# Optional environment overrides:
#   APP_DIR     - application directory (default: /var/www/logoz)
#   PM2_APP     - PM2 app name (default: logoz; must match ecosystem.config.cjs)
#   NGINX_SITE  - path to the active nginx server config used for the cert check
#                 (default: /etc/nginx/sites-available/logoz)

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/logoz}"
PM2_APP="${PM2_APP:-logoz}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/logoz}"
cd "$APP_DIR"

# Resolve the app's listen port from .env (multiple sites share this host, so it
# may not be the default 3000). Used to keep the nginx upstream in sync.
APP_PORT="$(grep -E '^\s*PORT\s*=' .env 2>/dev/null | tail -n1 | sed -E 's/^\s*PORT\s*=\s*"?([0-9]+)"?.*/\1/')"
APP_PORT="${APP_PORT:-3000}"

# Use sudo for privileged commands only when not already root.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

echo "Deploying Logoz..."

# Pull latest changes
echo "[1/6] Pulling latest code..."
git pull origin main

# Install dependencies (if changed)
echo "[2/6] Installing dependencies..."
npm ci --production=false

# Sync the database schema. This project manages its schema with `prisma db
# push` (there is no prisma/migrations directory), so `migrate deploy` would be
# a no-op and silently skip schema changes. db push is idempotent.
echo "[3/6] Syncing database schema..."
npx prisma db push
npx prisma generate

# Build
echo "[4/6] Building application..."
npm run build

# Reload (or start) the application under PM2.
#
# Reloading by app name when it already exists keeps the deploy idempotent and
# prevents duplicate app entries from accumulating across deploys. Note that
# ecosystem.config.cjs uses cluster mode with `instances: 'max'`, so a healthy
# deploy shows one worker PER CPU CORE under the single "${PM2_APP}" app — that
# is expected, not a duplicate.
echo "[5/6] Reloading application (PM2)..."
if pm2 describe "$PM2_APP" > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

# Validate the nginx configuration and TLS certificates, then reload nginx.
#
# `nginx -t` already fails if a referenced certificate file is missing, but we
# check the cert paths explicitly first to produce a clearer, actionable error.
echo "[6/6] Validating nginx configuration and TLS certificates..."

if [ -f "$NGINX_SITE" ]; then
  # Keep the nginx upstream port in sync with the app's PORT (.env). The only
  # 127.0.0.1:<port> reference in the config is the upstream backend.
  if ! grep -q "server 127.0.0.1:${APP_PORT};" "$NGINX_SITE"; then
    echo "  Updating nginx upstream to 127.0.0.1:${APP_PORT}"
    # [0-9]* (not +) so a previously-malformed/empty port line also self-heals.
    $SUDO sed -i -E "s|server 127\.0\.0\.1:[0-9]*;|server 127.0.0.1:${APP_PORT};|" "$NGINX_SITE"
  fi

  cert_missing=0
  # Extract every ssl_certificate / ssl_certificate_key path (ignores comments).
  while IFS= read -r cert; do
    [ -z "$cert" ] && continue
    if [ ! -f "$cert" ]; then
      echo "  ERROR: TLS certificate file not found: $cert"
      cert_missing=1
    fi
  done < <(grep -hoP '^\s*ssl_certificate(_key)?\s+\K[^;]+' "$NGINX_SITE" 2>/dev/null | tr -d ' ' | sort -u)

  if [ "$cert_missing" -ne 0 ]; then
    echo "  One or more certificates are missing. Issue/renew them with:"
    echo "    $SUDO certbot --nginx -d <domain> -d www.<domain>"
    echo "  (see deploy/setup-ssl.sh). Skipping nginx reload."
    exit 1
  fi
  echo "  TLS certificate files present."
else
  echo "  WARNING: $NGINX_SITE not found; relying on 'nginx -t' for cert validation."
fi

# Validate the full nginx config before reloading; never reload a broken config.
if $SUDO nginx -t; then
  $SUDO systemctl reload nginx
  echo "  nginx configuration valid and reloaded."
else
  echo "  ERROR: nginx configuration test failed. Not reloading nginx."
  exit 1
fi

echo ""
echo "Current PM2 processes:"
pm2 list

VERSION=$(node -p "require('./package.json').version")
echo ""
echo "Deployed v${VERSION} successfully!"
echo ""
