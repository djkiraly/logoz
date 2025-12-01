# Logoz Cloud Print Studio

Modern storefront modeled after rushordertees.com for a full-service custom print shop. The experience includes a marketing site, product catalog, design studio overview, supplier hub, resource center, and API endpoints backed by Prisma with PostgreSQL. Content automatically falls back to static fixtures so the UI works even before a database is connected.

## Stack

- **Framework**: Next.js 16 (App Router) + React 19 + Server Components
- **Styling**: Tailwind CSS v4 (inline `@theme`) with glassmorphism-inspired UI kit
- **Database**: Neon serverless PostgreSQL with Prisma ORM
- **Validation**: Zod 4 for type-safe form validation
- **State**: TanStack React Query for interactive quote forms
- **Testing**: Vitest + React Testing Library
- **API**: RESTful routes for products, services, suppliers, quotes, and settings
- **Deployment**: Docker + Caddy with automatic Let's Encrypt SSL

## Quick Start

### Option 1: Without Database (Fastest)

```bash
# Clone the repository
git clone https://github.com/djkiraly/logoz.git
cd logoz

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Start development server
npm run dev
```

The site will be available at `http://localhost:3000` with static sample data.

### Option 2: With Neon Database (Recommended)

1. **Create a Neon account** at [neon.tech](https://neon.tech) (free tier available)

2. **Create a new project** in the Neon console

3. **Get your connection strings** from the Neon dashboard:
   - Click "Connection Details" in your project
   - Copy both the **pooled** and **direct** connection strings

4. **Configure environment**:
   ```bash
   # Copy template and create both files (Prisma needs .env)
   cp .env.example .env.local
   cp .env.example .env
   ```

5. **Edit `.env` and `.env.local`** with your Neon credentials:
   ```bash
   # Pooled connection (keep -pooler in hostname)
   DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"

   # Direct connection (remove -pooler from hostname for migrations)
   DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
   ```

   > **Important:** The `DIRECT_URL` must NOT have `-pooler` in the hostname. This is required for Prisma migrations to work correctly.

6. **Install, migrate, and seed**:
   ```bash
   # Install dependencies
   npm install

   # Push schema to database (first time setup)
   npx prisma db push

   # Seed with sample data
   npm run db:seed

   # Start development server
   npm run dev
   ```

7. **View your data** (optional):
   ```bash
   npm run db:studio
   ```

**Neon Features Used:**
- Serverless driver with WebSocket connections
- Connection pooling for efficient serverless deployments
- Instant database provisioning

## Environment Variables

Copy `.env.example` to both `.env.local` (for Next.js) and `.env` (for Prisma CLI):

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | For DB features | Neon PostgreSQL connection string (with `-pooler`) |
| `DIRECT_URL` | For DB features | Neon direct connection (without `-pooler`) |
| `PORT` | No | Server port (default: 3000, production: 80) |
| `NEXT_PUBLIC_SITE_NAME` | No | Overrides the storefront title |
| `ADMIN_CONTACT_EMAIL` | No | Admin email for quote notifications |
| `NEXT_PUBLIC_SITE_URL` | No | Public URL (for CORS in production) |
| `LOG_LEVEL` | No | Logging verbosity: `debug`, `info`, `warn`, `error` |

When no database is configured, the UI serves curated static data. Once a database is connected, the same components read from Prisma automatically.

## Project Scripts

### Development

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Create production build |
| `npm run start` | Run production build (port 3000) |
| `npm run start:production` | Run production build (port 80) |
| `npm run lint` | Run ESLint |

### Testing

| Script | Purpose |
| --- | --- |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:ui` | Open Vitest UI |
| `npm run test:coverage` | Run tests with coverage report |

### Database

| Script | Purpose |
| --- | --- |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate:dev` | Create and apply migrations (development) |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:migrate:status` | Check migration status |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:seed` | Seed database with sample data |

## Project Structure

```
logoz/
├── src/
│   ├── app/                # Next.js App Router pages & API routes
│   │   ├── api/            # REST API endpoints
│   │   ├── about/          # About page
│   │   ├── contact/        # Contact page
│   │   ├── products/       # Products catalog
│   │   ├── services/       # Services listing
│   │   └── suppliers/      # Supplier hub
│   ├── components/         # React components
│   │   ├── forms/          # Form components
│   │   ├── layout/         # Header, footer
│   │   └── sections/       # Page sections
│   ├── lib/                # Utilities & data layer
│   │   ├── api-utils.ts    # API helpers
│   │   ├── logger.ts       # Structured logging
│   │   ├── prisma.ts       # Neon database client
│   │   ├── rate-limit.ts   # Rate limiting
│   │   ├── site-data.ts    # Data fetching with fallback
│   │   └── validation.ts   # Zod schemas
│   └── test/               # Test utilities
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed script
├── deploy/                 # Deployment configurations
│   ├── Caddyfile           # Caddy reverse proxy config
│   ├── nginx.conf          # nginx config for certbot
│   └── setup-ssl.sh        # SSL setup helper script
├── Dockerfile              # Container build
├── docker-compose.yml      # Full stack deployment
└── public/                 # Static assets
```

## API Endpoints

| Endpoint | Method | Description | Cache |
| --- | --- | --- | --- |
| `/api/products` | GET | List products | 5 min |
| `/api/services` | GET | List services | 10 min |
| `/api/suppliers` | GET | List suppliers | 10 min |
| `/api/settings` | GET | Site settings | 30 min |
| `/api/quotes` | GET | List quote requests | None |
| `/api/quotes` | POST | Submit quote request | N/A |

The quote POST endpoint includes:
- Rate limiting (5 requests/hour per IP)
- Input validation via Zod
- Duplicate detection (5-minute window)

## Deployment

### Vercel + Neon (Recommended)

The project is optimized for Vercel with Neon PostgreSQL:

1. **Create a Neon database** at [neon.tech](https://neon.tech)

2. **Set environment variables** in Vercel dashboard:
   - `DATABASE_URL` - Neon pooled connection string
   - `DIRECT_URL` - Neon direct connection string
   - `SHADOW_DATABASE_URL` - Neon shadow branch connection
   - `NEXT_PUBLIC_SITE_URL` - Your production URL

3. **Deploy**:
   ```bash
   vercel --prod
   ```

Migrations run automatically via the build process. Neon's serverless driver ensures efficient connection handling on Vercel's edge network.

### Other Platforms (VPS, EC2, DigitalOcean, etc.)

For deployment on a remote server running on port 80:

```bash
# Build the application
npm run build

# Run migrations (if using database)
npm run db:migrate:deploy

# Start server on port 80 (requires sudo on Linux)
sudo npm run start:production
```

Or use the `PORT` environment variable:

```bash
PORT=80 npm run start
```

**Using PM2 (recommended for production):**

```bash
# Install PM2 globally
npm install -g pm2

# Start on port 80
sudo pm2 start npm --name "logoz" -- run start:production

# Or with environment variable
sudo PORT=80 pm2 start npm --name "logoz" -- start

# Save PM2 process list and set up startup script
pm2 save
sudo pm2 startup
```

**Note:** Port 80 requires root/admin privileges on most systems. For HTTPS, use one of the methods below.

### HTTPS with Let's Encrypt

#### Option 1: Docker Compose with Caddy (Easiest)

This method automatically handles SSL certificates:

```bash
# 1. Edit deploy/Caddyfile - replace "yourdomain.com" with your domain
nano deploy/Caddyfile

# 2. Configure environment
cp .env.example .env
nano .env  # Add your Neon database credentials

# 3. Start everything
docker-compose up -d
```

Caddy will automatically obtain and renew Let's Encrypt certificates.

#### Option 2: Caddy (without Docker)

```bash
# 1. Install Caddy
# Debian/Ubuntu:
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# 2. Edit Caddyfile with your domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' deploy/Caddyfile

# 3. Copy config and start
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy

# 4. Start Next.js app
pm2 start npm --name "logoz" -- start
```

#### Option 3: nginx + certbot

```bash
# 1. Install nginx and certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# 2. Edit nginx config with your domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' deploy/nginx.conf

# 3. Copy config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/logoz
sudo ln -s /etc/nginx/sites-available/logoz /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 4. Start nginx
sudo systemctl restart nginx

# 5. Obtain SSL certificate
sudo certbot --nginx -d your-actual-domain.com -d www.your-actual-domain.com

# 6. Start Next.js app
pm2 start npm --name "logoz" -- start
```

Certbot will automatically set up certificate renewal.

## Testing

Run the test suite:

```bash
# Run all tests
npm run test:run

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test:run -- validation

# Watch mode
npm test
```

Current test coverage includes:
- Input validation (46 tests)
- Rate limiting (13 tests)

## Features

- **Database-optional**: Works with static content when no database is configured
- **Rate limiting**: Protects quote API from abuse
- **Error boundaries**: Graceful error handling throughout
- **Loading states**: Skeleton loaders for all routes
- **Accessibility**: ARIA labels, focus management, screen reader support
- **Caching**: ISR and HTTP cache headers on API routes
- **Structured logging**: Consistent, parseable logs

## Contributing

See [AGENTS.md](./AGENTS.md) for detailed development guidelines, coding patterns, and conventions.

## License

Private - All rights reserved.
