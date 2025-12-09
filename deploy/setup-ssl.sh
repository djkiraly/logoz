#!/bin/bash
# SSL Setup Script for Logoz Cloud Print Studio
# This script sets up Let's Encrypt SSL with either Caddy or nginx + certbot
#
# Usage: ./setup-ssl.sh <domain> [caddy|nginx]
# Example: ./setup-ssl.sh logoz.com caddy

set -e

DOMAIN=$1
METHOD=${2:-caddy}

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./setup-ssl.sh <domain> [caddy|nginx]"
    echo "Example: ./setup-ssl.sh logoz.com caddy"
    exit 1
fi

echo "Setting up SSL for $DOMAIN using $METHOD..."

# Update Caddyfile or nginx.conf with the domain
update_configs() {
    sed -i "s/yourdomain.com/$DOMAIN/g" deploy/Caddyfile
    sed -i "s/yourdomain.com/$DOMAIN/g" deploy/nginx.conf
    echo "Updated configuration files with domain: $DOMAIN"
}

# Setup with Caddy (recommended - automatic SSL)
setup_caddy() {
    echo "Installing Caddy..."

    # Detect OS and install Caddy
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
        sudo apt-get update
        sudo apt-get install -y caddy
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y yum-plugin-copr
        sudo yum copr enable @caddy/caddy
        sudo yum install -y caddy
    else
        echo "Please install Caddy manually: https://caddyserver.com/docs/install"
        exit 1
    fi

    # Copy Caddyfile
    sudo cp deploy/Caddyfile /etc/caddy/Caddyfile

    # Start Caddy
    sudo systemctl enable caddy
    sudo systemctl restart caddy

    echo "Caddy installed and running!"
    echo "SSL certificate will be automatically obtained for $DOMAIN"
}

# Setup with nginx + certbot
setup_nginx() {
    echo "Installing nginx and certbot..."

    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y nginx certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y nginx certbot python3-certbot-nginx
    else
        echo "Please install nginx and certbot manually"
        exit 1
    fi

    # Copy nginx config
    sudo cp deploy/nginx.conf /etc/nginx/sites-available/logoz
    sudo ln -sf /etc/nginx/sites-available/logoz /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default

    # Test nginx config
    sudo nginx -t

    # Start nginx
    sudo systemctl enable nginx
    sudo systemctl restart nginx

    # Create certbot webroot directory
    sudo mkdir -p /var/www/certbot

    # Obtain certificate
    echo "Obtaining SSL certificate..."
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

    # Setup auto-renewal
    echo "0 12 * * * root certbot renew --quiet" | sudo tee /etc/cron.d/certbot-renew

    echo "nginx and certbot installed!"
    echo "SSL certificate obtained for $DOMAIN"
}

# Main
update_configs

case $METHOD in
    caddy)
        setup_caddy
        ;;
    nginx)
        setup_nginx
        ;;
    *)
        echo "Unknown method: $METHOD. Use 'caddy' or 'nginx'"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "SSL setup complete for $DOMAIN"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Start your Next.js app: npm run start (or pm2 start)"
echo "2. Visit https://$DOMAIN"
echo ""
