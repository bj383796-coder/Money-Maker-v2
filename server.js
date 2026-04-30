// ✅ dotenv chargé EN PREMIER avant tout autre require
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const { pool } = require('./db');
const routes = require('./routes');
const { configureHelmet, generalLimiter } = require('./security');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(configureHelmet());
app.use(generalLimiter);

// ⚠️ Stripe webhook doit recevoir le corps brut — AVANT express.json
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

const isProd = process.env.NODE_ENV === 'production';

app.use(
  session({
    name: 'mm.sid',
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true, // ✅ CORRIGÉ : crée la table si absente
    }),
    secret: process.env.SESSION_SECRET || 'dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
    },
  })
);

if (!isProd) {
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
}

app.use('/api', routes);

app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (isProd && /\.(?:js|css|svg|woff2?)$/.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=86400');
    }
  },
}));

// Health check
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Test rapide (confirme que l'API répond)
app.get('/api/test', (req, res) => res.json({ message: 'API OK' }));

// Gestion d'erreurs globale
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Money-Maker server running on http://0.0.0.0:${PORT}`);
  console.log(`   NODE_ENV  : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB        : ${process.env.DATABASE_URL ? '✅ connectée' : '❌ DATABASE_URL manquante !'}`);
  console.log(`   IA Maya   : ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? '✅ active' : '⚠️  désactivée (optionnel)'}`);
});
