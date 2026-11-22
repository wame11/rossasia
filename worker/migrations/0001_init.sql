-- Webstitch admin database (Cloudflare D1 / SQLite)

CREATE TABLE leads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name   TEXT NOT NULL,
  business_type   TEXT NOT NULL DEFAULT '',
  town            TEXT NOT NULL DEFAULT '',
  contact_name    TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  website_url     TEXT NOT NULL DEFAULT '',
  score           INTEGER,                         -- current website, 1 (dreadful) to 10 (excellent)
  status          TEXT NOT NULL DEFAULT 'New',     -- New, Contacted, Interested, Paid, Building, Live, Lost
  source          TEXT NOT NULL DEFAULT 'manual',  -- manual, csv, enquiry, bot
  do_not_contact  INTEGER NOT NULL DEFAULT 0,      -- 1 = opted out of marketing
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX leads_status ON leads (status);

-- One client brief per lead, stored as JSON so the form can grow without migrations.
CREATE TABLE briefs (
  lead_id     INTEGER PRIMARY KEY REFERENCES leads (id) ON DELETE CASCADE,
  data        TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Uploaded logos and photos. The file itself lives in R2 under r2_key.
CREATE TABLE files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id       INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  r2_key        TEXT NOT NULL,
  filename      TEXT NOT NULL,
  content_type  TEXT NOT NULL DEFAULT 'application/octet-stream',
  size          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX files_lead ON files (lead_id);

CREATE TABLE outreach (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id         INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  date            TEXT NOT NULL,                  -- YYYY-MM-DD
  channel         TEXT NOT NULL DEFAULT 'Call',   -- Call, Email, Visit, Message, Other
  outcome         TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  follow_up_date  TEXT NOT NULL DEFAULT '',       -- YYYY-MM-DD or empty
  created_by      TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX outreach_lead ON outreach (lead_id);

CREATE TABLE invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  number         TEXT NOT NULL UNIQUE,            -- WS-2026-0001
  lead_id        INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  issue_date     TEXT NOT NULL,
  due_date       TEXT NOT NULL,
  items          TEXT NOT NULL DEFAULT '[]',      -- JSON: [{ "description": "...", "amount_pence": 15000 }]
  total_pence    INTEGER NOT NULL DEFAULT 0,
  monthly_pence  INTEGER NOT NULL DEFAULT 500,    -- standing order line, 0 to leave it off
  reference      TEXT NOT NULL DEFAULT '',        -- payment reference (business name, max 18 characters)
  status         TEXT NOT NULL DEFAULT 'Sent',    -- Draft, Sent, Paid, Void
  paid_date      TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE subscriptions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id            INTEGER NOT NULL UNIQUE REFERENCES leads (id) ON DELETE CASCADE,
  monthly_pence      INTEGER NOT NULL DEFAULT 500,
  start_date         TEXT NOT NULL,
  last_payment_date  TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'Active',  -- Active, Paused, Cancelled
  notes              TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every payment received: the source of truth for revenue figures.
CREATE TABLE payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id       INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  invoice_id    INTEGER,
  date          TEXT NOT NULL,
  amount_pence  INTEGER NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'Build',    -- Build, Monthly, Extra, Other
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX payments_lead ON payments (lead_id);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
