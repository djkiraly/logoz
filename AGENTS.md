# AI Agent Guidelines for Logoz Cloud Print Studio

This document provides context and guidelines for AI agents assisting with development on this codebase.

## Project Overview

**Logoz Cloud Print Studio** is a modern full-service custom print shop storefront built with Next.js 16, React 19, and TypeScript. It includes a marketing site, product catalog, design studio, supplier hub, and quote request system.

### Key Characteristics
- **Database-optional**: The app works without a database using static fallback content
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
| Database | PostgreSQL | - |
| Validation | Zod | 4.x |
| State Management | TanStack React Query | 5.x |
| Testing | Vitest + React Testing Library | 4.x |
| Icons | Lucide React | 0.553.x |

## Project Structure

```
web/
├── src/
│   ├── app/                    # Next.js App Router pages and API routes
│   │   ├── api/                # API endpoints
│   │   │   ├── products/       # GET /api/products
│   │   │   ├── quotes/         # GET, POST /api/quotes
│   │   │   ├── services/       # GET /api/services
│   │   │   ├── settings/       # GET /api/settings
│   │   │   └── suppliers/      # GET /api/suppliers
│   │   ├── about/
│   │   ├── contact/
│   │   ├── design-studio/
│   │   ├── products/
│   │   ├── resources/
│   │   ├── services/
│   │   ├── suppliers/
│   │   ├── error.tsx           # Error boundary
│   │   ├── global-error.tsx    # Root error handler
│   │   ├── layout.tsx          # Root layout
│   │   ├── loading.tsx         # Loading skeleton
│   │   ├── not-found.tsx       # 404 page
│   │   └── page.tsx            # Homepage
│   ├── components/
│   │   ├── forms/              # Form components (quote-form.tsx)
│   │   ├── layout/             # Header, footer
│   │   ├── sections/           # Page sections (hero, testimonials, etc.)
│   │   └── providers.tsx       # React Query provider
│   ├── lib/
│   │   ├── api-utils.ts        # API error handling, caching utilities
│   │   ├── constants.ts        # Fulfillment method constants
│   │   ├── logger.ts           # Structured logging utility
│   │   ├── prisma.ts           # Prisma client singleton
│   │   ├── rate-limit.ts       # Rate limiting for API routes
│   │   ├── site-data.ts        # Data access layer with fallback
│   │   ├── static-content.ts   # Static fallback data
│   │   └── validation.ts       # Zod schemas for forms
│   └── test/
│       ├── setup.ts            # Vitest setup
│       └── test-utils.tsx      # Testing utilities
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Database seeding script
├── public/                     # Static assets
├── .env.example                # Environment variable template
├── vitest.config.ts            # Test configuration
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

Key models in `prisma/schema.prisma`:

- **SiteSetting** - Global site configuration (singleton)
- **Category** - Product/service categories
- **Supplier** - Fulfillment partners
- **Product** - Print products with variants
- **Service** - Fulfillment services (embroidery, screen print, etc.)
- **QuoteRequest** - Customer quote submissions
- **Testimonial**, **Faq**, **Design**, **Collection**

### Fulfillment Methods (Enum)
```
EMBROIDERY, SCREEN_PRINT, DTG, VINYL, SUBLIMATION, LASER, PROMO
```

### Quote Status (Enum)
```
PENDING, REVIEWING, SENT, APPROVED, ARCHIVED
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
| `ADMIN_CONTACT_EMAIL` | No | Admin notification email |
| `LOG_LEVEL` | No | Logging level (debug, info, warn, error) |

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

- Rate limiting is enabled on `/api/quotes` (5 requests/hour per IP)
- Input validation via Zod on all form submissions
- XSS protection via `containsSuspiciousContent()` helper
- CORS validation in production via `validateRequest()`
- Sensitive data should never be logged (emails are partially logged)

## Performance Optimizations

- ISR (Incremental Static Regeneration) on API routes
- React Server Components reduce client bundle
- Database indexes on frequently queried fields
- LRU cache for rate limiting
- Stale-while-revalidate caching headers

## Contact & Resources

- **Documentation**: This file + inline code comments
- **Design System**: See `src/app/globals.css` for CSS variables
- **Icons**: https://lucide.dev/icons (use `lucide-react`)
