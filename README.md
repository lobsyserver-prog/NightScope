# ScopeBridge

ScopeBridge is a TypeScript property operations platform for owners, guests, staff, and administrators.

## Included capabilities

- Guest booking, wallets, nanny and shuttle services
- Car hire, flights, room bidding, reviews, wishlists, and WhatsApp links
- Owner pricing, publishing, payouts, add-ons, reports, promotions, quotes, and invoices
- Fleet compliance, kiosk access, QR check-in, staff payroll, leave, wellness, and loans
- Admin directory and owner/guest global calendars
- Booking channels and payment gateway status management

## Run locally

```bash
npm install
npm test
npm run build
npm run dev
```

The application now starts an HTTP server on `PORT` (default `3000`). `GET /healthz` is the liveness check. `GET /readyz` and `GET /api/production-status` report whether at least one external channel and one card gateway are configured. External channel and payment operations still require their provider credentials. Providers are inactive until credentials are supplied; this project does not claim a provider is live merely because it is listed.

## Configuration

Copy `.env.example` to `.env` and configure provider keys outside source control. Never commit live keys. Reporting analytics persist to `./data/reporting.json`; set `SCOPEBRIDGE_REPORTING_FILE` to choose another location. Staff loan data defaults to `./data/staff-loans.json`; set `SCOPEBRIDGE_LOANS_FILE` to choose another location.

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for production configuration and provider requirements.
