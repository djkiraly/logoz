# Logoz Cloud Print Studio

A comprehensive cloud-based custom print shop storefront modeled after rushordertees.com. Features a public-facing e-commerce site with product catalog, design studio, and quote system, plus a full admin dashboard for managing quotes, customers, products, analytics, and business operations.

## Features

- **Public Storefront**: Product catalog, services, supplier hub, design studio, resource center
- **Quote System**: Complete quote lifecycle with pricing, line items, artwork approval, and audit trails
- **Customer CRM**: Full customer management with status tracking (Lead → Prospect → Active → Churned)
- **Admin Dashboard**: 16 admin pages for comprehensive business management
- **Analytics Suite**: Session tracking, page views, product views, and quote funnel analytics
- **Email Integration**: Gmail API for sending quotes and notifications
- **File Storage**: Google Cloud Storage for artwork and file uploads
- **Database-optional**: Works with static content when no database is configured

## Stack

- **Framework**: Next.js 16 (App Router) + React 19 + Server Components
- **Styling**: Tailwind CSS v4 (inline `@theme`) with glassmorphism-inspired UI kit
- **Database**: Neon serverless PostgreSQL with Prisma ORM
- **Validation**: Zod 4 for type-safe form validation
- **State**: TanStack React Query for interactive forms
- **Testing**: Vitest + React Testing Library
- **API**: 47 RESTful routes for products, services, quotes, customers, analytics, and admin operations
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
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # 47 REST API endpoints
│   │   │   ├── admin/          # Admin endpoints (auth, quotes, customers, etc.)
│   │   │   ├── analytics/      # Tracking endpoints (pageviews, funnels)
│   │   │   ├── artwork/        # Customer artwork approval
│   │   │   ├── quote/          # Public quote viewing by token
│   │   │   └── [public]        # Products, services, suppliers, settings
│   │   ├── admin/              # 16 admin pages (protected)
│   │   │   ├── analytics/      # Analytics dashboard
│   │   │   ├── customers/      # Customer CRM
│   │   │   ├── quotes/         # Quote management
│   │   │   ├── products/       # Product catalog
│   │   │   └── [other admin]   # Users, vendors, settings, etc.
│   │   ├── artwork/[token]/    # Customer artwork approval page
│   │   ├── quote/[token]/      # Customer quote viewing page
│   │   └── [public pages]      # About, contact, products, services, etc.
│   ├── components/             # React components
│   │   ├── admin/              # Admin-specific components
│   │   ├── analytics/          # Analytics tracking
│   │   ├── forms/              # Form components
│   │   ├── layout/             # Header, footer
│   │   └── sections/           # Page sections
│   ├── lib/                    # Utilities & services
│   │   ├── analytics.ts        # Analytics tracking
│   │   ├── auth.ts             # Admin authentication
│   │   ├── gcs.ts              # Google Cloud Storage
│   │   ├── gmail.ts            # Gmail API
│   │   ├── notifications.ts    # Email/SMS notifications
│   │   ├── quote-audit.ts      # Quote audit trail
│   │   └── [other utils]       # Validation, logging, rate-limit, etc.
│   └── middleware.ts           # Auth & analytics middleware
├── prisma/
│   ├── schema.prisma           # Database schema (30+ models)
│   └── seed.ts                 # Seed script
├── deploy/                     # Deployment configurations
│   ├── Caddyfile               # Caddy reverse proxy config
│   └── setup-ssl.sh            # SSL setup helper script
├── Dockerfile                  # Container build
├── docker-compose.yml          # Full stack deployment
└── public/                     # Static assets
```

## API Endpoints

### Public Endpoints
| Endpoint | Method | Description | Cache |
| --- | --- | --- | --- |
| `/api/products` | GET | List products | 5 min |
| `/api/services` | GET | List services | 10 min |
| `/api/suppliers` | GET | List suppliers | 10 min |
| `/api/settings` | GET | Site settings | 30 min |
| `/api/quotes` | POST | Submit quote request | N/A |
| `/api/quote/[token]` | GET | View quote by token | None |
| `/api/artwork/[token]` | GET | View artwork for approval | None |
| `/api/analytics/*` | POST | Track pageviews/events | N/A |

### Admin Endpoints (47 total, requires authentication)
| Endpoint | Description |
| --- | --- |
| `/api/admin/auth/*` | Login, logout, password reset, email verification |
| `/api/admin/quotes/*` | Quote CRUD, send, artwork upload, audit trail |
| `/api/admin/customers/*` | Customer CRM operations |
| `/api/admin/products/*` | Product management |
| `/api/admin/services/*` | Service management |
| `/api/admin/vendors/*` | Supplier management |
| `/api/admin/users/*` | Admin user management |
| `/api/admin/settings` | Site configuration |
| `/api/admin/notifications/*` | Email/notification setup |
| `/api/admin/analytics` | Dashboard analytics data |
| `/api/admin/upload` | File upload to GCS |

The quote POST endpoint includes:
- Rate limiting (5 requests/hour per IP)
- Input validation via Zod
- Duplicate detection (5-minute window)
- Optional reCAPTCHA protection

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

### Production Deployment with Docker (Recommended)

Deploy with Docker Compose and Caddy for automatic HTTPS:

**Prerequisites:**
- Docker and Docker Compose installed
- Domain name with DNS A record pointing to your server
- Ports 80 and 443 open on your firewall

```bash
# 1. Clone and configure
git clone https://github.com/djkiraly/logoz.git
cd logoz

# 2. Set up environment
cp .env.example .env
nano .env  # Add your Neon database credentials

# 3. Configure your domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' deploy/Caddyfile

# 4. Deploy
docker-compose up -d

# 5. Run database migrations (first time only)
docker-compose exec app npx prisma db push
docker-compose exec app npm run db:seed
```

Caddy automatically:
- Obtains Let's Encrypt SSL certificates
- Renews certificates before expiry
- Redirects HTTP → HTTPS
- Enables HTTP/2 and HTTP/3

**Useful commands:**
```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Update deployment
git pull
docker-compose up -d --build

# Stop services
docker-compose down
```

### Production Deployment without Docker

For VPS/bare-metal deployment with Caddy:

```bash
# 1. Install Caddy (Debian/Ubuntu)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# 2. Install Node.js and PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pm2

# 3. Clone and build
git clone https://github.com/djkiraly/logoz.git
cd logoz
npm ci
cp .env.example .env
nano .env  # Add your database credentials
npx prisma generate
npm run build

# 4. Configure Caddy with your domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' deploy/Caddyfile
sed -i 's/app:3000/localhost:3000/g' deploy/Caddyfile  # Use localhost instead of Docker network
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy

# 5. Start the application
pm2 start npm --name "logoz" -- start
pm2 save
sudo pm2 startup
```

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

## Admin Dashboard

Access the admin panel at `/admin` (requires authentication). Features include:

- **Dashboard**: Overview of recent activity and key metrics
- **Quotes**: Full quote lifecycle management with audit trail
- **Customers**: CRM with status tracking and history
- **Products**: Product catalog with variants and inventory
- **Services**: Service offerings management
- **Vendors**: Supplier management
- **Analytics**: Traffic, conversions, and funnel analysis
- **Users**: Admin user management with roles (Super Admin, Admin, Editor)
- **Settings**: Site configuration and branding
- **Notifications**: Email templates and Gmail integration

## Security

- **Admin Authentication**: Session-based with JWT-like tokens
- **Middleware Protection**: Admin routes require valid session
- **Rate Limiting**: Protects public endpoints from abuse
- **Input Validation**: Zod schemas on all submissions
- **reCAPTCHA**: Optional spam protection
- **Email Verification**: Required for new admin accounts
- **Password Reset**: Token-based with expiry
- **Audit Logging**: All quote changes tracked with actor info

## Contributing

See [AGENTS.md](./AGENTS.md) for detailed development guidelines, coding patterns, and conventions.

## License

Private - All rights reserved.
