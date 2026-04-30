#!/usr/bin/env node
// ================================================================
// setup.js — Script de configuration automatique Money-Maker
// Lance avec :  node setup.js
// ================================================================

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

function green(t)  { return '\x1b[32m' + t + '\x1b[0m'; }
function yellow(t) { return '\x1b[33m' + t + '\x1b[0m'; }
function red(t)    { return '\x1b[31m' + t + '\x1b[0m'; }
function bold(t)   { return '\x1b[1m'  + t + '\x1b[0m'; }

const ENV_FILE = path.join(__dirname, '.env');

async function main() {
  console.log('\n' + bold('================================================'));
  console.log(bold('  💰 MONEY-MAKER — Configuration automatique'));
  console.log(bold('================================================') + '\n');

  // Vérifier si .env existe déjà
  if (fs.existsSync(ENV_FILE)) {
    const overwrite = await ask(yellow('⚠️  Un fichier .env existe déjà. L\'écraser ? (oui/non) : '));
    if (!overwrite.toLowerCase().startsWith('o')) {
      console.log('Configuration annulée.');
      rl.close(); return;
    }
  }

  console.log('\n' + bold('ETAPE 1 — Base de données PostgreSQL') + ' (obligatoire)');
  console.log('  Exemples :');
  console.log('  Neon    : postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require');
  console.log('  Supabase: postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres');
  console.log('  Local   : postgresql://postgres:motdepasse@localhost:5432/moneymaker\n');
  const dbUrl = await ask('  DATABASE_URL : ');

  console.log('\n' + bold('ETAPE 1 — URL publique de votre app'));
  console.log('  En local : http://localhost:5000');
  console.log('  En prod  : https://votre-domaine.com\n');
  const appUrl = await ask('  APP_URL [http://localhost:5000] : ') || 'http://localhost:5000';

  const sessionSecret = crypto.randomBytes(48).toString('hex');
  console.log('\n' + green('  ✅ SESSION_SECRET généré automatiquement'));

  console.log('\n' + bold('ETAPE 2 — Stripe') + ' (optionnel — paiement carte Premium)');
  console.log('  Obtenez vos clés sur https://dashboard.stripe.com/apikeys\n');
  const stripeKey     = await ask('  STRIPE_SECRET_KEY [vide pour ignorer] : ');
  const stripeWebhook = stripeKey ? await ask('  STRIPE_WEBHOOK_SECRET [vide pour ignorer] : ') : '';

  console.log('\n' + bold('ETAPE 3 — Email') + ' (optionnel — mais recommandé)');
  console.log('  Gmail : créez un mot de passe d\'application sur myaccount.google.com/apppasswords\n');
  const emailUser = await ask('  EMAIL_USER / Gmail [vide pour ignorer] : ');
  const emailPass = emailUser ? await ask('  EMAIL_PASS (mot de passe application) : ') : '';

  console.log('\n' + bold('ETAPE 4 — PayPal') + ' (optionnel — paiements automatiques)');
  console.log('  Obtenez vos clés sur https://developer.paypal.com\n');
  const paypalId     = await ask('  PAYPAL_CLIENT_ID [vide pour ignorer] : ');
  const paypalSecret = paypalId ? await ask('  PAYPAL_SECRET : ') : '';
  const paypalEnv    = paypalId ? (await ask('  PAYPAL_ENV [sandbox] : ') || 'sandbox') : 'sandbox';

  console.log('\n' + bold('ETAPE 5 — OpenAI / Assistante Maya') + ' (optionnel)');
  const openaiKey = await ask('  OPENAI_API_KEY [vide pour ignorer] : ');

  // Générer le .env
  const envContent = `# Money-Maker — Généré automatiquement par setup.js
# ${new Date().toLocaleString('fr-FR')}

# === BASE DE DONNÉES ===
DATABASE_URL=${dbUrl}

# === SESSION ===
SESSION_SECRET=${sessionSecret}

# === APP ===
APP_URL=${appUrl}
PORT=5000
NODE_ENV=development

# === STRIPE ===
STRIPE_SECRET_KEY=${stripeKey || 'sk_test_CONFIGUREZ_VOTRE_CLE'}
STRIPE_WEBHOOK_SECRET=${stripeWebhook || 'whsec_CONFIGUREZ_VOTRE_WEBHOOK'}

# === EMAIL ===
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=${emailUser || 'votre@gmail.com'}
EMAIL_PASS=${emailPass || 'xxxx-xxxx-xxxx-xxxx'}
EMAIL_FROM=Money-Maker <${emailUser || 'votre@gmail.com'}>

# === PAYPAL ===
PAYPAL_ENV=${paypalEnv}
PAYPAL_CLIENT_ID=${paypalId || 'CONFIGUREZ_VOTRE_PAYPAL'}
PAYPAL_SECRET=${paypalSecret || 'CONFIGUREZ_VOTRE_PAYPAL'}

# === OPENAI / MAYA ===
AI_INTEGRATIONS_OPENAI_API_KEY=${openaiKey || ''}
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
`;

  fs.writeFileSync(ENV_FILE, envContent);
  console.log('\n' + green('✅ Fichier .env créé !'));

  // npm install
  console.log('\n' + bold('Installation des dépendances npm...'));
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log(green('✅ npm install terminé !'));
  } catch (e) {
    console.log(red('❌ npm install échoué. Lancez "npm install" manuellement.'));
  }

  // Instructions finales
  console.log('\n' + bold('================================================'));
  console.log(bold('  🎉 Configuration terminée !'));
  console.log(bold('================================================'));
  console.log('\n  Prochaines étapes :');
  console.log(yellow('  1. Exécutez schema.sql dans votre base PostgreSQL'));
  console.log(yellow('     (Supabase/Neon : SQL Editor → collez schema.sql → Run)'));
  console.log(yellow('\n  2. Lancez le serveur :'));
  console.log(bold('     npm start'));
  console.log(yellow('\n  3. Ouvrez : ') + bold('http://localhost:5000'));
  console.log(yellow('  4. Inscrivez-vous en premier → vous serez automatiquement Admin 👑'));
  console.log('');

  rl.close();
}

main().catch(err => {
  console.error(red('Erreur : ' + err.message));
  rl.close();
  process.exit(1);
});
