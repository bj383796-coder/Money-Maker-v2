const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://www.youtube.com",
          "https://s.ytimg.com",
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "https:"],
        "frame-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'self'"],
        "upgrade-insecure-requests": null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
}

// ✅ CORRIGÉ : ipKeyGenerator n'existe plus dans express-rate-limit v8
// On utilise directement req.ip
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { error: 'Trop de requêtes, réessayez dans une minute.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  message: { error: 'Trop de tentatives. Patientez 15 minutes.' },
});

const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { error: 'Trop de réclamations. Ralentissez.' },
});

const withdrawLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `wd:${req.session?.userId || getClientIp(req)}`,
  message: { error: 'Limite de retrait atteinte (5/heure).' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ai:${req.session?.userId || getClientIp(req)}`,
  message: { error: "Trop de messages à l'assistant. Patientez une minute." },
});

function validatePassword(pw) {
  if (typeof pw !== 'string') return 'Mot de passe requis.';
  if (pw.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (pw.length > 128) return 'Mot de passe trop long.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  return null;
}

function sanitizeText(s, max = 2000) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function isPremium(user) {
  if (!user || !user.premium_until) return false;
  return new Date(user.premium_until).getTime() > Date.now();
}

async function logAudit(query, { actor, action, target, details, ip }) {
  try {
    await query(
      `INSERT INTO audit_log (actor_user_id, action, target, details, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [actor || null, action, target || null, details ? JSON.stringify(details) : null, ip || null]
    );
  } catch (e) {
    console.error('audit log error:', e.message);
  }
}

module.exports = {
  configureHelmet,
  generalLimiter,
  authLimiter,
  claimLimiter,
  withdrawLimiter,
  aiLimiter,
  validatePassword,
  sanitizeText,
  isPremium,
  getClientIp,
  logAudit,
};
