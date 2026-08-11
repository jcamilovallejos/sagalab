-- el UNIQUE (aquí, la PRIMARY KEY compuesta) es el árbitro, no el código:
-- dos INSERT concurrentes con la misma (key, endpoint) nunca pasan ambos.
CREATE TABLE idempotency_keys (
  key             TEXT NOT NULL,
  endpoint        TEXT NOT NULL,
  request_hash    TEXT NOT NULL,
  status          TEXT NOT NULL,        -- in_progress | done
  response_status INT,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, endpoint)
);

-- la purga por TTL barre por expires_at
CREATE INDEX idempotency_keys_expires_at ON idempotency_keys (expires_at);
