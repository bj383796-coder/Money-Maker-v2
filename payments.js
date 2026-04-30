// ============================================================
// payments.js — Intégration PayPal Payouts réels
// Doc : https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
// ============================================================
require('dotenv').config();

const PAYPAL_BASE = process.env.PAYPAL_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// ---- Obtenir un token OAuth PayPal ----
async function getPayPalToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
    throw new Error('PayPal non configuré (PAYPAL_CLIENT_ID / PAYPAL_SECRET manquants)');
  }

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth échouée : ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ============================================================
// Envoyer un paiement PayPal réel (Payouts API)
// ============================================================
async function sendPayPalPayout({ toEmail, amountCents, currency = 'EUR', note = 'Retrait Money-Maker' }) {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
    console.log(`[PAYPAL DÉSACTIVÉ] Simulation paiement ${amountCents}¢ → ${toEmail}`);
    return { success: true, simulated: true, batch_id: 'SIMULATED_' + Date.now() };
  }

  const amount = (amountCents / 100).toFixed(2);
  const senderBatchId = `mm_payout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const token = await getPayPalToken();

    const res = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: 'Votre paiement Money-Maker',
          email_message: note,
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: { value: amount, currency },
            receiver: toEmail,
            note,
            sender_item_id: senderBatchId + '_item',
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `PayPal Payout échoué (${res.status})`);
    }

    return {
      success: true,
      simulated: false,
      batch_id: data.batch_header?.payout_batch_id,
      status: data.batch_header?.batch_status,
    };
  } catch (err) {
    console.error('[PAYPAL ERROR]', err.message);
    throw err;
  }
}

// ============================================================
// Vérifier le statut d'un payout
// ============================================================
async function getPayoutStatus(batchId) {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
    return { status: 'SIMULATED' };
  }
  try {
    const token = await getPayPalToken();
    const res = await fetch(`${PAYPAL_BASE}/v1/payments/payouts/${batchId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch (err) {
    console.error('[PAYPAL STATUS ERROR]', err.message);
    return null;
  }
}

// ============================================================
// Virement bancaire (IBAN) — via Stripe Payouts ou manuel
// Note: les virements IBAN réels nécessitent Stripe Connect
// ou une banque avec API. Par défaut : mode manuel avec log.
// ============================================================
async function sendBankTransfer({ iban, amountCents, username }) {
  const amount = (amountCents / 100).toFixed(2);

  if (!process.env.STRIPE_SECRET_KEY) {
    // Mode manuel : log pour traitement admin
    console.log(`[VIREMENT MANUEL REQUIS]`);
    console.log(`  Bénéficiaire : ${username}`);
    console.log(`  IBAN : ${iban}`);
    console.log(`  Montant : ${amount} EUR`);
    console.log(`  Date : ${new Date().toISOString()}`);
    return { success: true, simulated: true, method: 'manual' };
  }

  // Avec Stripe (nécessite Stripe Connect activé)
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const payout = await stripe.payouts.create({
      amount: amountCents,
      currency: 'eur',
      method: 'standard',
      description: `Retrait Money-Maker - ${username}`,
    });
    return { success: true, simulated: false, payout_id: payout.id };
  } catch (err) {
    console.error('[STRIPE ERROR]', err.message);
    throw err;
  }
}

module.exports = {
  sendPayPalPayout,
  sendBankTransfer,
  getPayoutStatus,
};
