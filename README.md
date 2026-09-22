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

The current `dev` command is a service smoke preview and exits after initializing the direct booking channel. External channel, payment, Google Places, email, and WhatsApp operations require their provider credentials and an HTTP/API layer.

## Configuration

Copy `.env.example` to `.env` and configure provider keys outside source control. Staff loan data defaults to `./data/staff-loans.json`; set `SCOPEBRIDGE_LOANS_FILE` to choose another location.

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for production configuration and provider requirements.
