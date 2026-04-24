# CanteenX

This project has two backend paths now:

- local development can still use the SQLite-backed Node server
- Vercel deployment uses `/api` serverless functions backed by hosted Postgres

## Persisted data

- student and canteen accounts
- menu items
- pickup time slots
- orders and order items

## Local development

Run locally with the existing SQLite server:

1. `npm run dev:full`
2. Open the Vite URL shown in the terminal

That uses [canteen.sqlite](/Users/krish_01/Downloads/project/canteen-app/canteen.sqlite) for local persistence.

## Vercel deployment

Vercel does not support local SQLite for persistent server-side writes. The deployed app now expects a hosted Postgres-compatible database through:

- `DATABASE_URL`, or
- `POSTGRES_URL`

Recommended setup:

1. In Vercel, open your project
2. Add a Marketplace Postgres integration such as Neon
3. Confirm Vercel injects `DATABASE_URL` or `POSTGRES_URL`
4. Redeploy the project

The Vercel deployment uses:

- static frontend from `dist/`
- serverless API routes under `/api/*`
- `/health` for a simple health check

## Useful checks

- `npm run lint`
- `npm run build`
