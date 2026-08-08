CREATE TABLE orders (
  id            UUID PRIMARY KEY,
  customer_id   UUID NOT NULL,
  amount_cents  BIGINT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'COP',
  status        TEXT NOT NULL,          -- PENDING | CONFIRMED | CANCELLED
  version       INT  NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
