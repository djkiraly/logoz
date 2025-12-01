# Logoz Cloud Print Studio

Modern storefront modeled after rushordertees.com for a full-service custom print shop. The experience includes a marketing site, product catalog, design studio overview, supplier hub, resource center, and API endpoints backed by Prisma with PostgreSQL. Content automatically falls back to static fixtures so the UI works even before a database is connected.

## Stack

- **Framework**: Next.js 16 (App Router) + React 19 + Server Components
- **Styling**: Tailwind CSS v4 (inline `@theme`) with glassmorphism-inspired UI kit
- **Database**: Prisma ORM targeting PostgreSQL (Neon, Supabase, RDS, etc.)
- **Validation**: Zod 4 for type-safe form validation
- **State**: TanStack React Query for interactive quote forms
- **Testing**: Vitest + React Testing Library
- **API**: RESTful routes for products, services, suppliers, quotes, and settings

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (optional - app works without it)

### Installation

```bash
# Navigate to web directory
cd web

# Copy environment template
cp .env.example .env.local

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Start development server (works without database)
npm run dev
```

The site will be available at `http://localhost:3000`.

### With Neon Database (Recommended)

This project is optimized for [Neon](https://neon.tech) serverless PostgreSQL:

1. **Create a Neon account** at [neon.tech](https://neon.tech) (free tier available)

2. **Create a new project** in the Neon console

3. **Get your connection strings** from the Neon dashboard:
   - Click "Connection Details" in your project
   - Copy the connection string (it looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb`)

4. **Configure environment variables** in `.env.local`:
   ```bash
   # Pooled connection for app queries
   DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

   # Direct connection for migrations
   DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

   # Shadow database (create a branch named "shadow" in Neon)
   SHADOW_DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb_shadow?sslmode=require"
   ```

5. **Run migrations and seed**:
   ```bash
   # Create database tables
   npm run db:migrate:dev -- --name init

   # Seed with sample data (optional)
   npm run db:seed

   # Start development server
   npm run dev
   ```

**Neon Features Used:**
- Serverless driver with WebSocket connections
- Connection pooling for efficient serverless deployments
- Branching for shadow database migrations

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | For DB features | Neon PostgreSQL connection string (pooled) |
| `DIRECT_URL` | For migrations | Direct connection bypassing pooler |
| `SHADOW_DATABASE_URL` | For migrations | Shadow database for Prisma migrate |
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
| `npm run start` | Run the production build |
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
web/
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
│   │   ├── prisma.ts       # Database client
│   │   ├── rate-limit.ts   # Rate limiting
│   │   ├── site-data.ts    # Data fetching with fallback
│   │   └── validation.ts   # Zod schemas
│   └── test/               # Test utilities
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed script
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

**Note:** Port 80 requires root/admin privileges on most systems. Alternatively, use a reverse proxy (nginx, Caddy) to forward port 80 to port 3000.

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
