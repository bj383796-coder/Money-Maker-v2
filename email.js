// ============================================================
// email.js — Système d'emails transactionnels (Nodemailer)
// Supporte : Gmail, Outlook, SMTP custom, Mailgun, SendGrid
// ============================================================
require('dotenv').config();
const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null; // Emails désactivés si non configurés
  }

  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return _transporter;
}

const FROM = `"Money-Maker" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@money-maker.app'}>`;
const BASE_URL = process.env.APP_URL || 'http://localhost:5000';

// ---- Template HTML de base ----
function baseTemplate(title, content) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#020617; font-family: Inter, Arial, sans-serif; color:#e2e8f0; }
    .wrapper { max-width:580px; margin:40px auto; background:#0f172a; border-radius:16px; overflow:hidden; border:1px solid rgba(148,163,184,0.1); }
    .header { background:linear-gradient(135deg,#10b981,#047857); padding:32px 40px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:24px; font-weight:800; }
    .header p { margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px; }
    .body { padding:36px 40px; }
    .body p { line-height:1.7; color:#cbd5e1; margin:0 0 16px; }
    .btn { display:inline-block; background:linear-gradient(135deg,#10b981,#059669); color:#fff !important; text-decoration:none; padding:14px 32px; border-radius:10px; font-weight:700; font-size:15px; margin:8px 0 24px; }
    .info-box { background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:10px; padding:16px 20px; margin:16px 0; }
    .info-box p { margin:0; color:#6ee7b7; font-size:14px; }
    .footer { background:#020617; padding:20px 40px; text-align:center; }
    .footer p { margin:0; color:#475569; font-size:12px; line-height:1.6; }
    .amount { font-size:32px; font-weight:800; color:#34d399; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>💰 Money-Maker</h1>
      <p>Gagnez en regardant des vidéos</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Money-Maker · Vous recevez cet email car vous êtes inscrit sur notre plateforme.<br/>
      <a href="${BASE_URL}" style="color:#10b981;">Accéder à la plateforme</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ---- Envoi générique ----
async function sendMail({ to, subject, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL DÉSACTIVÉ] À: ${to} | Sujet: ${subject}`);
    return false;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[EMAIL] Envoyé à ${to} — ${subject}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL ERREUR] ${err.message}`);
    return false;
  }
}

// ============================================================
// 1. Email de bienvenue + vérification
// ============================================================
async function sendWelcomeEmail({ to, username, verifyToken }) {
  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${verifyToken}`;
  const html = baseTemplate('Bienvenue sur Money-Maker !', `
    <p>Bonjour <strong>${username}</strong>,</p>
    <p>Bienvenue sur <strong>Money-Maker</strong> ! Votre compte a bien été créé. Confirmez votre adresse email pour activer votre compte et commencer à gagner.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${verifyUrl}" class="btn">✅ Confirmer mon email</a>
    </div>
    <div class="info-box">
      <p>Ce lien expire dans <strong>24 heures</strong>. Si vous n'avez pas créé de compte, ignorez cet email.</p>
    </div>
    <p style="font-size:13px;color:#64748b;">Lien alternatif : <a href="${verifyUrl}" style="color:#10b981;">${verifyUrl}</a></p>
  `);
  return sendMail({ to, subject: '✅ Confirmez votre email — Money-Maker', html });
}

// ============================================================
// 2. Email de réinitialisation de mot de passe
// ============================================================
async function sendPasswordResetEmail({ to, username, resetToken }) {
  const resetUrl = `${BASE_URL}/reset-password?token=${resetToken}`;
  const html = baseTemplate('Réinitialisation de mot de passe', `
    <p>Bonjour <strong>${username || 'utilisateur'}</strong>,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}" class="btn">🔑 Réinitialiser mon mot de passe</a>
    </div>
    <div class="info-box">
      <p>Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe reste inchangé.</p>
    </div>
  `);
  return sendMail({ to, subject: '🔑 Réinitialisation de mot de passe — Money-Maker', html });
}

// ============================================================
// 3. Email de confirmation de retrait
// ============================================================
async function sendWithdrawalRequestEmail({ to, username, amountCents, method, destination }) {
  const amount = (amountCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
  const html = baseTemplate('Demande de retrait reçue', `
    <p>Bonjour <strong>${username}</strong>,</p>
    <p>Votre demande de retrait a bien été enregistrée et est en cours de traitement.</p>
    <div class="info-box" style="text-align:center;">
      <p style="font-size:13px;color:#94a3b8;margin-bottom:4px;">Montant demandé</p>
      <p class="amount">${amount}</p>
      <p style="margin-top:8px;">Via <strong>${method === 'paypal' ? 'PayPal' : 'Virement bancaire'}</strong><br/>
      <span style="color:#64748b;font-size:13px;">${destination}</span></p>
    </div>
    <p>Le délai de traitement est de <strong>1 à 3 jours ouvrés</strong>. Vous recevrez un email dès que votre paiement sera effectué.</p>
    <p>Vous pouvez suivre l'état de votre retrait depuis votre <a href="${BASE_URL}" style="color:#10b981;">tableau de bord</a>.</p>
  `);
  return sendMail({ to, subject: `💸 Retrait de ${amount} en cours — Money-Maker`, html });
}

// ============================================================
// 4. Email de paiement effectué
// ============================================================
async function sendWithdrawalPaidEmail({ to, username, amountCents, method }) {
  const amount = (amountCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
  const html = baseTemplate('Votre paiement a été effectué ! 🎉', `
    <p>Bonjour <strong>${username}</strong>,</p>
    <p>Bonne nouvelle ! Votre retrait a été traité et le paiement a été envoyé.</p>
    <div class="info-box" style="text-align:center;">
      <p style="font-size:13px;color:#94a3b8;margin-bottom:4px;">Montant versé</p>
      <p class="amount">${amount}</p>
      <p style="margin-top:8px;">Via <strong>${method === 'paypal' ? 'PayPal' : 'Virement bancaire'}</strong></p>
    </div>
    <p>Le virement peut prendre <strong>1 à 2 jours ouvrés</strong> supplémentaires selon votre banque ou PayPal.</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${BASE_URL}" class="btn">Continuer à gagner →</a>
    </div>
  `);
  return sendMail({ to, subject: `🎉 Paiement de ${amount} effectué — Money-Maker`, html });
}

// ============================================================
// 5. Email de retrait refusé
// ============================================================
async function sendWithdrawalRejectedEmail({ to, username, amountCents, reason }) {
  const amount = (amountCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
  const html = baseTemplate('Retrait refusé', `
    <p>Bonjour <strong>${username}</strong>,</p>
    <p>Votre demande de retrait de <strong>${amount}</strong> n'a pas pu être traitée.</p>
    ${reason ? `<div class="info-box"><p>Raison : <strong>${reason}</strong></p></div>` : ''}
    <p>Votre solde a été <strong>recrédité</strong> intégralement. Vous pouvez faire une nouvelle demande depuis votre tableau de bord.</p>
    <p>Si vous pensez qu'il s'agit d'une erreur, contactez notre support.</p>
  `);
  return sendMail({ to, subject: `⚠️ Retrait refusé — Money-Maker`, html });
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendWithdrawalRequestEmail,
  sendWithdrawalPaidEmail,
  sendWithdrawalRejectedEmail,
};
