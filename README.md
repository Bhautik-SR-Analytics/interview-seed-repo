# Beast Insights — Coding Exercise

A small Express + Postgres app representing a slice of our analytics platform.

## Prerequisites

- Node 20+
- A running Postgres 14+ (local install, brew service, hosted — your choice)

## Setup

```bash
# 1. Create a database
createdb beast_interview

# 2. Apply the schema
psql -d beast_interview -f db/01_schema.sql

# 3. Point the app at your DB
cp .env.example .env       # then edit DATABASE_URL

# 4. Install deps and seed data (~10k rows across 3 clients)
npm install
npm run seed

# 5. Run
npm start
```

The server listens on `http://localhost:3000`.

## Architecture

- `public.clients` — registry of clients (10001, 10002, 10003 are seeded).
- `public.bin_lookup` — BIN to bank / card-brand reference.
- `public.payments` — gateway / MID configuration per client.
- `data.orders` — orders for all clients (each row has a `client_id`).

## Endpoints

- `GET /health` — liveness check.
- `GET /api/clients/me` — returns the caller's client record. Requires `x-client-id` header.
- `GET /api/analytics/approval-rates` — **build this.**

## Your task

Build `GET /api/analytics/approval-rates`. It should return the approval rate broken down by BIN and MID for the caller's client. Include bank / card-brand context from `public.bin_lookup` where available. Pagination is nice-to-have.

Use whatever tools you'd use in your day job — Cursor, Claude, anything.

### Example call

```bash
curl -H 'x-client-id: 10001' http://localhost:3000/api/analytics/approval-rates
```
