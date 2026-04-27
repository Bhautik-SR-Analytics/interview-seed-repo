-- Beast Insights interview seed schema.
-- Master / lookup tables in `public`, all orders in a single `data.orders` table
-- with a `client_id` column for row-level tenant isolation.
--
-- Apply with: psql -d beast_interview -f db/01_schema.sql

CREATE SCHEMA IF NOT EXISTS data;

CREATE TABLE IF NOT EXISTS public.clients (
  id           BIGINT PRIMARY KEY,
  client_name  VARCHAR(100) NOT NULL,
  created_on   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bin_lookup (
  bin         BIGINT PRIMARY KEY,
  bank        VARCHAR(200),
  card        VARCHAR(50),
  type        VARCHAR(20),
  country     VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id            BIGSERIAL PRIMARY KEY,
  gateway_id    BIGINT NOT NULL,
  client_id     BIGINT NOT NULL REFERENCES public.clients(id),
  mid           BIGINT,
  gateway_alias VARCHAR(200),
  UNIQUE (gateway_id, client_id)
);

-- Single orders table. Three clients seeded: 10001, 10002, 10003.
-- Note: deliberately NO index on client_id or (client_id, bin, mid_number) — that's part of the exercise.
CREATE TABLE IF NOT EXISTS data.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        VARCHAR(50),
  date_of_sale    DATE NOT NULL,
  gateway_id      BIGINT,
  bin             INTEGER,
  mid_number      VARCHAR(50),
  order_total     NUMERIC(12,2),
  is_approved     BOOLEAN DEFAULT false,
  decline_reason  VARCHAR(100),
  client_id       BIGINT NOT NULL,
  created_on      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON data.orders (date_of_sale);
