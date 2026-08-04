# CryptoXAF Frontend

CryptoXAF is a mobile-first Cameroonian exchange experience for converting XAF into USDT over Mobile Money. The flow is intentionally simple: a customer enters an amount, receives a quote, follows the payment instructions, and tracks the order until the operator settles the payout.

## What this app does

- Lets a customer quote and complete a no-account XAF → USDT swap
- Uses a session-based order reference instead of accounts or passwords
- Supports wallet destinations on both Tron and BNB Smart Chain
- Displays order progress in a customer-friendly status flow
- Works as a progressive web app for installable, mobile-friendly use

## Stack

- React + Vite
- Tailwind CSS
- React Router
- Vite PWA support for installable mobile behavior

## Project structure

- `src/pages/` contains the main customer flow screens
- `src/lib/` holds formatting, chain metadata, and shared helpers
- `src/components/` contains reusable UI pieces

## Development

From the frontend directory:

```bash
npm install
npm run dev
```

To produce a production build:

```bash
npm run build
```

To preview the production bundle locally:

```bash
npm run preview
```

## Environment

The frontend expects the API base URL to be provided in `.env` using the example file:

```env
VITE_API_URL=http://localhost:3000
```

## Notes

This frontend is part of the broader CryptoXAF platform, which uses a Node/Express backend, PostgreSQL via Prisma, and manual settlement workflows currently wired for operator confirmation and payout execution.
