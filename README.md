# 💰 Money-Maker — Guide de démarrage complet

Plateforme de monétisation par visionnage de vidéos YouTube.
Stack : Node.js · Express · PostgreSQL · Stripe · PayPal · Nodemailer

---

## 🚀 Démarrage rapide (méthode automatique)

```bash
node setup.js
```

Ce script vous guide interactivement à travers les 5 étapes, génère votre `.env` et installe les dépendances.

---

## 📋 Les 5 étapes détaillées

---

### ÉTAPE 1 — Base de données + Session + URL

**Base de données PostgreSQL :**

| Service | Lien | Gratuit |
|---------|------|---------|
| Neon | https://neon.tech | ✅ Oui |
| Supabase | https://supabase.com | ✅ Oui |
| Railway | https://railway.app | Crédits offerts |

1. Créez un compte sur l'un de ces services
2. Créez une nouvelle base de données
3. Copiez l'URL de connexion
4. Exécutez `schema.sql` dans l'éditeur SQL du service

**Dans votre `.env` :**
```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
SESSION_SECRET=votre-chaine-aleatoire-64-caracteres
APP_URL=http://localhost:5000
```

Générez SESSION_SECRET avec :
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

### ÉTAPE 2 — Stripe (Paiement carte bancaire Premium)

1. Créez un compte sur **https://stripe.com**
2. Dashboard → **Developers** → **API keys**
3. Copiez **Secret key** (commence par `sk_test_`)
4. Pour le webhook :
   - Dashboard → Developers → **Webhooks** → **Add endpoint**
   - URL : `https://votre-domaine.com/api/webhooks/stripe`
   - Événement : `checkout.session.completed`
   - Copiez le **Signing secret** (commence par `whsec_`)

**Dans votre `.env` :**
```env
STRIPE_SECRET_KEY=sk_test_votre_cle
STRIPE_WEBHOOK_SECRET=whsec_votre_secret
```

> ✅ Sans Stripe : le Premium fonctionne quand même (débit sur le solde de l'utilisateur)

---

### ÉTAPE 3 — Gmail (Emails transactionnels)

**Option A — Gmail (recommandé pour commencer) :**

1. Activez la **validation en 2 étapes** sur votre compte Google
2. Allez sur : **https://myaccount.google.com/apppasswords**
3. Créez un mot de passe d'application → copiez les 16 caractères

**Dans votre `.env` :**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=votre@gmail.com
EMAIL_PASS=xxxx-xxxx-xxxx-xxxx
EMAIL_FROM=Money-Maker <votre@gmail.com>
```

**Option B — SendGrid (recommandé en production) :**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=SG.votre-cle-api
EMAIL_FROM=Money-Maker <votre@gmail.com>
```

> ✅ Sans email : l'app fonctionne, les emails sont affichés dans la console

---

### ÉTAPE 4 — PayPal (Paiements automatiques aux utilisateurs)

1. Créez un compte sur **https://developer.paypal.com**
2. **My Apps & Credentials** → **Create App**
3. Copiez **Client ID** et **Secret**
4. Dans les permissions de l'app, activez **Payouts**
5. Testez d'abord avec `PAYPAL_ENV=sandbox`

**Dans votre `.env` :**
```env
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=votre_client_id
PAYPAL_SECRET=votre_secret
```

Changez `sandbox` → `production` quand tout est vérifié.

> ✅ Sans PayPal : les retraits restent en mode manuel (vous payez vous-même)

---

### ÉTAPE 5 — Assistant IA Maya (Optionnel)

1. Créez un compte sur **https://platform.openai.com**
2. **API keys** → **Create new secret key**
3. Copiez la clé (commence par `sk-`)

**Dans votre `.env` :**
```env
AI_INTEGRATIONS_OPENAI_API_KEY=sk-votre-cle
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```

> ✅ Sans OpenAI : l'app fonctionne, le chat Maya sera désactivé

---

## ▶️ Lancer l'application

```bash
# Installer les dépendances
npm install

# Démarrer
npm start
```

Ouvrez : **http://localhost:5000**

Vérifications :
- http://localhost:5000/health → `{"ok":true}`
- http://localhost:5000/api/test → `{"message":"API OK"}`

---

## 👑 Devenir Admin

Le **1er compte inscrit** devient automatiquement Admin.

1. Allez sur http://localhost:5000
2. Cliquez **S'inscrire**
3. Créez votre compte
4. Vous verrez le bouton **Admin** dans la navigation

---

## 📁 Structure du projet

```
money-maker/
├── setup.js           ← Script de configuration automatique
├── schema.sql         ← Base de données (à exécuter une seule fois)
├── .env.example       ← Template de configuration
├── .env               ← Votre configuration (créé par setup.js)
├── .gitignore         ← Protège votre .env
├── package.json
├── src/
│   ├── server.js          Serveur Express
│   ├── routes.js          37 routes API
│   ├── auth.js            Authentification + vérif email + reset mdp
│   ├── security.js        Rate limiting, Helmet, anti-fraude
│   ├── db.js              PostgreSQL
│   ├── email.js           Emails (Nodemailer)
│   ├── payments.js        PayPal Payouts
│   ├── stripe-checkout.js Stripe Checkout
│   └── ai.js              Assistante Maya
└── public/
    ├── index.html
    ├── app.js             Frontend SPA complet
    └── styles.css
```

---

## 💰 Modèle économique

| Par vue | Montant |
|---------|---------|
| Revenu pub (vous) | 8¢ |
| Récompense user | 2¢ |
| **Votre marge** | **6¢** |

100 users × 50 vues/jour = **300€/jour de marge**

Tous les montants sont modifiables depuis **Admin → Paramètres**.

---

## 🔒 Sécurité incluse

- Mots de passe hachés (bcrypt)
- Sessions sécurisées (PostgreSQL)
- Rate limiting (5 limiteurs distincts)
- Anti-bruteforce (verrouillage après 7 tentatives)
- Anti-fraude (limites IP, délais entre vues)
- Headers sécurisés (Helmet + CSP)
- Journal d'audit complet
- Validation et sanitisation de toutes les entrées

---

## 🌐 Déployer en production

**Railway (recommandé) :**
1. Créez un compte sur https://railway.app
2. New Project → Deploy from GitHub (ou upload direct)
3. Ajoutez les variables d'env dans **Variables**
4. Changez `NODE_ENV=production`
5. Railway génère une URL publique automatiquement

**Render :**
1. https://render.com → New Web Service
2. Upload votre code
3. Build command : `npm install`
4. Start command : `npm start`
