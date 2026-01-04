# AI Agent Guidelines for Logoz Cloud Print Studio

This document provides context and guidelines for AI agents assisting with development on this codebase.

## Project Overview

**Logoz Cloud Print Studio** is a comprehensive cloud-based custom print shop storefront modeled after rushordertees.com. It combines a public-facing e-commerce storefront with an extensive admin dashboard for managing products, quotes, customers, and analytics. Built with Next.js 16, React 19, and TypeScript.

### Key Characteristics
- **Full Admin Dashboard**: 16 admin pages for managing quotes, customers, products, analytics, and settings
- **Complete Quote System**: Full quote lifecycle with pricing, line items, artwork approval, and audit trails
- **Customer CRM**: Customer management with status tracking (Lead → Prospect → Active → Churned)
- **Analytics Suite**: Session tracking, page views, product views, and quote funnel analytics
- **Database-optional**: Works without a database using static fallback content
- **Server Components First**: Leverages React Server Components for data fetching
- **Glassmorphism UI**: Dark theme with frosted glass effects
- **Type-safe**: End-to-end TypeScript with Zod validation

## Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js (App Router) | 16.x |
| UI Library | React | 19.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Database ORM | Prisma | 6.x |
| Database | Neon Serverless PostgreSQL | - |
| Validation | Zod | 4.x |
| State Management | TanStack React Query | 5.x |
| Testing | Vitest + React Testing Library | 4.x |
| Icons | Lucide React | 0.553.x |
| File Storage | Google Cloud Storage | - |
| Email | Gmail API | - |
| Deployment | Docker + Caddy | - |

## Project Structure

```
logoz/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # 47 API routes
│   │   │   ├── admin/              # Admin-only endpoints
│   │   │   │   ├── auth/           # Login, logout, password reset, email verification
│   │   │   │   ├── analytics/      # Admin analytics dashboard data
│   │   │   │   ├── categories/     # Category CRUD
│   │   │   │   ├── customers/      # Customer CRM endpoints
│   │   │   │   ├── notifications/  # Email/notification configuration
│   │   │   │   ├── products/       # Product management
│   │   │   │   ├── quotes/         # Quote management with audit trail
│   │   │   │   ├── services/       # Service management
│   │   │   │   ├── settings/       # Site settings
│   │   │   │   ├── upload/         # File upload to GCS
│   │   │   │   ├── users/          # Admin user management
│   │   │   │   └── vendors/        # Supplier management
│   │   │   ├── analytics/          # Public tracking (pageviews, product views, funnels)
│   │   │   ├── artwork/            # Customer artwork approval
│   │   │   ├── quote/              # Public quote viewing by token
│   │   │   ├── products/           # GET /api/products (5 min cache)
│   │   │   ├── services/           # GET /api/services (10 min cache)
│   │   │   ├── suppliers/          # GET /api/suppliers (10 min cache)
│   │   │   └── settings/           # GET /api/settings (30 min cache)
│   │   ├── admin/                  # 16 admin pages (protected)
│   │   │   ├── analytics/          # Analytics dashboard
│   │   │   ├── appearance/         # Site customization
│   │   │   ├── customers/          # Customer CRM
│   │   │   ├── login/              # Admin login
│   │   │   ├── notifications/      # Email/notification settings
│   │   │   ├── products/           # Product catalog management
│   │   │   ├── quotes/             # Quote management (core feature)
│   │   │   ├── services/           # Service listing management
│   │   │   ├── settings/           # Site settings
│   │   │   ├── users/              # Admin user management
│   │   │   ├── vendors/            # Supplier management
│   │   │   └── page.tsx            # Admin dashboard
│   │   ├── about/                  # About page
│   │   ├── artwork/[token]/        # Customer artwork approval
│   │   ├── contact/                # Contact page
│   │   ├── design-studio/          # Design studio interface
│   │   ├── products/               # Product catalog
│   │   ├── quote/[token]/          # Customer quote viewing/approval
│   │   ├── resources/              # Resource center
│   │   ├── services/               # Services listing
│   │   ├── suppliers/              # Supplier hub
│   │   ├── error.tsx               # Error boundary
│   │   ├── global-error.tsx        # Root error handler
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── loading.tsx             # Loading skeleton
│   │   ├── not-found.tsx           # 404 page
│   │   └── page.tsx                # Homepage
│   ├── components/
│   │   ├── admin/                  # Admin-specific components (tables, forms, dialogs)
│   │   ├── analytics/              # Analytics tracking components
│   │   ├── forms/                  # Form components (quote-form.tsx)
│   │   ├── layout/                 # Header, footer, navigation
│   │   ├── sections/               # Page sections (hero, testimonials, etc.)
│   │   └── providers.tsx           # Context providers (QueryClient, etc.)
│   ├── lib/
│   │   ├── analytics.ts            # Analytics session, tracking, aggregation
│   │   ├── api-utils.ts            # API response helpers, error handling
│   │   ├── auth.ts                 # Session verification, admin auth
│   │   ├── constants.ts            # Fulfillment method constants
│   │   ├── email-verification.ts   # Email verification tokens
│   │   ├── gcs.ts                  # Google Cloud Storage integration
│   │   ├── gmail.ts                # Gmail API for notifications
│   │   ├── logger.ts               # Structured logging utility
│   │   ├── notifications.ts        # Email/SMS notification system
│   │   ├── password-reset.ts       # Password reset flows
│   │   ├── prisma.ts               # Prisma client singleton
│   │   ├── quote-audit.ts          # Quote audit trail logging
│   │   ├── rate-limit.ts           # Rate limiting for API routes
│   │   ├── recaptcha.ts            # reCAPTCHA verification
│   │   ├── site-data.ts            # Data access layer with fallback
│   │   ├── static-content.ts       # Static fallback data
│   │   └── validation.ts           # Zod schemas for forms
│   ├── middleware.ts               # Auth protection, analytics tracking
│   └── test/
│       ├── setup.ts                # Vitest setup
│       └── test-utils.tsx          # Testing utilities
├── prisma/
│   ├── schema.prisma               # Database schema (30+ models)
│   └── seed.ts                     # Database seeding script
├── deploy/
│   ├── Caddyfile                   # Caddy reverse proxy with SSL
│   └── setup-ssl.sh                # SSL setup helper
├── public/                         # Static assets
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Full stack deployment
├── .env.example                    # Environment variable template
├── vitest.config.ts                # Test configuration
└── package.json
```

## Important Patterns

### 1. Data Fetching with Fallback

All data fetching uses a fallback pattern in `src/lib/site-data.ts`:

```typescript
// Data is fetched from database if available, otherwise falls back to static content
const loadOrFallback = async <T>(
  loader: () => Promise<T | null>,
  fallbackValue: unknown,
  loaderName?: string,
): WithFallback<T> => {
  if (!isDatabaseEnabled) {
    return fallbackValue as T;
  }
  try {
    const result = await loader();
    return (result as T) ?? safeFallback;
  } catch (error) {
    dbLogger.warn('Database query failed, using fallback', { loader: loaderName });
    return safeFallback;
  }
};
```

### 2. API Route Pattern

All API routes follow this structure:

```typescript
import { NextResponse } from 'next/server';
import { handleApiError, getCacheHeaders } from '@/lib/api-utils';

export const revalidate = 300; // ISR revalidation time

export async function GET() {
  try {
    const data = await getData();
    return NextResponse.json(
      { data },
      { headers: getCacheHeaders({ maxAge: 60, sMaxAge: 300 }) }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 3. Form Validation with Zod

Forms use Zod 4 for validation (note: Zod 4 has different API than Zod 3):

```typescript
// Zod 4 pattern - no required_error in string()
export const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email'),
});
```

### 4. Rate Limiting

The quote API uses in-memory rate limiting:

```typescript
import { checkRateLimit, getClientIp, getRateLimitHeaders } from '@/lib/rate-limit';

const clientIp = getClientIp(request);
const rateLimitResult = await checkRateLimit(clientIp);

if (!rateLimitResult.success) {
  throw new ApiException('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
}
```

### 5. Structured Logging

Use the logger utility for consistent logging:

```typescript
import { logger, createRequestLogger, apiLogger, dbLogger } from '@/lib/logger';

// In API routes
const reqLogger = createRequestLogger(request);
reqLogger.info('Processing request', { data });

// In data layer
dbLogger.warn('Query failed', { error: error.message });
```

### 6. Error Boundaries

Each route segment can have its own error boundary via `error.tsx`:

```typescript
'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

## Database Schema

Key models in `prisma/schema.prisma` (30+ models):

### Core Business Models
- **SiteSetting** - Global site configuration (theme, branding, reCAPTCHA)
- **Category** - Product/service categories
- **Supplier** - Vendor/supplier information
- **Product** - Product catalog with variants, pricing, fulfillment methods
- **Variant** - Product color/size variants with inventory
- **Service** - Service offerings (screen print, embroidery, etc.)
- **Collection** - Themed product collections

### Quote Management (Primary Feature)
- **QuoteRequest** - Customer quote requests from public form
- **Quote** - Internal admin-generated quotes with pricing and line items
- **QuoteLineItem** - Individual items in a quote
- **ArtworkVersion** - Version history for artwork revisions
- **QuoteAuditLog** - Complete audit trail of all quote changes

### Customer Relationship
- **Customer** - Full CRM with contact info, company data, status tracking
- **CustomerStatus** (enum): LEAD, PROSPECT, ACTIVE, INACTIVE, CHURNED
- **CustomerType** (enum): INDIVIDUAL, BUSINESS, NONPROFIT, GOVERNMENT, EDUCATION

### Admin & Authentication
- **AdminUser** - Admin account with role-based access
- **AdminSession** - Session tracking with token management
- **AdminRole** (enum): SUPER_ADMIN, ADMIN, EDITOR
- **AuditLog** - Administrative action tracking

### Analytics (5 models)
- **PageView** - Individual page visit tracking
- **AnalyticsSession** - Session-level metrics (source, duration, conversion)
- **ProductView** - Product page visit tracking
- **QuoteFunnelEvent** - Quote conversion funnel tracking
- **DailyAnalytics** - Pre-aggregated daily metrics for fast queries

### Notifications
- **NotificationSetting** - Email/SMS notification templates
- **NotificationLog** - Sent notification history
- **EmailConfig** - Gmail API configuration
- **SmsConfig** - SMS provider configuration (Twilio)

### Fulfillment Methods (Enum)
```
EMBROIDERY, SCREEN_PRINT, DTG, VINYL, SUBLIMATION, LASER, PROMO
```

### Quote Status (Enum)
```
PENDING, REVIEWING, SENT, ARTWORK_PENDING, ARTWORK_APPROVED, ARTWORK_DECLINED, APPROVED, DECLINED, ARCHIVED
```

## Development Commands

```bash
# Development
npm run dev              # Start dev server

# Testing
npm run test             # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:ui          # Open test UI
npm run test:coverage    # Run with coverage

# Building
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate:dev   # Create and apply migration
npm run db:migrate:deploy # Deploy migrations (production)
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database
```

## Environment Variables

See `.env.example` for all available variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | For DB features | Neon PostgreSQL pooled connection string |
| `DIRECT_URL` | For migrations | Neon direct connection (bypasses pooler) |
| `SHADOW_DATABASE_URL` | For migrations | Shadow database for Prisma |
| `NEXT_PUBLIC_SITE_NAME` | No | Site title override |
| `NEXT_PUBLIC_SITE_URL` | No | Public URL (client-side) |
| `SITE_URL` | No | Server-side URL |
| `ADMIN_CONTACT_EMAIL` | No | Admin notification email |
| `LOG_LEVEL` | No | Logging level (debug, info, warn, error) |
| `PORT` | No | Server port (default 3000) |

### Optional Services
| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Redis for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication token |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket for file uploads |
| `GCS_PROJECT_ID` | GCS project ID |
| `GCS_CLIENT_EMAIL` | GCS service account email |
| `GCS_PRIVATE_KEY` | GCS service account private key |
| `GMAIL_CLIENT_ID` | Gmail OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Gmail OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth refresh token |

## Critical Feature: Quote System & Audit Trail

**IMPORTANT**: When modifying quote functionality, ALWAYS update the audit trail piece as well.

### Quote Lifecycle
1. Customer submits `QuoteRequest` via public form
2. Admin creates `Quote` with pricing and line items
3. Admin uploads artwork (`ArtworkVersion`)
4. Quote sent to customer via email with unique token
5. Customer views/approves quote at `/quote/[token]`
6. Customer approves artwork at `/artwork/[token]`

### Audit Trail Pattern
Every quote change must be logged via `src/lib/quote-audit.ts`:

```typescript
import { logQuoteAudit } from '@/lib/quote-audit';

// Log quote changes
await logQuoteAudit({
  quoteId: quote.id,
  action: 'STATUS_CHANGE',
  performedBy: adminUser.id,
  previousValue: { status: 'PENDING' },
  newValue: { status: 'SENT' },
  notes: 'Quote sent to customer',
});
```

### Quote Status Flow
```
PENDING → REVIEWING → SENT → ARTWORK_PENDING → ARTWORK_APPROVED → APPROVED
                                            ↘ ARTWORK_DECLINED
                         ↘ DECLINED
                         ↘ ARCHIVED
```

## Coding Guidelines

### DO
- Use Server Components by default, Client Components (`'use client'`) only when needed
- Add proper TypeScript types for all functions and components
- Use the existing utility functions (`handleApiError`, `getCacheHeaders`, etc.)
- Write tests for new functionality in `__tests__` directories
- Use the `logger` utility instead of `console.log`
- Follow the existing naming conventions (kebab-case files, PascalCase components)
- Add loading states via `loading.tsx` for new routes
- Use Tailwind CSS classes, following the existing design system

### DON'T
- Don't use `required_error` in Zod 4 (it's `error` or use `.min(1)`)
- Don't bypass the rate limiter without good reason
- Don't store sensitive data in client-side state
- Don't modify the fallback content without updating both database and static
- Don't use `any` type - use `unknown` and narrow with type guards
- Don't add dependencies without checking compatibility with React 19

## Testing Guidelines

### Test File Location
Place tests in `__tests__` directories next to the code being tested:
```
src/lib/validation.ts
src/lib/__tests__/validation.test.ts
```

### Test Utilities
Use the custom render function for components with providers:
```typescript
import { render, userEvent } from '@/test/test-utils';

const user = userEvent.setup();
render(<QuoteForm services={mockServices} />);
await user.type(screen.getByLabelText(/email/i), 'test@example.com');
```

### Running Specific Tests
```bash
npm run test:run -- validation     # Run tests matching "validation"
npm run test:run -- --reporter=verbose  # Verbose output
```

## Common Tasks

### Adding a New API Endpoint

1. Create route file: `src/app/api/[endpoint]/route.ts`
2. Use the standard pattern with error handling
3. Add caching headers if appropriate
4. Add tests in `__tests__/route.test.ts`

### Adding a New Page

1. Create page: `src/app/[route]/page.tsx`
2. Add `loading.tsx` for loading state
3. Add `error.tsx` if custom error handling needed
4. Update navigation in `site-header.tsx` if needed

### Modifying the Database Schema

1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate:dev -- --name describe_change`
3. Update `src/lib/static-content.ts` with matching fallback data
4. Update relevant data fetching in `src/lib/site-data.ts`

### Adding Form Validation

1. Add/update schema in `src/lib/validation.ts`
2. Export the type: `export type MyPayload = z.infer<typeof mySchema>`
3. Add tests in `src/lib/__tests__/validation.test.ts`

## Troubleshooting

### Build Fails with Type Error
- Check Zod 4 API compatibility (no `required_error`, use `error` instead)
- Ensure all imports use `@/` alias correctly
- Run `npm run db:generate` if Prisma types are missing

### Tests Fail
- Run `npm run test:run` for detailed output
- Check that mocks are set up correctly in `src/test/setup.ts`
- Ensure React Query is wrapped via `test-utils.tsx`

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check that PostgreSQL is running
- The app works without a database using fallback content

## Security Considerations

- **Admin Authentication**: Session-based auth with tokens stored in `AdminSession`
- **Middleware Protection**: Admin routes protected via `src/middleware.ts`
- **Rate Limiting**: 5 requests/hour per IP on `/api/quotes`
- **Input Validation**: Zod schemas on all form submissions
- **XSS Protection**: `containsSuspiciousContent()` helper
- **CORS Validation**: Production validation via `validateRequest()`
- **reCAPTCHA**: Optional spam protection (configurable in settings)
- **Email Verification**: Required for new admin accounts
- **Password Reset**: Token-based flow with expiry
- **Sensitive Data**: Never logged (emails partially masked)

### Admin Auth Pattern
```typescript
import { verifySession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // session.user contains admin user info
}
```

## Performance Optimizations

- ISR (Incremental Static Regeneration) on API routes
- React Server Components reduce client bundle
- Database indexes on frequently queried fields
- LRU cache for rate limiting
- Stale-while-revalidate caching headers
- Daily analytics pre-aggregation for fast dashboard queries

## Analytics System

The analytics system tracks user behavior across the storefront:

### Tracking Components
- `src/lib/analytics.ts` - Core analytics functions
- `src/components/analytics/` - Tracking components
- `src/middleware.ts` - Session initialization

### Events Tracked
1. **PageView** - Every page visit with duration, scroll depth
2. **ProductView** - Product page visits with conversion tracking
3. **QuoteFunnelEvent** - Quote conversion funnel stages:
   - `VIEWED` → `STARTED` → `ADDED_ITEMS` → `SUBMITTED` → `SENT` → `APPROVED`

### Analytics Dashboard
Admin dashboard at `/admin/analytics` displays:
- Daily/weekly/monthly traffic
- Top products by views
- Quote funnel conversion rates
- Traffic sources (UTM parameters)
- Device/browser breakdown

## Contact & Resources

- **Documentation**: This file + inline code comments
- **Design System**: See `src/app/globals.css` for CSS variables
- **Icons**: https://lucide.dev/icons (use `lucide-react`)
- **Admin Panel**: `/admin` (requires authentication)
