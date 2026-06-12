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
