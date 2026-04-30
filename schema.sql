-- ============================================================
-- MONEY-MAKER v2 — Schéma PostgreSQL complet
-- Inclut : vérification email, reset mot de passe,
--          suivi PayPal batch ID, toutes les tables
-- Exécutez ce fichier UNE SEULE FOIS dans votre base
-- Compatible : Supabase, Neon, Railway, PostgreSQL local
-- ============================================================

-- ---- Sessions Express (connect-pg-simple) ----
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);

-- ---- Utilisateurs ----
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  username              VARCHAR(60),
  referral_code         VARCHAR(30) UNIQUE,
  referred_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  balance_cents         INTEGER NOT NULL DEFAULT 0,
  lifetime_earned_cents INTEGER NOT NULL DEFAULT 0,
  is_admin              BOOLEAN NOT NULL DEFAULT FALSE,
  is_blocked            BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until         TIMESTAMP,
  failed_login_count    INTEGER NOT NULL DEFAULT 0,
  lockout_until         TIMESTAMP,
  last_ip               VARCHAR(100),
  last_login_at         TIMESTAMP,
  -- Vérification email
  email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  email_verify_token    VARCHAR(100),
  email_verify_expires  TIMESTAMP,
  -- Réinitialisation mot de passe
  reset_token           VARCHAR(100),
  reset_token_expires   TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_email_verify_token ON users(email_verify_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

-- ---- Vidéos ----
CREATE TABLE IF NOT EXISTS videos (
  id               SERIAL PRIMARY KEY,
  title            VARCHAR(200) NOT NULL,
  youtube_id       VARCHAR(30) NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 30,
  reward_cents     INTEGER NOT NULL DEFAULT 2,
  ad_revenue_cents INTEGER NOT NULL DEFAULT 8,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---- Vues vidéos (gains) ----
CREATE TABLE IF NOT EXISTS video_views (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id         INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  reward_cents     INTEGER NOT NULL DEFAULT 0,
  ad_revenue_cents INTEGER NOT NULL DEFAULT 0,
  ip_address       VARCHAR(100),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_video_views_user_id  ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_ip       ON video_views(ip_address);
CREATE INDEX IF NOT EXISTS idx_video_views_created  ON video_views(created_at);

-- ---- Retraits ----
CREATE TABLE IF NOT EXISTS withdrawals (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents    INTEGER NOT NULL,
  method          VARCHAR(30) NOT NULL,     -- 'paypal' | 'stripe'
  destination     VARCHAR(200) NOT NULL,    -- email PayPal ou IBAN
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | paid | rejected
  admin_note      TEXT,
  paypal_batch_id VARCHAR(100),             -- ID batch retourné par PayPal Payouts API
  processed_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status  ON withdrawals(status);

-- ---- Parrainages ----
CREATE TABLE IF NOT EXISTS referrals (
  id          SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bonus_cents INTEGER NOT NULL DEFAULT 50,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id)
);

-- ---- Achats Premium ----
CREATE TABLE IF NOT EXISTS premium_purchases (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan       VARCHAR(30) NOT NULL,
  cost_cents INTEGER NOT NULL,
  days       INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---- Messages assistante IA (Maya) ----
CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL,   -- 'user' | 'assistant'
  content    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ---- Paramètres dynamiques ----
CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(60) PRIMARY KEY,
  value VARCHAR(500) NOT NULL
);

-- ---- Journal d'audit ----
CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  target        VARCHAR(200),
  details       JSONB,
  ip            VARCHAR(100),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log(actor_user_id);

-- ---- Tickets support ----
CREATE TABLE IF NOT EXISTS support_tickets (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     VARCHAR(150) NOT NULL,
  message     TEXT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user   ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- ============================================================
-- Paramètres par défaut (modifiables depuis le panel Admin)
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('free_min_withdraw_cents',     '1000'),  -- Retrait min gratuit  : 10 €
  ('premium_min_withdraw_cents',  '500'),   -- Retrait min Premium  : 5 €
  ('premium_reward_multiplier',   '150'),   -- Bonus Premium        : x1.5
  ('premium_monthly_cents',       '500'),   -- Prix Premium 1 mois  : 5 €
  ('premium_quarterly_cents',     '1200'),  -- Prix Premium 3 mois  : 12 €
  ('referral_bonus_cents',        '50'),    -- Bonus parrainage     : 0,50 €
  ('ai_messages_per_day_free',    '10'),    -- Messages Maya/jour gratuit
  ('ai_messages_per_day_premium', '100'),   -- Messages Maya/jour Premium
  ('min_seconds_between_views',   '5'),     -- Délai mini entre 2 vidéos
  ('max_views_per_ip_per_hour',   '120')    -- Limite anti-fraude IP/heure
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Vidéos de démarrage (YouTube publics libres de droits)
-- ============================================================
INSERT INTO videos (title, youtube_id, duration_seconds, reward_cents, ad_revenue_cents, is_active)
VALUES
  ('Nature Relaxation 4K',   'BHACKCNDMW8', 30, 2, 8, TRUE),
  ('Beautiful Landscapes',   'iYYRH4apXDo', 30, 3, 9, TRUE),
  ('Ocean Waves Meditation',  'V1bFr2SWP1I', 30, 2, 8, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION — si vous avez déjà une base Money-Maker v1
-- Décommentez uniquement les lignes ci-dessous (ne pas
-- ré-exécuter les CREATE TABLE ci-dessus dans ce cas)
-- ============================================================
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified       BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token   VARCHAR(100);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMP;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token          VARCHAR(100);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires  TIMESTAMP;
-- ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS paypal_batch_id VARCHAR(100);
-- UPDATE users SET email_verified = TRUE WHERE is_admin = TRUE;
