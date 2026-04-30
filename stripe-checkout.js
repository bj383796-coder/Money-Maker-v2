// ============================================================
// stripe-checkout.js — Paiement Premium par carte bancaire
// Utilise Stripe Checkout (hébergé par Stripe, sécurisé)
// ============================================================
require('dotenv').config();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const BASE_URL = process.env.APP_URL || 'http://localhost:5000';

// ============================================================
// Créer une session Stripe Checkout pour le Premium
// ============================================================
async function createCheckoutSession({ userId, userEmail, plan }) {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe non configuré. Ajoutez STRIPE_SECRET_KEY dans .env');
  }

  const plans = {
    monthly:   { amount: 500,  label: 'Premium 1 mois',  days: 30 },
    quarterly: { amount: 1200, label: 'Premium 3 mois',  days: 90 },
  };

  const chosen = plans[plan];
  if (!chosen) throw new Error('Plan invalide');

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: userEmail,
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Money-Maker ${chosen.label}`,
          description: `Accès Premium ${chosen.days} jours — gains x1.5, retrait dès 5€`,
          images: [],
        },
        unit_amount: chosen.amount,
      },
      quantity: 1,
    }],
    metadata: {
      user_id: String(userId),
      plan,
      days: String(chosen.days),
    },
    success_url: `${BASE_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${BASE_URL}/?checkout=cancel`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // expire dans 30 min
  });

  return { url: session.url, session_id: session.id };
}

// ============================================================
// Webhook Stripe — confirmer le paiement et activer le Premium
// ============================================================
async function handleWebhook(rawBody, signature, query) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe non configuré');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET manquant dans .env');

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature invalide: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status !== 'paid') return { ok: true, skipped: true };

    const userId = parseInt(session.metadata.user_id, 10);
    const days   = parseInt(session.metadata.days, 10);
    const plan   = session.metadata.plan;
    const cost   = session.amount_total; // en centimes

    // Calculer la nouvelle date Premium
    const userRow = await query('SELECT premium_until FROM users WHERE id=$1', [userId]);
    if (userRow.rowCount === 0) return { ok: false, error: 'Utilisateur introuvable' };

    const u = userRow.rows[0];
    const startFrom = u.premium_until && new Date(u.premium_until).getTime() > Date.now()
      ? new Date(u.premium_until).getTime()
      : Date.now();
    const newUntil = new Date(startFrom + days * 24 * 60 * 60 * 1000);

    await query('UPDATE users SET premium_until=$1 WHERE id=$2', [newUntil, userId]);
    await query(
      'INSERT INTO premium_purchases (user_id, plan, cost_cents, days) VALUES ($1,$2,$3,$4)',
      [userId, plan, cost, days]
    );
    await query(
      `INSERT INTO audit_log (actor_user_id, action, details) VALUES ($1, 'stripe_premium_purchase', $2)`,
      [userId, JSON.stringify({ plan, days, session_id: session.id, amount: cost })]
    );

    console.log(`[STRIPE] Premium activé user=${userId} plan=${plan} jusqu'au ${newUntil.toISOString()}`);
    return { ok: true, userId, plan, days, newUntil };
  }

  return { ok: true, skipped: true };
}

module.exports = { createCheckoutSession, handleWebhook };
