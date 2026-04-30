// ============================================================
// routes.js — API complète Money-Maker v2
// Nouveautés : paiements PayPal réels, emails, vérif email,
//              reset mot de passe, ads revenue
// ============================================================
const express = require('express');
const bcrypt = require('bcrypt');
const { query, getSetting } = require('./db');
const {
  createUser, verifyEmail, loginUser,
  requestPasswordReset, resetPassword,
  requireAuth, requireAdmin, regenerateSession,
} = require('./auth');
const {
  authLimiter, claimLimiter, withdrawLimiter,
  aiLimiter, isPremium, sanitizeText, getClientIp, logAudit,
  validatePassword,
} = require('./security');
const {
  sendWithdrawalRequestEmail,
  sendWithdrawalPaidEmail,
  sendWithdrawalRejectedEmail,
} = require('./email');
const { sendPayPalPayout, sendBankTransfer } = require('./payments');
const ai = require('./ai');

const router = express.Router();
const getIp = getClientIp;

// ---- helpers ----
async function loadUser(id) {
  const r = await query('SELECT * FROM users WHERE id=$1', [id]);
  return r.rows[0] || null;
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    referral_code: u.referral_code,
    is_admin: u.is_admin,
    is_premium: isPremium(u),
    premium_until: u.premium_until,
    email_verified: u.email_verified,
  };
}

// ============================================================
// PUBLIC
// ============================================================
router.get('/public/stats', async (req, res) => {
  try {
    const r = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users_total,
        (SELECT COUNT(*)::int FROM video_views) AS views_total,
        (SELECT COALESCE(SUM(reward_cents),0)::int FROM video_views) AS total_paid_cents,
        (SELECT COALESCE(SUM(amount_cents),0)::int FROM withdrawals WHERE status='paid') AS withdrawn_cents
    `);
    res.json(r.rows[0]);
  } catch {
    res.json({ users_total: 0, views_total: 0, total_paid_cents: 0, withdrawn_cents: 0 });
  }
});

router.get('/leaderboard', async (req, res) => {
  const r = await query(`
    SELECT username, lifetime_earned_cents,
           (premium_until IS NOT NULL AND premium_until > NOW()) AS is_premium
    FROM users
    WHERE lifetime_earned_cents > 0 AND is_blocked = FALSE
    ORDER BY lifetime_earned_cents DESC LIMIT 10
  `);
  res.json({ leaders: r.rows });
});

// ============================================================
// AUTH
// ============================================================
router.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, username, referralCode } = req.body || {};
    const ip = getIp(req);
    const user = await createUser({ email, password, username, referralCode, ip });
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin;
    await logAudit(query, { actor: user.id, action: 'register', ip });
    res.json({
      ok: true,
      user: publicUser(user),
      message: user.email_verified
        ? null
        : 'Un email de confirmation a été envoyé. Vérifiez votre boîte mail.',
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ip = getIp(req);
    const user = await loginUser({ email, password, ip });
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin;
    await logAudit(query, { actor: user.id, action: 'login', ip });
    res.json({
      ok: true,
      user: publicUser(user),
      warning: user.emailWarning || null,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('mm.sid');
    res.json({ ok: true });
  });
});

// Vérification email via lien cliqué
router.get('/auth/verify-email', async (req, res) => {
  try {
    await verifyEmail(req.query.token);
    // Redirige vers l'app avec message de succès
    res.redirect('/?verified=1');
  } catch (e) {
    res.redirect('/?verified=0');
  }
});

// Demande de reset mot de passe
router.post('/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    await requestPasswordReset(email);
    // Toujours OK pour ne pas révéler les emails
    res.json({ ok: true, message: 'Si cet email existe, un lien a été envoyé.' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Reset du mot de passe
router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    await resetPassword(token, password);
    res.json({ ok: true, message: 'Mot de passe modifié avec succès.' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const u = await loadUser(req.session.userId);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const ok = await bcrypt.compare(currentPassword || '', u.password_hash);
    if (!ok) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    const err = validatePassword(newPassword);
    if (err) return res.status(400).json({ error: err });
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, u.id]);
    await logAudit(query, { actor: u.id, action: 'change_password', ip: getIp(req) });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================
// ME
// ============================================================
router.get('/me', requireAuth, async (req, res) => {
  const r = await query(
    `SELECT id, email, username, balance_cents, lifetime_earned_cents, referral_code,
       is_admin, premium_until, email_verified,
      (SELECT COUNT(*)::int FROM referrals WHERE referrer_id = users.id) AS referral_count,
      (SELECT COUNT(*)::int FROM video_views WHERE user_id = users.id) AS total_views
     FROM users WHERE id=$1`,
    [req.session.userId]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const row = r.rows[0];
  row.is_premium = isPremium(row);
  res.json(row);
});

// ============================================================
// VIDEOS
// ============================================================
router.get('/videos/next', requireAuth, async (req, res) => {
  const minSec = parseInt(await getSetting('min_seconds_between_views', '5'), 10);
  const lastView = await query(
    'SELECT created_at FROM video_views WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
    [req.session.userId]
  );
  let waitSeconds = 0;
  if (lastView.rowCount > 0) {
    const elapsed = (Date.now() - new Date(lastView.rows[0].created_at).getTime()) / 1000;
    if (elapsed < minSec) waitSeconds = Math.ceil(minSec - elapsed);
  }
  const r = await query(
    `SELECT id, title, youtube_id, duration_seconds, reward_cents
     FROM videos
     WHERE is_active = TRUE
       AND id NOT IN (
         SELECT video_id FROM video_views
         WHERE user_id=$1 AND created_at > NOW() - INTERVAL '1 hour'
       )
     ORDER BY RANDOM() LIMIT 1`,
    [req.session.userId]
  );
  if (r.rowCount === 0) {
    const fallback = await query(
      'SELECT id, title, youtube_id, duration_seconds, reward_cents FROM videos WHERE is_active=TRUE ORDER BY RANDOM() LIMIT 1'
    );
    if (fallback.rowCount === 0) return res.json({ video: null, message: 'Aucune vidéo disponible' });
    return res.json({ video: fallback.rows[0], waitSeconds, recycled: true });
  }
  res.json({ video: r.rows[0], waitSeconds });
});

router.post('/videos/:id/claim', requireAuth, claimLimiter, async (req, res) => {
  const videoId = parseInt(req.params.id, 10);
  const userId = req.session.userId;
  const ip = getIp(req);
  if (!videoId) return res.status(400).json({ error: 'Vidéo invalide' });

  const v = await query('SELECT * FROM videos WHERE id=$1 AND is_active=TRUE', [videoId]);
  if (v.rowCount === 0) return res.status(404).json({ error: 'Vidéo introuvable' });
  const video = v.rows[0];

  const minSec = parseInt(await getSetting('min_seconds_between_views', '5'), 10);
  const last = await query(
    'SELECT created_at FROM video_views WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (last.rowCount > 0) {
    const elapsed = (Date.now() - new Date(last.rows[0].created_at).getTime()) / 1000;
    if (elapsed < minSec) {
      return res.status(429).json({ error: `Attendez ${Math.ceil(minSec - elapsed)}s avant la prochaine vidéo` });
    }
  }

  const watched = parseInt(req.body?.watchedSeconds || '0', 10);
  if (watched < Math.max(5, video.duration_seconds - 2)) {
    return res.status(400).json({ error: 'Vous devez regarder la vidéo en entier' });
  }

  const maxPerHour = parseInt(await getSetting('max_views_per_ip_per_hour', '120'), 10);
  const ipCount = await query(
    "SELECT COUNT(*)::int AS c FROM video_views WHERE ip_address=$1 AND created_at > NOW() - INTERVAL '1 hour'",
    [ip]
  );
  if (ipCount.rows[0].c >= maxPerHour) {
    return res.status(429).json({ error: 'Limite de vues par IP atteinte. Réessayez plus tard.' });
  }

  const recent = await query(
    "SELECT id FROM video_views WHERE user_id=$1 AND video_id=$2 AND created_at > NOW() - INTERVAL '30 minutes'",
    [userId, videoId]
  );
  if (recent.rowCount > 0) {
    return res.status(400).json({ error: 'Vous avez déjà regardé cette vidéo récemment' });
  }

  const u = await loadUser(userId);
  let reward = video.reward_cents;
  if (isPremium(u)) {
    const mult = parseInt(await getSetting('premium_reward_multiplier', '150'), 10);
    reward = Math.round(video.reward_cents * (mult / 100));
  }

  await query(
    'INSERT INTO video_views (user_id, video_id, reward_cents, ad_revenue_cents, ip_address) VALUES ($1,$2,$3,$4,$5)',
    [userId, videoId, reward, video.ad_revenue_cents, ip]
  );
  const upd = await query(
    'UPDATE users SET balance_cents=balance_cents+$1, lifetime_earned_cents=lifetime_earned_cents+$1 WHERE id=$2 RETURNING balance_cents',
    [reward, userId]
  );
  res.json({
    ok: true,
    reward_cents: reward,
    bonus_applied: reward !== video.reward_cents,
    balance_cents: upd.rows[0].balance_cents,
  });
});

// ============================================================
// REFERRALS
// ============================================================
router.get('/referrals', requireAuth, async (req, res) => {
  const r = await query(
    `SELECT r.bonus_cents, r.created_at, u.username, u.email
     FROM referrals r JOIN users u ON u.id=r.referred_id
     WHERE r.referrer_id=$1 ORDER BY r.created_at DESC`,
    [req.session.userId]
  );
  const tot = await query(
    'SELECT COALESCE(SUM(bonus_cents),0)::int AS total FROM referrals WHERE referrer_id=$1',
    [req.session.userId]
  );
  res.json({ referrals: r.rows, totalBonusCents: tot.rows[0].total });
});

// ============================================================
// WITHDRAWALS — avec paiements réels et emails
// ============================================================
router.post('/withdrawals', requireAuth, withdrawLimiter, async (req, res) => {
  try {
    const { amountCents, method, destination } = req.body || {};
    const amt = parseInt(amountCents, 10);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Montant invalide' });
    if (!['paypal', 'stripe'].includes(method)) return res.status(400).json({ error: 'Méthode invalide' });
    const dest = sanitizeText(destination || '', 200);
    if (dest.length < 3) return res.status(400).json({ error: 'Destination invalide' });

    const u = await loadUser(req.session.userId);
    const minWFree = parseInt(await getSetting('free_min_withdraw_cents', '1000'), 10);
    const minWPrem = parseInt(await getSetting('premium_min_withdraw_cents', '500'), 10);
    const minW = isPremium(u) ? minWPrem : minWFree;
    if (amt < minW) {
      return res.status(400).json({
        error: `Retrait minimum ${(minW / 100).toFixed(2)}€`,
      });
    }
    if (u.balance_cents < amt) return res.status(400).json({ error: 'Solde insuffisant' });

    const updated = await query(
      'UPDATE users SET balance_cents=balance_cents-$1 WHERE id=$2 AND balance_cents>=$1 RETURNING balance_cents',
      [amt, req.session.userId]
    );
    if (updated.rowCount === 0) return res.status(400).json({ error: 'Solde insuffisant' });

    const ins = await query(
      'INSERT INTO withdrawals (user_id, amount_cents, method, destination) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.session.userId, amt, method, dest]
    );

    await logAudit(query, {
      actor: req.session.userId,
      action: 'withdraw_request',
      details: { amt, method },
      ip: getIp(req),
    });

    // Email de confirmation au user
    sendWithdrawalRequestEmail({
      to: u.email,
      username: u.username || u.email,
      amountCents: amt,
      method,
      destination: dest,
    }).catch(err => console.error('Withdrawal email error:', err.message));

    res.json({ ok: true, withdrawal_id: ins.rows[0].id });
  } catch (e) {
    console.error('withdraw error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/withdrawals', requireAuth, async (req, res) => {
  const r = await query(
    'SELECT id, amount_cents, method, destination, status, admin_note, created_at, processed_at FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC',
    [req.session.userId]
  );
  res.json({ withdrawals: r.rows });
});

// ============================================================
// PREMIUM
// ============================================================
router.get('/premium/plans', requireAuth, async (req, res) => {
  const m = parseInt(await getSetting('premium_monthly_cents', '500'), 10);
  const q = parseInt(await getSetting('premium_quarterly_cents', '1200'), 10);
  const mult = parseInt(await getSetting('premium_reward_multiplier', '150'), 10);
  const u = await loadUser(req.session.userId);
  res.json({
    plans: [
      { id: 'monthly', label: '1 mois', cost_cents: m, days: 30 },
      { id: 'quarterly', label: '3 mois', cost_cents: q, days: 90, bestValue: true },
    ],
    benefits: {
      multiplier: mult / 100,
      premium_min_withdraw_cents: parseInt(await getSetting('premium_min_withdraw_cents', '500'), 10),
      free_min_withdraw_cents: parseInt(await getSetting('free_min_withdraw_cents', '1000'), 10),
      ai_messages_per_day_premium: parseInt(await getSetting('ai_messages_per_day_premium', '100'), 10),
      ai_messages_per_day_free: parseInt(await getSetting('ai_messages_per_day_free', '10'), 10),
    },
    stripe_enabled: !!process.env.STRIPE_SECRET_KEY,
    is_premium: isPremium(u),
    premium_until: u.premium_until,
    balance_cents: u.balance_cents,
  });
});

router.post('/premium/purchase', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!['monthly', 'quarterly'].includes(plan)) return res.status(400).json({ error: 'Plan invalide' });
    const cost = parseInt(
      await getSetting(plan === 'monthly' ? 'premium_monthly_cents' : 'premium_quarterly_cents', '500'), 10
    );
    const days = plan === 'monthly' ? 30 : 90;
    const u = await loadUser(req.session.userId);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (u.balance_cents < cost) return res.status(400).json({ error: `Solde insuffisant.` });

    const startFrom = isPremium(u) ? new Date(u.premium_until).getTime() : Date.now();
    const newUntil = new Date(startFrom + days * 24 * 60 * 60 * 1000);

    const updated = await query(
      `UPDATE users SET balance_cents=balance_cents-$1, premium_until=$2
       WHERE id=$3 AND balance_cents>=$1 RETURNING balance_cents, premium_until`,
      [cost, newUntil, u.id]
    );
    if (updated.rowCount === 0) return res.status(400).json({ error: 'Solde insuffisant' });

    await query(
      'INSERT INTO premium_purchases (user_id, plan, cost_cents, days) VALUES ($1,$2,$3,$4)',
      [u.id, plan, cost, days]
    );
    await logAudit(query, { actor: u.id, action: 'premium_purchase', details: { plan, cost, days }, ip: getIp(req) });
    res.json({ ok: true, balance_cents: updated.rows[0].balance_cents, premium_until: updated.rows[0].premium_until });
  } catch (e) {
    console.error('premium purchase error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================
// AI ASSISTANT
// ============================================================
router.get('/ai/history', requireAuth, async (req, res) => {
  const r = await query(
    'SELECT role, content, created_at FROM chat_messages WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',
    [req.session.userId]
  );
  res.json({ messages: r.rows.reverse() });
});

router.delete('/ai/history', requireAuth, async (req, res) => {
  await query('DELETE FROM chat_messages WHERE user_id=$1', [req.session.userId]);
  res.json({ ok: true });
});

router.post('/ai/chat', requireAuth, aiLimiter, async (req, res) => {
  try {
    const userMessage = sanitizeText(req.body?.message || '', 1000);
    if (!userMessage) return res.status(400).json({ error: 'Message vide' });
    const u = await loadUser(req.session.userId);
    const premium = isPremium(u);
    const dailyLimit = premium
      ? parseInt(await getSetting('ai_messages_per_day_premium', '100'), 10)
      : parseInt(await getSetting('ai_messages_per_day_free', '10'), 10);
    const cnt = await query(
      "SELECT COUNT(*)::int AS c FROM chat_messages WHERE user_id=$1 AND role='user' AND created_at > NOW() - INTERVAL '24 hours'",
      [u.id]
    );
    if (cnt.rows[0].c >= dailyLimit) {
      return res.status(429).json({ error: `Limite quotidienne atteinte (${dailyLimit} messages).` });
    }
    const histR = await query(
      'SELECT role, content FROM chat_messages WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',
      [u.id]
    );
    const history = histR.rows.reverse();
    const factKeys = [
      'free_min_withdraw_cents', 'premium_min_withdraw_cents', 'premium_reward_multiplier',
      'premium_monthly_cents', 'premium_quarterly_cents', 'referral_bonus_cents',
      'ai_messages_per_day_free', 'ai_messages_per_day_premium', 'min_seconds_between_views',
    ];
    const facts = {};
    for (const k of factKeys) facts[k] = parseInt(await getSetting(k, '0'), 10);
    const { text } = await ai.chat({ history, userMessage, isPremium: premium, facts });
    await query(
      'INSERT INTO chat_messages (user_id, role, content) VALUES ($1,$2,$3),($1,$4,$5)',
      [u.id, 'user', userMessage, 'assistant', text]
    );
    res.json({ reply: text, remaining: Math.max(0, dailyLimit - cnt.rows[0].c - 1) });
  } catch (e) {
    console.error('AI chat error:', e.message);
    res.status(500).json({ error: "L'assistant est momentanément indisponible." });
  }
});

// ============================================================
// ADMIN
// ============================================================
router.get('/admin/stats', requireAdmin, async (req, res) => {
  const stats = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users_total,
      (SELECT COUNT(*)::int FROM users WHERE created_at > NOW() - INTERVAL '24 hours') AS users_24h,
      (SELECT COUNT(*)::int FROM users WHERE premium_until IS NOT NULL AND premium_until > NOW()) AS premium_active,
      (SELECT COUNT(*)::int FROM video_views) AS views_total,
      (SELECT COUNT(*)::int FROM video_views WHERE created_at > NOW() - INTERVAL '24 hours') AS views_24h,
      (SELECT COALESCE(SUM(ad_revenue_cents),0)::int FROM video_views) AS ad_revenue_cents,
      (SELECT COALESCE(SUM(reward_cents),0)::int FROM video_views) AS user_payouts_cents,
      (SELECT COALESCE(SUM(balance_cents),0)::int FROM users) AS outstanding_balance_cents,
      (SELECT COUNT(*)::int FROM withdrawals WHERE status='pending') AS pending_withdrawals,
      (SELECT COALESCE(SUM(amount_cents),0)::int FROM withdrawals WHERE status='paid') AS paid_out_cents,
      (SELECT COALESCE(SUM(cost_cents),0)::int FROM premium_purchases) AS premium_revenue_cents
  `);
  const s = stats.rows[0];
  s.profit_cents = s.ad_revenue_cents + s.premium_revenue_cents - s.user_payouts_cents;
  res.json(s);
});

router.get('/admin/users', requireAdmin, async (req, res) => {
  const r = await query(`
    SELECT id, email, username, balance_cents, lifetime_earned_cents, referral_code,
           is_admin, is_blocked, last_ip, created_at, premium_until, email_verified,
      (SELECT COUNT(*)::int FROM video_views WHERE user_id=users.id) AS view_count,
      (SELECT COUNT(*)::int FROM referrals WHERE referrer_id=users.id) AS referral_count
    FROM users ORDER BY created_at DESC LIMIT 200
  `);
  res.json({ users: r.rows });
});

router.post('/admin/users/:id/block', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { blocked } = req.body || {};
  await query('UPDATE users SET is_blocked=$1 WHERE id=$2', [!!blocked, id]);
  await logAudit(query, { actor: req.session.userId, action: 'admin_block_user', target: String(id), details: { blocked: !!blocked }, ip: getIp(req) });
  res.json({ ok: true });
});

router.post('/admin/users/:id/grant-premium', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const days = Math.max(1, Math.min(365, parseInt(req.body?.days, 10) || 30));
  const u = await loadUser(id);
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const startFrom = isPremium(u) ? new Date(u.premium_until).getTime() : Date.now();
  const newUntil = new Date(startFrom + days * 24 * 60 * 60 * 1000);
  await query('UPDATE users SET premium_until=$1 WHERE id=$2', [newUntil, id]);
  await logAudit(query, { actor: req.session.userId, action: 'admin_grant_premium', target: String(id), details: { days }, ip: getIp(req) });
  res.json({ ok: true, premium_until: newUntil });
});

router.post('/admin/users/:id/revoke-premium', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await query('UPDATE users SET premium_until=NULL WHERE id=$1', [id]);
  await logAudit(query, { actor: req.session.userId, action: 'admin_revoke_premium', target: String(id), ip: getIp(req) });
  res.json({ ok: true });
});

router.get('/admin/withdrawals', requireAdmin, async (req, res) => {
  const r = await query(`
    SELECT w.*, u.email, u.username
    FROM withdrawals w JOIN users u ON u.id=w.user_id
    ORDER BY CASE WHEN w.status='pending' THEN 0 ELSE 1 END, w.created_at DESC
    LIMIT 200
  `);
  res.json({ withdrawals: r.rows });
});

// Traitement retrait admin — avec paiement réel et email
router.post('/admin/withdrawals/:id/process', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, note } = req.body || {};
  if (!['paid', 'rejected'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });

  const w = await query(
    'SELECT w.*, u.email, u.username FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.id=$1',
    [id]
  );
  if (w.rowCount === 0) return res.status(404).json({ error: 'Retrait introuvable' });
  if (w.rows[0].status !== 'pending') return res.status(400).json({ error: 'Retrait déjà traité' });

  const withdrawal = w.rows[0];
  let paymentResult = null;

  if (status === 'paid') {
    try {
      // Tentative de paiement automatique selon la méthode
      if (withdrawal.method === 'paypal') {
        paymentResult = await sendPayPalPayout({
          toEmail: withdrawal.destination,
          amountCents: withdrawal.amount_cents,
          note: `Retrait Money-Maker #${id}`,
        });
      } else {
        paymentResult = await sendBankTransfer({
          iban: withdrawal.destination,
          amountCents: withdrawal.amount_cents,
          username: withdrawal.username,
        });
      }
    } catch (payErr) {
      console.error('Payment error:', payErr.message);
      // On continue même si le paiement auto échoue (admin peut payer manuellement)
    }

    // Email de confirmation au user
    sendWithdrawalPaidEmail({
      to: withdrawal.email,
      username: withdrawal.username,
      amountCents: withdrawal.amount_cents,
      method: withdrawal.method,
    }).catch(err => console.error('Paid email error:', err.message));

  } else {
    // Retrait refusé → on recrédite le solde
    await query(
      'UPDATE users SET balance_cents=balance_cents+$1 WHERE id=$2',
      [withdrawal.amount_cents, withdrawal.user_id]
    );

    sendWithdrawalRejectedEmail({
      to: withdrawal.email,
      username: withdrawal.username,
      amountCents: withdrawal.amount_cents,
      reason: sanitizeText(note || '', 300),
    }).catch(err => console.error('Rejected email error:', err.message));
  }

  await query(
    'UPDATE withdrawals SET status=$1, admin_note=$2, processed_at=NOW() WHERE id=$3',
    [status, sanitizeText(note || '', 300) || null, id]
  );

  await logAudit(query, {
    actor: req.session.userId,
    action: 'admin_process_withdrawal',
    target: String(id),
    details: { status, paymentResult },
    ip: getIp(req),
  });

  res.json({ ok: true, payment: paymentResult });
});

router.get('/admin/videos', requireAdmin, async (req, res) => {
  const r = await query('SELECT * FROM videos ORDER BY id DESC');
  res.json({ videos: r.rows });
});

router.post('/admin/videos', requireAdmin, async (req, res) => {
  const { title, youtube_id, duration_seconds, reward_cents, ad_revenue_cents, is_active } = req.body || {};
  if (!title || !youtube_id) return res.status(400).json({ error: 'Titre et YouTube ID requis' });
  await query(
    'INSERT INTO videos (title, youtube_id, duration_seconds, reward_cents, ad_revenue_cents, is_active) VALUES ($1,$2,$3,$4,$5,$6)',
    [sanitizeText(title, 200), sanitizeText(youtube_id, 30), parseInt(duration_seconds || '30', 10), parseInt(reward_cents || '2', 10), parseInt(ad_revenue_cents || '8', 10), is_active !== false]
  );
  await logAudit(query, { actor: req.session.userId, action: 'admin_add_video', details: { youtube_id }, ip: getIp(req) });
  res.json({ ok: true });
});

router.post('/admin/videos/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { is_active, reward_cents, ad_revenue_cents } = req.body || {};
  await query(
    'UPDATE videos SET is_active=COALESCE($1,is_active), reward_cents=COALESCE($2,reward_cents), ad_revenue_cents=COALESCE($3,ad_revenue_cents) WHERE id=$4',
    [typeof is_active === 'boolean' ? is_active : null, reward_cents ?? null, ad_revenue_cents ?? null, id]
  );
  res.json({ ok: true });
});

router.delete('/admin/videos/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await query('DELETE FROM videos WHERE id=$1', [id]);
  await logAudit(query, { actor: req.session.userId, action: 'admin_delete_video', target: String(id), ip: getIp(req) });
  res.json({ ok: true });
});

router.get('/admin/settings', requireAdmin, async (req, res) => {
  const r = await query('SELECT key, value FROM settings ORDER BY key');
  res.json({ settings: r.rows });
});

router.post('/admin/settings', requireAdmin, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Clé requise' });
  await query(
    'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value',
    [sanitizeText(key, 60), sanitizeText(String(value), 500)]
  );
  await logAudit(query, { actor: req.session.userId, action: 'admin_settings_update', target: key, ip: getIp(req) });
  res.json({ ok: true });
});

router.get('/admin/audit', requireAdmin, async (req, res) => {
  const r = await query(`
    SELECT a.id, a.action, a.target, a.details, a.ip, a.created_at, u.email AS actor_email
    FROM audit_log a LEFT JOIN users u ON u.id=a.actor_user_id
    ORDER BY a.created_at DESC LIMIT 100
  `);
  res.json({ entries: r.rows });
});

// ============================================================
// STRIPE CHECKOUT — Paiement Premium par carte bancaire
// ============================================================
const { createCheckoutSession, handleWebhook } = require('./stripe-checkout');

// Créer session Stripe Checkout
router.post('/premium/checkout', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body || {};
    const u = await loadUser(req.session.userId);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const result = await createCheckoutSession({
      userId: u.id,
      userEmail: u.email,
      plan,
    });
    res.json({ ok: true, url: result.url });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Webhook Stripe (corps brut requis — monté dans server.js avant express.json)
router.post('/webhooks/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const result = await handleWebhook(req.body, sig, query);
    res.json(result);
  } catch (e) {
    console.error('[STRIPE WEBHOOK]', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ============================================================
// SUPPORT — Tickets utilisateurs
// ============================================================
router.post('/support', requireAuth, async (req, res) => {
  try {
    const { subject, message } = req.body || {};
    const subj = sanitizeText(subject || '', 150);
    const msg  = sanitizeText(message || '', 2000);
    if (!subj || !msg) return res.status(400).json({ error: 'Sujet et message requis' });

    const u = await loadUser(req.session.userId);
    await query(
      `INSERT INTO support_tickets (user_id, subject, message) VALUES ($1, $2, $3)`,
      [u.id, subj, msg]
    );
    await logAudit(query, { actor: u.id, action: 'support_ticket', details: { subject: subj }, ip: getIp(req) });
    res.json({ ok: true, message: 'Votre message a été envoyé. Réponse sous 24-48h.' });
  } catch (e) {
    console.error('support error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin — voir les tickets
router.get('/admin/support', requireAdmin, async (req, res) => {
  const r = await query(`
    SELECT t.id, t.subject, t.message, t.status, t.admin_reply, t.created_at,
           u.email, u.username
    FROM support_tickets t JOIN users u ON u.id = t.user_id
    ORDER BY CASE WHEN t.status='open' THEN 0 ELSE 1 END, t.created_at DESC
    LIMIT 100
  `);
  res.json({ tickets: r.rows });
});

// Admin — répondre à un ticket
router.post('/admin/support/:id/reply', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { reply } = req.body || {};
  if (!reply) return res.status(400).json({ error: 'Réponse requise' });
  await query(
    `UPDATE support_tickets SET admin_reply=$1, status='closed', updated_at=NOW() WHERE id=$2`,
    [sanitizeText(reply, 2000), id]
  );
  await logAudit(query, { actor: req.session.userId, action: 'admin_support_reply', target: String(id), ip: getIp(req) });
  res.json({ ok: true });
});

// ============================================================
// HISTORIQUE DES GAINS
// ============================================================
router.get('/earnings/history', requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const r = await query(
    `SELECT vv.reward_cents, vv.created_at, v.title AS video_title
     FROM video_views vv
     LEFT JOIN videos v ON v.id = vv.video_id
     WHERE vv.user_id = $1
     ORDER BY vv.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.session.userId, limit, offset]
  );
  const total = await query(
    'SELECT COUNT(*)::int AS c FROM video_views WHERE user_id=$1',
    [req.session.userId]
  );
  res.json({
    history: r.rows,
    page,
    total: total.rows[0].c,
    pages: Math.ceil(total.rows[0].c / limit),
  });
});

// ============================================================
// PAGES LÉGALES (servies comme JSON pour le frontend)
// ============================================================
router.get('/legal/cgu', (req, res) => {
  res.json({ ok: true, type: 'cgu' });
});
router.get('/legal/privacy', (req, res) => {
  res.json({ ok: true, type: 'privacy' });
});

module.exports = router;

