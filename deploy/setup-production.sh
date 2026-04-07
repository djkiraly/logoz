#!/bin/bash
# Production Deployment Script for Logoz Cloud Print Studio
# Sets up: Node.js, PM2, nginx, certbot (Let's Encrypt SSL)
#
# Usage: ./deploy/setup-production.sh <domain> [email]
# Example: ./deploy/setup-production.sh logoz.com admin@logoz.com
#
# Prerequisites:
#   - Ubuntu/Debian server with root or sudo access
#   - DNS A record pointing to this server's IP
#   - Port 80 and 443 open in firewall

set -euo pipefail

DOMAIN=${1:-}
EMAIL=${2:-"admin@${DOMAIN}"}
APP_DIR="/var/www/logoz"
LOG_DIR="/var/log/logoz"
NODE_VERSION="20"

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./deploy/setup-production.sh <domain> [email]"
    echo "Example: ./deploy/setup-production.sh logoz.com admin@logoz.com"
    exit 1
fi

echo "============================================"
echo "Logoz Production Setup"
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo "App:    $APP_DIR"
echo "============================================"
echo ""

# ------------------------------------------
# 1. System dependencies
# ------------------------------------------
echo "[1/7] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl git build-essential

# ------------------------------------------
# 2. Node.js (via NodeSource)
# ------------------------------------------
echo "[2/7] Installing Node.js ${NODE_VERSION}..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt $NODE_VERSION ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash -
    sudo apt-get install -y -qq nodejs
fi
echo "Node: $(node -v), npm: $(npm -v)"

# ------------------------------------------
# 3. PM2
# ------------------------------------------
echo "[3/7] Installing PM2..."
sudo npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# ------------------------------------------
# 4. Application setup
# ------------------------------------------
echo "[4/7] Setting up application directory..."
sudo mkdir -p "$APP_DIR" "$LOG_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR" "$LOG_DIR"

if [ ! -f "$APP_DIR/package.json" ]; then
    echo "  Cloning or copying application to $APP_DIR..."
    echo "  (Copy your project files to $APP_DIR, then re-run this script)"
    echo "  Example: rsync -avz --exclude node_modules --exclude .next . $APP_DIR/"
fi

# ------------------------------------------
# 5. nginx
# ------------------------------------------
echo "[5/7] Installing and configuring nginx..."
sudo apt-get install -y -qq nginx

# Replace domain placeholder in nginx config
NGINX_CONF="/etc/nginx/sites-available/logoz"
sudo cp deploy/nginx.conf "$NGINX_CONF"
sudo sed -i "s/yourdomain.com/$DOMAIN/g" "$NGINX_CONF"

# Enable site, disable default
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/logoz
sudo rm -f /etc/nginx/sites-enabled/default

# Remove SSL directives temporarily (certbot will add them)
sudo sed -i '/ssl_certificate/d' "$NGINX_CONF"
sudo sed -i '/ssl_stapling/d' "$NGINX_CONF"
# Comment out the HTTPS server blocks and www redirect for initial setup
# Certbot will handle the SSL configuration

# Create a minimal HTTP-only config for initial certbot run
sudo tee /etc/nginx/sites-available/logoz-initial > /dev/null <<NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

# Use initial config first
sudo ln -sf /etc/nginx/sites-available/logoz-initial /etc/nginx/sites-enabled/logoz
sudo mkdir -p /var/www/certbot

sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx
echo "  nginx installed and running (HTTP only)"

# ------------------------------------------
# 6. Certbot (Let's Encrypt SSL)
# ------------------------------------------
echo "[6/7] Installing certbot and obtaining SSL certificate..."
sudo apt-get install -y -qq certbot python3-certbot-nginx

echo "  Obtaining certificate for $DOMAIN..."
sudo certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

# Now switch to the full nginx config (certbot has added SSL)
sudo ln -sf /etc/nginx/sites-available/logoz /etc/nginx/sites-enabled/logoz
sudo rm -f /etc/nginx/sites-available/logoz-initial

# Re-apply domain replacements (certbot may have modified the file)
sudo sed -i "s/yourdomain.com/$DOMAIN/g" /etc/nginx/sites-available/logoz

sudo nginx -t && sudo systemctl reload nginx

# Setup auto-renewal
echo "0 3 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" | sudo tee /etc/cron.d/certbot-renew > /dev/null
echo "  SSL certificate obtained and auto-renewal configured"

# ------------------------------------------
# 7. PM2 startup
# ------------------------------------------
echo "[7/7] Configuring PM2 startup..."
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | sudo bash

echo ""
echo "============================================"
echo "Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Copy your app to $APP_DIR:"
echo "     rsync -avz --exclude node_modules --exclude .next . $APP_DIR/"
echo ""
echo "  2. Install dependencies and build:"
echo "     cd $APP_DIR"
echo "     cp .env.example .env   # Edit with your values"
echo "     npm install"
echo "     npx prisma migrate deploy"
echo "     npm run build"
echo ""
echo "  3. Start with PM2:"
echo "     pm2 start ecosystem.config.cjs"
echo "     pm2 save"
echo ""
echo "  4. Visit https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  pm2 status          - View process status"
echo "  pm2 logs logoz      - View application logs"
echo "  pm2 restart logoz   - Restart application"
echo "  pm2 reload logoz    - Zero-downtime reload"
echo "  pm2 monit           - Real-time monitoring"
echo ""
