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
