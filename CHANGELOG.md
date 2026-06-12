# Changelog

All notable changes to this project are documented here. The patch version in
`package.json` is auto-incremented on every commit by `scripts/hooks/pre-commit`;
each entry below groups the changes shipped under that version.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — workflow-hardening

Hardening of the quoting, SanMar integration, and order/lead/notification
workflows. Findings came from a workflow audit; tracked as P0/P1/P2.

### Security
- Escape all admin/customer-supplied values (notes, titles, names, company,
  line-item names) in generated quote emails, the printable quote document, and
  internal/owner notification emails — closes stored-XSS vectors.
  (`lib/validation.ts` `escapeHtml`/`escapeHtmlMultiline`, quote `send`/`print`
  routes, `lib/notifications.ts`)
- Require an authenticated admin on `GET /api/quotes` — it previously returned
  the latest 50 lead requests (name, email, phone, company, notes) with no auth.
- Require `ADMIN` role on `POST /api/admin/quotes/[id]/send` — previously any
  authenticated user (including EDITOR) could email quotes and mint customer
  access tokens.
- Return 404 from the quote audit endpoint for unknown quote ids.
- Encrypt SanMar API credentials at rest with AES-256-GCM (authenticated
  encryption) instead of a reversible XOR cipher. Saving credentials now
  requires a non-default `SANMAR_ENCRYPTION_KEY`; legacy XOR records are still
  readable and are re-encrypted on next save. (`lib/sanmar/config.ts`)
- XML-escape every interpolated value (credentials, style/color/size, brand,
  category, productId, partId, etc.) in SOAP request bodies to prevent XML
  injection. (`lib/sanmar/soap-client.ts` `encodeXmlEntities`)
- Fail closed on the SanMar cron endpoint: refuse to run when `CRON_SECRET` is
  unset, and verify it in all environments (not just production).
  (`api/cron/sanmar-sync/route.ts`)

### Fixed
- Configure `next.config.ts` `images.remotePatterns` for `cdnm.sanmar.com` and
  `cdn.sanmar.com` so synced SanMar product images render via `next/image`.

### SanMar sync robustness
- Honor the `dryRun`, `updateExisting`, and `markupPercent` sync options that
  the API accepted but `product-sync.ts` ignored: `dryRun` previews without
  writing, `updateExisting: false` skips existing products, and `markupPercent`
  is applied to product/variant sell prices.
- `executeSoapRequest` now uses a 30s `AbortController` timeout plus bounded
  exponential-backoff retries on timeouts and transient 5xx/408/429 responses.
- Throttle category/brand syncs between batches to respect SanMar rate limits.

### Funnel & lead pipeline
- Wire `useQuoteFunnelTracker` into the public quote form (`STARTED_QUOTE` on
  engagement, `SUBMITTED_INFO` on success). The hook was defined but never used,
  so `convertedToQuote` and the conversion rate were permanently 0.
- Notify the internal team when a public website lead (`QuoteRequest`) is
  submitted — leads were previously written to the table with no alert.
- Reconcile customer approval paths: the main quote link now accepts an
  approve/decline from `SENT` or any `ARTWORK_*` state (when not already
  responded), so a quote in an artwork stage is no longer un-approvable there.
  The response update is now atomic, closing a concurrent double-submit race.

### Notifications
- Wire up previously-dead notification paths (each still gated by its
  `NotificationSetting.enabled` flag): `INTERNAL_QUOTE_CREATED` fires on quote
  creation; `INTERNAL_/CUSTOMER_QUOTE_STATUS_CHANGE` fire on admin-initiated
  status changes; `INTERNAL_ARTWORK_RESPONSE` (+ direct owner email) fires when
  a customer approves/declines artwork.
- Notify the quote owner when a customer approves/declines the quote via the
  artwork token flow (previously only the main quote-token path did this).
- Record a `NotificationLog` entry when a quote is emailed to a customer so the
  delivery is tracked.

### Audit trail
- Quote and artwork deletions are now audited (enforces the CLAUDE.md rule that
  every quote mutation writes an audit entry). `logQuoteDeleted` writes a
  `DELETED` entry before removal and also records a durable, user-attributed
  entry in the global `AuditLog`; artwork removal writes `logArtworkRemoved`
  plus a status-change entry when an `ARTWORK_*` status is reverted to PENDING.
- **Schema change (requires `prisma db push`):** `QuoteAuditLog.quoteId` is now
  nullable with `onDelete: SetNull` (was `Cascade`), so a quote's audit history
  survives its deletion instead of being wiped. Added denormalized
  `QuoteAuditLog.quoteNumber` so orphaned audit rows stay identifiable; it is
  now populated by every audit helper.
