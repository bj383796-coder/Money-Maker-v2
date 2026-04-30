// ============================================================
// auth.js — Authentification complète
// + Vérification email + Réinitialisation mot de passe
// ============================================================
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('./db');
const { validatePassword, sanitizeText } = require('./security');
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} = require('./email');

const MAX_FAILED = 7;
const LOCKOUT_MINUTES = 15;

function genCode(bytes = 4) {
  return crypto.randomBytes(bytes).toString('hex').toUpperCase();
}

function genToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// ============================================================
// Création de compte
// ============================================================
async function createUser({ email, password, username, referralCode, ip }) {
  const emailNorm = sanitizeText(email, 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw new Error('Email invalide');
  }
  const pwError = validatePassword(password);
  if (pwError) throw new Error(pwError);

  const cleanUsername = sanitizeText(username || '', 60) || emailNorm.split('@')[0];

  const existing = await query('SELECT id FROM users WHERE email=$1', [emailNorm]);
  if (existing.rowCount > 0) throw new Error('Cet email est déjà utilisé');

  let referrerId = null;
  if (referralCode && referralCode.trim()) {
    const code = sanitizeText(referralCode, 30).toUpperCase();
    const r = await query('SELECT id FROM users WHERE referral_code=$1', [code]);
    if (r.rowCount > 0) referrerId = r.rows[0].id;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let myCode;
  for (let i = 0; i < 5; i++) {
    myCode = genCode(4);
    const c = await query('SELECT id FROM users WHERE referral_code=$1', [myCode]);
    if (c.rowCount === 0) break;
  }

  const verifyToken = genToken(32);
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const userCount = await query('SELECT COUNT(*)::int AS c FROM users');
  const isFirstUser = userCount.rows[0].c === 0;

  const ins = await query(
    `INSERT INTO users (
       email, password_hash, username, referral_code, referred_by, last_ip,
       is_admin, email_verified, email_verify_token, email_verify_expires
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, email, username, referral_code, balance_cents, is_admin, email_verified`,
    [
      emailNorm, passwordHash, cleanUsername, myCode, referrerId, ip,
      isFirstUser,
      isFirstUser,
      isFirstUser ? null : verifyToken,
      isFirstUser ? null : verifyExpires,
    ]
  );
  const newUser = ins.rows[0];

  if (referrerId) {
    const bonusRow = await query("SELECT value FROM settings WHERE key='referral_bonus_cents'");
    const bonus = parseInt(bonusRow.rows[0]?.value || '50', 10);
    await query(
      'INSERT INTO referrals (referrer_id, referred_id, bonus_cents) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [referrerId, newUser.id, bonus]
    );
    await query(
      'UPDATE users SET balance_cents = balance_cents + $1, lifetime_earned_cents = lifetime_earned_cents + $1 WHERE id=$2',
      [bonus, referrerId]
    );
  }

  if (!isFirstUser) {
    sendWelcomeEmail({
      to: emailNorm,
      username: cleanUsername,
      verifyToken,
    }).catch(err => console.error('Welcome email error:', err.message));
  }

  return newUser;
}

// ============================================================
// Vérification de l'email via token
// ============================================================
async function verifyEmail(token) {
  if (!token) throw new Error('Token invalide');
  const r = await query(
    `SELECT id FROM users
     WHERE email_verify_token=$1 AND email_verify_expires > NOW() AND email_verified = FALSE`,
    [token]
  );
  if (r.rowCount === 0) throw new Error('Lien expiré ou déjà utilisé');
  await query(
    `UPDATE users SET email_verified=TRUE, email_verify_token=NULL, email_verify_expires=NULL WHERE id=$1`,
    [r.rows[0].id]
  );
  return true;
}

// ============================================================
// Connexion
// ============================================================
async function loginUser({ email, password, ip }) {
  const emailNorm = sanitizeText(email || '', 255).toLowerCase();
  if (!emailNorm || typeof password !== 'string' || !password) {
    throw new Error('Email ou mot de passe incorrect');
  }
  const r = await query('SELECT * FROM users WHERE email=$1', [emailNorm]);
  if (r.rowCount === 0) {
    await bcrypt.compare(password, '$2b$12$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu');
    throw new Error('Email ou mot de passe incorrect');
  }
  const user = r.rows[0];

  if (user.is_blocked) throw new Error("Compte bloqué. Contactez l'administrateur.");

  if (user.lockout_until && new Date(user.lockout_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(user.lockout_until).getTime() - Date.now()) / 60000);
    throw new Error(`Trop de tentatives. Compte verrouillé encore ${mins} min.`);
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const newCount = (user.failed_login_count || 0) + 1;
    if (newCount >= MAX_FAILED) {
      const until = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
      await query('UPDATE users SET failed_login_count=$1, lockout_until=$2 WHERE id=$3', [newCount, until, user.id]);
      throw new Error(`Trop de tentatives. Compte verrouillé pendant ${LOCKOUT_MINUTES} min.`);
    }
    await query('UPDATE users SET failed_login_count=$1 WHERE id=$2', [newCount, user.id]);
    throw new Error('Email ou mot de passe incorrect');
  }

  const emailWarning = !user.email_verified
    ? 'Pensez à vérifier votre email pour sécuriser votre compte.'
    : null;

  await query(
    'UPDATE users SET last_ip=$1, failed_login_count=0, lockout_until=NULL, last_login_at=NOW() WHERE id=$2',
    [ip, user.id]
  );

  return { ...user, emailWarning };
}

// ============================================================
// Demande de réinitialisation de mot de passe
// ============================================================
async function requestPasswordReset(email) {
  const emailNorm = sanitizeText(email || '', 255).toLowerCase();
  const r = await query('SELECT id, username FROM users WHERE email=$1', [emailNorm]);
  if (r.rowCount === 0) return true; // Sécurité : on ne révèle pas si l'email existe

  const user = r.rows[0];
  const resetToken = genToken(32);
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await query(
    'UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE id=$3',
    [resetToken, resetExpires, user.id]
  );

  sendPasswordResetEmail({
    to: emailNorm,
    username: user.username,
    resetToken,
  }).catch(err => console.error('Reset email error:', err.message));

  return true;
}

// ============================================================
// Réinitialisation du mot de passe
// ============================================================
async function resetPassword(token, newPassword) {
  if (!token) throw new Error('Token invalide');
  const pwError = validatePassword(newPassword);
  if (pwError) throw new Error(pwError);

  const r = await query(
    'SELECT id FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()',
    [token]
  );
  if (r.rowCount === 0) throw new Error('Lien expiré ou invalide');

  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    `UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL,
     failed_login_count=0, lockout_until=NULL WHERE id=$2`,
    [hash, r.rows[0].id]
  );
  return true;
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Accès admin requis' });
  }
  next();
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = {
  createUser,
  verifyEmail,
  loginUser,
  requestPasswordReset,
  resetPassword,
  requireAuth,
  requireAdmin,
  regenerateSession,
};
