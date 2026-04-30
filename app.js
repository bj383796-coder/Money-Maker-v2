// =====================================================================
// Money-Maker — Frontend SPA
// =====================================================================
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
const app = $('#app');

const state = {
  user: null,
  view: 'landing',
  loading: false,
  adminTab: 'overview',
};

// ---------- helpers ---------------------------------------------------
const fmtMoney = (cents) => ((cents || 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmtNum = (n) => (n || 0).toLocaleString('fr-FR');
const initials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, type = 'info') {
  const t = document.createElement('div');
  const colors = { info: 'bg-ink-700 border-ink-600', success: 'bg-brand-600 border-brand-500', error: 'bg-red-600 border-red-500' };
  t.className = `toast fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl border shadow-2xl text-white max-w-sm text-sm font-medium ${colors[type] || colors.info}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3000);
  setTimeout(() => t.remove(), 3400);
}

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch('/api' + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Erreur');
  return data;
}

async function loadMe() {
  try { state.user = await api('/me'); return true; }
  catch { state.user = null; return false; }
}

function navigate(view) {
  state.view = view;
  if (view !== 'watch') stopTimer();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
window.navigate = navigate;

window.logout = async () => {
  await api('/auth/logout', 'POST').catch(() => {});
  state.user = null;
  state.view = 'landing';
  render();
};

// ---------- icons (inline SVG) ----------------------------------------
const I = {
  logo: `<svg viewBox="0 0 32 32" fill="none" class="w-8 h-8"><rect width="32" height="32" rx="8" fill="url(#mmg)"/><text x="16" y="23" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" font-weight="800" fill="#fff">$</text><defs><linearGradient id="mmg" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#10b981"/><stop offset="1" stop-color="#047857"/></linearGradient></defs></svg>`,
  home: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12L12 4l9 8M5 10v10h14V10"/></svg>`,
  play: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  users: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 016-6h0a6 6 0 016 6v1M22 21v-1a6 6 0 00-4-5.7"/></svg>`,
  wallet: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h15a3 3 0 013 3v8a3 3 0 01-3 3H5a2 2 0 01-2-2V7zM3 7l3-4h12M17 14h.01"/></svg>`,
  shield: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z"/></svg>`,
  bolt: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z"/></svg>`,
  check: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>`,
  star: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>`,
  copy: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>`,
  arrow: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>`,
  cog: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>`,
  trophy: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM5 4H3v3a3 3 0 003 3M19 4h2v3a3 3 0 01-3 3"/></svg>`,
  lock: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`,
  crown: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7zm2 14h14v2H5v-2z"/></svg>`,
  chat: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-3.5-7.1L21 3v6h-6"/></svg>`,
  send: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>`,
  close: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6l-12 12"/></svg>`,
};

// =====================================================================
// LANDING PAGE
// =====================================================================
function landingView() {
  return `
    <div class="relative overflow-hidden">
      <!-- Background blobs -->
      <div class="blob bg-brand-500" style="width:520px;height:520px;top:-180px;left:-150px"></div>
      <div class="blob bg-blue-500" style="width:420px;height:420px;top:50px;right:-120px"></div>

      <!-- NAV -->
      <header class="relative z-20">
        <div class="max-w-7xl mx-auto px-5 py-5 flex items-center justify-between">
          <a class="flex items-center gap-2" href="#">
            ${I.logo}
            <span class="font-bold text-lg tracking-tight">Money-Maker</span>
          </a>
          <nav class="hidden md:flex items-center gap-7 text-sm text-ink-300">
            <a href="#features" class="hover:text-white">Avantages</a>
            <a href="#how" class="hover:text-white">Fonctionnement</a>
            <a href="#proof" class="hover:text-white">Preuves</a>
            <a href="#faq" class="hover:text-white">FAQ</a>
          </nav>
          <div class="flex items-center gap-2">
            <button onclick="navigate('auth')" class="btn btn-ghost btn-sm">Connexion</button>
            <button onclick="openAuth('register')" class="btn btn-primary btn-sm">S'inscrire</button>
          </div>
        </div>
      </header>

      <!-- HERO -->
      <section class="relative z-10 max-w-7xl mx-auto px-5 pt-12 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div class="fade-up">
          <div class="badge badge-success mb-5">${I.bolt} Plateforme de monétisation #1</div>
          <h1 class="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
            Transformez votre temps libre en
            <span class="gradient-text">argent réel</span>
          </h1>
          <p class="mt-5 text-lg text-ink-300 max-w-xl leading-relaxed">
            Regardez de courtes vidéos, accumulez votre solde et retirez vos gains
            via PayPal ou virement. Inscription en 30 secondes, sans engagement, sans frais cachés.
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <button onclick="openAuth('register')" class="btn btn-primary text-base px-6 py-3.5">
              Commencer gratuitement ${I.arrow}
            </button>
            <button onclick="navigate('auth')" class="btn btn-ghost text-base px-6 py-3.5">J'ai déjà un compte</button>
          </div>
          <div class="mt-7 flex flex-wrap items-center gap-6 text-sm text-ink-400">
            <div class="flex items-center gap-2">${I.shield}<span>Paiements sécurisés</span></div>
            <div class="flex items-center gap-2">${I.lock}<span>Données chiffrées</span></div>
            <div class="flex items-center gap-2">${I.check}<span>Sans carte bancaire</span></div>
          </div>
        </div>

        <!-- Hero illustration card -->
        <div class="fade-up relative" style="animation-delay:.15s">
          <div class="card p-6 glow float">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="avatar">EM</div>
                <div>
                  <div class="text-sm font-semibold">Emma · Vidéo en cours</div>
                  <div class="text-xs text-ink-400">+0,03 € chaque vidéo</div>
                </div>
              </div>
              <span class="badge badge-success">En ligne</span>
            </div>
            <div class="aspect-video rounded-xl bg-gradient-to-br from-ink-800 to-ink-900 border border-ink-700 flex items-center justify-center relative overflow-hidden">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.18),transparent_60%)]"></div>
              <div class="w-16 h-16 rounded-full bg-brand-500/90 flex items-center justify-center shadow-2xl">
                ${I.play.replace('w-4 h-4', 'w-7 h-7')}
              </div>
            </div>
            <div class="progress-track mt-4"><div class="progress-bar" style="width:72%"></div></div>
            <div class="flex justify-between text-xs text-ink-400 mt-2"><span>22 / 30 sec</span><span>Récompense : <strong class="text-brand-300">+0,03 €</strong></span></div>
            <div class="mt-5 grid grid-cols-3 gap-3">
              <div class="rounded-lg bg-ink-900/60 border border-ink-700/60 p-3 text-center">
                <div class="text-xs text-ink-400">Solde</div>
                <div class="text-base font-bold text-brand-300">12,47 €</div>
              </div>
              <div class="rounded-lg bg-ink-900/60 border border-ink-700/60 p-3 text-center">
                <div class="text-xs text-ink-400">Vues</div>
                <div class="text-base font-bold">428</div>
              </div>
              <div class="rounded-lg bg-ink-900/60 border border-ink-700/60 p-3 text-center">
                <div class="text-xs text-ink-400">Filleuls</div>
                <div class="text-base font-bold">7</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TRUST STATS -->
      <section class="relative z-10 max-w-6xl mx-auto px-5 -mt-8 mb-20">
        <div class="card p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div><div class="text-3xl md:text-4xl font-extrabold text-brand-300" id="stat-users">…</div><div class="text-sm text-ink-400 mt-1">Utilisateurs inscrits</div></div>
          <div><div class="text-3xl md:text-4xl font-extrabold text-brand-300" id="stat-views">…</div><div class="text-sm text-ink-400 mt-1">Vidéos regardées</div></div>
          <div><div class="text-3xl md:text-4xl font-extrabold text-brand-300" id="stat-paid">…</div><div class="text-sm text-ink-400 mt-1">Récompenses créditées</div></div>
          <div><div class="text-3xl md:text-4xl font-extrabold text-brand-300" id="stat-out">…</div><div class="text-sm text-ink-400 mt-1">Versements effectués</div></div>
        </div>
      </section>

      <!-- FEATURES -->
      <section id="features" class="relative z-10 max-w-7xl mx-auto px-5 py-16">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <h2 class="text-3xl md:text-4xl font-bold">Pourquoi Money-Maker ?</h2>
          <p class="text-ink-400 mt-3">Une plateforme conçue pour les gens qui veulent gagner sérieusement, sans pièges.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-5">
          ${featureCard(I.bolt, 'Récompenses instantanées', 'Chaque vidéo regardée jusqu\'au bout crédite votre solde immédiatement. Pas d\'attente, pas de validation manuelle.')}
          ${featureCard(I.shield, 'Paiements protégés', 'PayPal et virement bancaire sécurisés. Votre solde est conservé en base de données, pas dans votre navigateur.')}
          ${featureCard(I.users, 'Programme de parrainage', 'Invitez vos amis avec votre lien unique et gagnez un bonus à chaque inscription. Cumulez sans limite.')}
          ${featureCard(I.lock, 'Anti-fraude intégré', 'Protection IP, délais entre vidéos, vérifications côté serveur. La plateforme est saine pour tous.')}
          ${featureCard(I.wallet, 'Retrait dès 5 €', 'Un seuil bas et accessible. Demandez votre virement directement depuis votre tableau de bord.')}
          ${featureCard(I.trophy, 'Programme évolutif', 'Plus vous regardez, plus vous gagnez. Système conçu pour récompenser les utilisateurs réguliers.')}
        </div>
      </section>

      <div class="section-divider"></div>

      <!-- HOW -->
      <section id="how" class="relative z-10 max-w-6xl mx-auto px-5 py-20">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <h2 class="text-3xl md:text-4xl font-bold">3 étapes pour commencer</h2>
          <p class="text-ink-400 mt-3">Inscription en 30 secondes. Aucun téléchargement requis.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-6">
          ${stepCard('1', 'Créez votre compte', 'Inscrivez-vous gratuitement avec votre email. Vous recevez automatiquement votre code de parrainage.')}
          ${stepCard('2', 'Regardez des vidéos', 'Connectez-vous, lancez la lecture et laissez la vidéo se terminer. Votre solde grandit à chaque vue.')}
          ${stepCard('3', 'Retirez vos gains', 'Dès 5 €, demandez un virement PayPal ou bancaire depuis votre tableau de bord.')}
        </div>
        <div class="text-center mt-12">
          <button onclick="openAuth('register')" class="btn btn-primary text-base px-7 py-3.5">Créer mon compte gratuitement ${I.arrow}</button>
        </div>
      </section>

      <div class="section-divider"></div>

      <!-- PROOF / LEADERBOARD -->
      <section id="proof" class="relative z-10 max-w-5xl mx-auto px-5 py-20">
        <div class="text-center max-w-2xl mx-auto mb-10">
          <h2 class="text-3xl md:text-4xl font-bold">Top des utilisateurs cette saison</h2>
          <p class="text-ink-400 mt-3">Mis à jour en temps réel.</p>
        </div>
        <div class="card overflow-hidden" id="leaderboard-wrap">
          <div class="p-6 text-center text-ink-400"><div class="spinner mx-auto"></div></div>
        </div>
      </section>

      <div class="section-divider"></div>

      <!-- FAQ -->
      <section id="faq" class="relative z-10 max-w-3xl mx-auto px-5 py-20">
        <div class="text-center mb-10">
          <h2 class="text-3xl md:text-4xl font-bold">Questions fréquentes</h2>
        </div>
        <div class="space-y-3">
          ${faq('Money-Maker est-il vraiment gratuit ?', 'Oui, l\'inscription et l\'utilisation de la plateforme sont 100% gratuites. Vous n\'avez jamais à payer pour gagner.')}
          ${faq('Comment suis-je payé ?', 'Lorsque vous atteignez le seuil de retrait (5 €), vous demandez un virement vers votre PayPal ou votre IBAN bancaire depuis votre tableau de bord.')}
          ${faq('Combien puis-je gagner ?', 'Cela dépend du temps que vous y consacrez et du nombre d\'amis que vous parrainez. Les utilisateurs réguliers atteignent facilement plusieurs dizaines d\'euros par mois.')}
          ${faq('Mes données sont-elles sécurisées ?', 'Oui : mots de passe chiffrés, sessions sécurisées, base de données isolée. Nous ne vendons jamais vos informations.')}
          ${faq('Puis-je tricher en boucle sur la même vidéo ?', 'Non. Notre système anti-fraude vérifie chaque vue : limites par IP, délais minimum entre vidéos, validation côté serveur.')}
        </div>
      </section>

      <!-- CTA -->
      <section class="relative z-10 max-w-5xl mx-auto px-5 pb-24">
        <div class="card p-10 text-center glow">
          <h2 class="text-3xl md:text-4xl font-bold">Prêt à commencer à gagner ?</h2>
          <p class="text-ink-300 mt-3 max-w-xl mx-auto">Rejoignez notre communauté en quelques secondes. Pas de carte bancaire, pas d'engagement.</p>
          <button onclick="openAuth('register')" class="btn btn-primary text-base mt-7 px-8 py-4">Créer mon compte ${I.arrow}</button>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="relative z-10 border-t border-ink-800/60 py-8">
        <div class="max-w-7xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ink-500">
          <div class="flex items-center gap-2">${I.logo}<span class="font-semibold text-ink-300">Money-Maker</span></div>
          <div class="flex items-center gap-4 flex-wrap justify-center">
            <span>© ${new Date().getFullYear()} Money-Maker</span>
            <span>·</span>
            <a href="#" onclick="navigate('cgu'); return false;" class="hover:text-ink-300">CGU</a>
            <span>·</span>
            <a href="#" onclick="navigate('privacy'); return false;" class="hover:text-ink-300">Confidentialité</a>
            <span>·</span>
            <a href="#" onclick="navigate('support'); return false;" class="hover:text-ink-300">Contact</a>
          </div>
        </div>
      </footer>
    </div>`;
}

function featureCard(icon, title, body) {
  return `
    <div class="card card-hover p-6">
      <div class="w-11 h-11 rounded-xl bg-brand-500/15 text-brand-300 flex items-center justify-center mb-4">${icon}</div>
      <h3 class="font-semibold text-lg">${title}</h3>
      <p class="text-ink-400 text-sm mt-2 leading-relaxed">${body}</p>
    </div>`;
}

function stepCard(num, title, body) {
  return `
    <div class="card p-6 relative">
      <div class="absolute -top-4 -left-2 w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center font-extrabold text-white shadow-lg">${num}</div>
      <h3 class="font-semibold text-lg mt-4">${title}</h3>
      <p class="text-ink-400 text-sm mt-2 leading-relaxed">${body}</p>
    </div>`;
}

function faq(q, a) {
  return `
    <details class="card p-5 group">
      <summary class="cursor-pointer flex items-center justify-between font-semibold list-none">
        <span>${q}</span>
        <span class="text-brand-300 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
      </summary>
      <p class="mt-3 text-ink-400 text-sm leading-relaxed">${a}</p>
    </details>`;
}

async function bindLanding() {
  // hydrate stats
  try {
    const s = await api('/public/stats');
    const setN = (id, v) => { const el = $('#'+id); if (el) animateCount(el, v); };
    setN('stat-users', s.users_total);
    setN('stat-views', s.views_total);
    const setM = (id, v) => { const el = $('#'+id); if (el) el.textContent = fmtMoney(v); };
    setM('stat-paid', s.total_paid_cents);
    setM('stat-out', s.withdrawn_cents);
  } catch {}

  // leaderboard
  try {
    const { leaders } = await api('/leaderboard');
    const wrap = $('#leaderboard-wrap');
    if (!wrap) return;
    if (!leaders.length) {
      wrap.innerHTML = `<div class="p-10 text-center text-ink-400">Soyez le premier à apparaître ici ! <button onclick="openAuth('register')" class="text-brand-300 underline ml-1">Inscrivez-vous</button>.</div>`;
      return;
    }
    wrap.innerHTML = `<table class="data">
      <thead><tr><th class="w-16">Rang</th><th>Utilisateur</th><th class="text-right">Total gagné</th></tr></thead>
      <tbody>${leaders.map((l, i) => `
        <tr>
          <td><span class="text-2xl font-extrabold ${i===0?'text-amber-400':i===1?'text-ink-300':i===2?'text-orange-400':'text-ink-500'}">#${i+1}</span></td>
          <td><div class="flex items-center gap-3"><div class="avatar">${initials(l.username)}</div><span class="font-medium">${escape(l.username)}</span></div></td>
          <td class="text-right font-bold text-brand-300">${fmtMoney(l.lifetime_earned_cents)}</td>
        </tr>`).join('')}</tbody></table>`;
  } catch {}
}

function animateCount(el, target) {
  const dur = 900, start = performance.now(), from = 0;
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const v = Math.floor(from + (target - from) * (1 - Math.pow(1 - t, 3)));
    el.textContent = fmtNum(v);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// =====================================================================
// AUTH
// =====================================================================
let authMode = 'login';
window.openAuth = (mode = 'register') => { authMode = mode; navigate('auth'); };

function authView() {
  return `
    <div class="min-h-screen flex items-center justify-center px-5 py-10 relative overflow-hidden">
      <div class="blob bg-brand-500" style="width:500px;height:500px;top:-180px;right:-150px"></div>
      <div class="blob bg-blue-500" style="width:400px;height:400px;bottom:-150px;left:-100px"></div>
      <div class="relative z-10 w-full max-w-md">
        <div class="text-center mb-7 fade-up">
          <a href="#" onclick="navigate('landing'); return false;" class="inline-flex items-center gap-2">
            ${I.logo}
            <span class="font-bold text-xl">Money-Maker</span>
          </a>
        </div>
        <div class="card p-7 fade-up">
          <div class="grid grid-cols-2 gap-1 p-1 bg-ink-900/60 rounded-xl mb-6">
            <button id="tab-login" class="py-2 rounded-lg text-sm font-semibold transition">Connexion</button>
            <button id="tab-register" class="py-2 rounded-lg text-sm font-semibold transition">Inscription</button>
          </div>
          <form id="auth-form" class="space-y-3">
            <div id="username-wrap" class="hidden">
              <label class="text-xs text-ink-400 mb-1 block">Nom d'utilisateur</label>
              <input id="username-field" type="text" placeholder="Ex : Emma" class="input" />
            </div>
            <div>
              <label class="text-xs text-ink-400 mb-1 block">Email</label>
              <input id="email" type="email" placeholder="vous@email.com" required class="input" autocomplete="email" />
            </div>
            <div>
              <label class="text-xs text-ink-400 mb-1 block">Mot de passe</label>
              <input id="password" type="password" placeholder="Min. 8 caractères, 1 lettre + 1 chiffre" required class="input" autocomplete="current-password" minlength="8" />
            </div>
            <div id="ref-wrap" class="hidden">
              <label class="text-xs text-ink-400 mb-1 block">Code de parrainage <span class="text-ink-500">(optionnel)</span></label>
              <input id="ref-field" type="text" placeholder="Ex : 4D8D582E" class="input" />
            </div>
            <button type="submit" id="auth-submit" class="btn btn-primary w-full py-3">Se connecter</button>
            <div id="forgot-wrap" class="text-center">
              <a href="#" id="forgot-link" class="text-xs text-brand-400 hover:text-brand-300">Mot de passe oublié ?</a>
            </div>
          </form>
          <div id="forgot-form-wrap" class="hidden space-y-3">
            <p class="text-sm text-ink-300 mb-3">Entrez votre email pour recevoir un lien de réinitialisation.</p>
            <input id="forgot-email" type="email" placeholder="vous@email.com" class="input" />
            <button id="forgot-submit" class="btn btn-primary w-full py-3">Envoyer le lien</button>
            <p class="text-center text-xs"><a href="#" id="back-to-login" class="text-brand-400 hover:text-brand-300">← Retour à la connexion</a></p>
          </div>
          <p class="text-center text-xs text-ink-500 mt-5">
            En continuant, vous acceptez de respecter les règles d'utilisation de la plateforme.
          </p>
        </div>
        <p class="text-center text-xs text-ink-500 mt-6">
          <a href="#" onclick="navigate('landing'); return false;" class="hover:text-ink-300">← Retour à l'accueil</a>
        </p>
      </div>
    </div>`;
}

function bindAuth() {
  const tabLogin = $('#tab-login');
  const tabRegister = $('#tab-register');
  const submit = $('#auth-submit');
  const userWrap = $('#username-wrap');
  const refWrap = $('#ref-wrap');
  const userField = $('#username-field');
  const refField = $('#ref-field');

  const refCode = new URLSearchParams(location.search).get('ref');
  if (refCode) { refField.value = refCode; authMode = 'register'; }

  function setMode(m) {
    authMode = m;
    if (m === 'login') {
      tabLogin.classList.add('bg-ink-700', 'text-white');
      tabRegister.classList.remove('bg-ink-700', 'text-white');
      tabRegister.classList.add('text-ink-400');
      tabLogin.classList.remove('text-ink-400');
      userWrap.classList.add('hidden'); refWrap.classList.add('hidden');
      submit.textContent = 'Se connecter';
    } else {
      tabRegister.classList.add('bg-ink-700', 'text-white');
      tabLogin.classList.remove('bg-ink-700', 'text-white');
      tabLogin.classList.add('text-ink-400');
      tabRegister.classList.remove('text-ink-400');
      userWrap.classList.remove('hidden'); refWrap.classList.remove('hidden');
      submit.textContent = 'Créer mon compte';
    }
  }
  tabLogin.onclick = () => setMode('login');
  tabRegister.onclick = () => setMode('register');
  setMode(authMode);

  // Mot de passe oublié
  const forgotLink = $('#forgot-link');
  const forgotWrap = $('#forgot-form-wrap');
  const authFormEl = $('#auth-form');
  const forgotWrapDiv = $('#forgot-wrap');
  if (forgotLink) {
    forgotLink.onclick = (e) => {
      e.preventDefault();
      authFormEl.classList.add('hidden');
      forgotWrapDiv && forgotWrapDiv.classList.add('hidden');
      forgotWrap.classList.remove('hidden');
    };
  }
  const backToLogin = $('#back-to-login');
  if (backToLogin) {
    backToLogin.onclick = (e) => {
      e.preventDefault();
      forgotWrap.classList.add('hidden');
      authFormEl.classList.remove('hidden');
      forgotWrapDiv && forgotWrapDiv.classList.remove('hidden');
    };
  }
  const forgotSubmit = $('#forgot-submit');
  if (forgotSubmit) {
    forgotSubmit.onclick = async () => {
      const email = $('#forgot-email').value;
      if (!email) return toast('Entrez votre email', 'error');
      forgotSubmit.disabled = true;
      forgotSubmit.textContent = 'Envoi…';
      try {
        await api('/auth/forgot-password', 'POST', { email });
        toast('Si cet email existe, un lien a été envoyé.', 'success');
        forgotWrap.classList.add('hidden');
        authFormEl.classList.remove('hidden');
        forgotWrapDiv && forgotWrapDiv.classList.remove('hidden');
      } catch (err) {
        toast(err.message, 'error');
      }
      forgotSubmit.disabled = false;
      forgotSubmit.textContent = 'Envoyer le lien';
    };
  }

  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Chargement…';
    try {
      const body = { email: $('#email').value, password: $('#password').value };
      if (authMode === 'register') {
        body.username = userField.value || undefined;
        body.referralCode = refField.value || undefined;
        await api('/auth/register', 'POST', body);
      } else {
        await api('/auth/login', 'POST', body);
      }
      await loadMe();
      state.view = 'dashboard';
      render();
      toast(authMode === 'register' ? 'Bienvenue sur Money-Maker !' : 'Connecté avec succès', 'success');
    } catch (err) {
      toast(err.message, 'error');
      submit.disabled = false;
      submit.textContent = authMode === 'login' ? 'Se connecter' : 'Créer mon compte';
    }
  };
}

// =====================================================================
// APP HEADER (for authenticated pages)
// =====================================================================
function appHeader() {
  if (!state.user) return '';
  const u = state.user;
  return `
    <header class="sticky top-0 z-40 backdrop-blur-md bg-ink-950/80 border-b border-ink-800/60">
      <div class="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          ${I.logo}
          <span class="font-bold text-base hidden sm:inline">Money-Maker</span>
          ${u.is_premium ? `<span class="badge badge-warn ml-1" title="Membre Premium">${I.crown} Premium</span>` : ''}
        </div>
        <nav class="flex items-center gap-1 overflow-x-auto">
          ${navLink('dashboard', I.home, 'Accueil')}
          ${navLink('watch', I.play, 'Regarder')}
          ${navLink('earnings', I.trophy, 'Gains')}
          ${navLink('referrals', I.users, 'Parrainage')}
          ${navLink('withdraw', I.wallet, 'Retrait')}
          ${navLink('premium', I.crown, 'Premium')}
          ${u.is_admin ? navLink('admin', I.cog, 'Admin') : ''}
        </nav>
        <div class="flex items-center gap-3">
          <div class="hidden sm:block text-right">
            <div class="text-[10px] text-ink-500 uppercase tracking-wider">Solde</div>
            <div class="text-sm font-bold text-brand-300" id="hdr-balance">${fmtMoney(u.balance_cents)}</div>
          </div>
          <div class="relative group">
            <button class="avatar" title="${escape(u.username || u.email)}">${initials(u.username || u.email)}</button>
            <div class="hidden group-hover:block absolute right-0 top-full pt-2 z-50">
              <div class="card p-2 min-w-[200px]">
                <div class="px-3 py-2 border-b border-ink-800">
                  <div class="text-sm font-semibold truncate">${escape(u.username || '')}</div>
                  <div class="text-xs text-ink-500 truncate">${escape(u.email)}</div>
                  ${u.is_premium ? `<div class="text-xs text-amber-300 mt-1">Premium jusqu'au ${new Date(u.premium_until).toLocaleDateString('fr-FR')}</div>` : ''}
                </div>
                <button onclick="navigate('premium')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-800 text-sm">${u.is_premium ? 'Gérer Premium' : 'Devenir Premium'}</button>
                <button onclick="navigate('earnings')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-800 text-sm">📊 Historique des gains</button>
                <button onclick="navigate('support')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-800 text-sm">💬 Support</button>
                <div class="border-t border-ink-800 my-1"></div>
                <button onclick="navigate('cgu')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-800 text-xs text-ink-500">CGU</button>
                <button onclick="navigate('privacy')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-800 text-xs text-ink-500">Confidentialité</button>
                <div class="border-t border-ink-800 my-1"></div>
                <button onclick="logout()" class="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-800 text-sm">Se déconnecter</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>`;
}

function navLink(view, icon, label) {
  return `<button onclick="navigate('${view}')" class="nav-link ${state.view === view ? 'active' : ''}">${icon}<span class="nav-mobile-hide">${label}</span></button>`;
}

// =====================================================================
// DASHBOARD
// =====================================================================
function dashboardView() {
  const u = state.user;
  return `
    <div class="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-bold">Bonjour, ${escape(u.username || 'utilisateur')} 👋</h1>
        <p class="text-ink-400 mt-1">Voici votre tableau de bord. Lancez une vidéo pour commencer à gagner.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        ${kpiCard('Solde disponible', fmtMoney(u.balance_cents), I.wallet, 'text-brand-300')}
        ${kpiCard('Total gagné', fmtMoney(u.lifetime_earned_cents), I.trophy, 'text-amber-300')}
        ${kpiCard('Vidéos regardées', fmtNum(u.total_views), I.play, 'text-blue-300')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <!-- Quick actions -->
        <div class="lg:col-span-2 card p-6">
          <h2 class="text-lg font-semibold mb-1">Actions rapides</h2>
          <p class="text-ink-400 text-sm mb-5">Choisissez votre prochaine étape.</p>
          <div class="grid sm:grid-cols-2 gap-3">
            <button onclick="navigate('watch')" class="card card-hover p-5 text-left">
              <div class="w-10 h-10 rounded-lg bg-brand-500/15 text-brand-300 flex items-center justify-center mb-3">${I.play}</div>
              <div class="font-semibold">Regarder une vidéo</div>
              <div class="text-xs text-ink-400 mt-1">Commencez à gagner immédiatement</div>
            </button>
            <button onclick="navigate('referrals')" class="card card-hover p-5 text-left">
              <div class="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center mb-3">${I.users}</div>
              <div class="font-semibold">Inviter des amis</div>
              <div class="text-xs text-ink-400 mt-1">Bonus garanti à chaque inscription</div>
            </button>
            <button onclick="navigate('withdraw')" class="card card-hover p-5 text-left">
              <div class="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center mb-3">${I.wallet}</div>
              <div class="font-semibold">Demander un retrait</div>
              <div class="text-xs text-ink-400 mt-1">PayPal ou virement bancaire</div>
            </button>
            ${u.is_premium ? `
              <div class="card p-5 text-left bg-gradient-to-br from-amber-500/10 to-amber-700/5 border-amber-500/30">
                <div class="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center mb-3">${I.crown}</div>
                <div class="font-semibold">Premium actif</div>
                <div class="text-xs text-ink-400 mt-1">Récompenses ×1,5 jusqu'au ${new Date(u.premium_until).toLocaleDateString('fr-FR')}</div>
              </div>` : `
              <button onclick="navigate('premium')" class="card card-hover p-5 text-left bg-gradient-to-br from-amber-500/10 to-amber-700/5 border-amber-500/30">
                <div class="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center mb-3">${I.crown}</div>
                <div class="font-semibold">Passer Premium</div>
                <div class="text-xs text-ink-400 mt-1">+50% sur toutes vos récompenses</div>
              </button>`}
          </div>
        </div>

        <!-- Referral mini -->
        <div class="card p-6">
          <h2 class="text-lg font-semibold mb-3">Votre code parrainage</h2>
          <div class="bg-ink-900/60 border border-ink-800 rounded-xl p-4 text-center">
            <div class="text-xs text-ink-400 mb-1">Code</div>
            <div class="font-mono text-2xl font-extrabold text-brand-300 tracking-widest">${u.referral_code}</div>
          </div>
          <button onclick="copyText('${location.origin}/?ref=${u.referral_code}')" class="btn btn-ghost w-full mt-3 text-sm">${I.copy} Copier mon lien</button>
          <button onclick="navigate('referrals')" class="btn btn-primary w-full mt-2 text-sm">Voir mes filleuls (${u.referral_count})</button>
        </div>
      </div>

      <div class="card p-6 mt-5">
        <h3 class="font-semibold mb-3">Conseils pour maximiser vos gains</h3>
        <ul class="grid md:grid-cols-3 gap-3 text-sm">
          <li class="flex gap-2 text-ink-300"><span class="text-brand-400 flex-shrink-0">${I.check}</span> Regardez les vidéos jusqu'au bout pour valider la récompense.</li>
          <li class="flex gap-2 text-ink-300"><span class="text-brand-400 flex-shrink-0">${I.check}</span> Parrainez vos amis : chaque inscription vous rapporte un bonus.</li>
          <li class="flex gap-2 text-ink-300"><span class="text-brand-400 flex-shrink-0">${I.check}</span> Revenez chaque jour : nouvelles vidéos régulièrement.</li>
        </ul>
      </div>
    </div>`;
}

function kpiCard(label, value, icon, color) {
  return `
    <div class="card p-5">
      <div class="flex items-start justify-between">
        <div>
          <div class="text-xs uppercase text-ink-500 font-semibold tracking-wider">${label}</div>
          <div class="text-3xl font-extrabold mt-2 ${color}">${value}</div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-ink-800/70 ${color} flex items-center justify-center">${icon}</div>
      </div>
    </div>`;
}

window.copyText = (txt) => {
  navigator.clipboard.writeText(txt).then(() => toast('Lien copié dans le presse-papier', 'success'))
    .catch(() => toast('Impossible de copier', 'error'));
};

// =====================================================================
// WATCH
// =====================================================================
let ytPlayer = null;
let watchTimer = null;
let watchedSeconds = 0;
let currentVideo = null;

function watchView() {
  return `
    <div class="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold">Regarder & gagner</h1>
        <p class="text-ink-400 mt-1">Regardez la vidéo en entier pour valider votre récompense.</p>
      </div>
      <div id="watch-area" class="card p-5 md:p-7 min-h-[400px] flex items-center justify-center">
        <div class="spinner"></div>
      </div>
    </div>`;
}

async function loadNextVideo() {
  const area = $('#watch-area');
  if (!area) return;
  area.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await api('/videos/next');
    if (!data.video) {
      area.innerHTML = `<div class="text-center py-10"><p class="text-ink-300">Aucune vidéo disponible pour le moment.</p><button onclick="loadNextVideo()" class="btn btn-ghost mt-4">Réessayer</button></div>`;
      return;
    }
    currentVideo = data.video;
    watchedSeconds = 0;

    if (data.waitSeconds && data.waitSeconds > 0) {
      area.innerHTML = `
        <div class="text-center py-10 w-full">
          <div class="w-14 h-14 rounded-full bg-amber-500/15 text-amber-300 mx-auto flex items-center justify-center mb-4">${I.shield}</div>
          <p class="text-ink-300 mb-2">Sécurité anti-fraude</p>
          <p class="text-2xl font-bold">Patientez <span id="cd" class="text-amber-300">${data.waitSeconds}</span>s</p>
          <p class="text-xs text-ink-500 mt-2">avant la prochaine vidéo</p>
        </div>`;
      let s = data.waitSeconds;
      const itv = setInterval(() => {
        s--;
        const cd = $('#cd'); if (cd) cd.textContent = s;
        if (s <= 0) { clearInterval(itv); renderPlayer(); }
      }, 1000);
    } else {
      renderPlayer();
    }
  } catch (e) {
    area.innerHTML = `<div class="text-center py-10"><p class="text-red-300">${escape(e.message)}</p><button onclick="loadNextVideo()" class="btn btn-ghost mt-4">Réessayer</button></div>`;
  }
}
window.loadNextVideo = loadNextVideo;

function renderPlayer() {
  const v = currentVideo;
  const area = $('#watch-area');
  area.innerHTML = `
    <div class="w-full">
      <div class="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 class="font-semibold text-lg">${escape(v.title)}</h3>
          <p class="text-xs text-ink-400 mt-1">Durée requise ${v.duration_seconds}s · Récompense <span class="text-brand-300 font-bold">${fmtMoney(v.reward_cents)}</span></p>
        </div>
        <span class="badge badge-success">${I.bolt} Récompense active</span>
      </div>
      <div class="aspect-video bg-black rounded-xl overflow-hidden border border-ink-800">
        <div id="yt-player" class="w-full h-full"></div>
      </div>
      <div class="mt-4">
        <div class="flex justify-between text-xs text-ink-400 mb-1.5">
          <span><span id="watch-counter">0</span> / ${v.duration_seconds} sec</span>
          <span id="watch-pct">0%</span>
        </div>
        <div class="progress-track"><div id="watch-progress" class="progress-bar" style="width:0%"></div></div>
      </div>
      <button id="claim-btn" disabled class="btn btn-primary w-full mt-5 py-3.5">${I.lock} Continuez à regarder…</button>
      <p class="text-xs text-ink-500 text-center mt-3">${I.shield} Anti-fraude actif · Limite par IP · Validation côté serveur</p>
    </div>`;
  if (window.YT && window.YT.Player) initPlayer();
  else window.onYouTubeIframeAPIReady = initPlayer;
}

function initPlayer() {
  const v = currentVideo;
  if (ytPlayer) { try { ytPlayer.destroy(); } catch {} }
  ytPlayer = new YT.Player('yt-player', {
    videoId: v.youtube_id,
    playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0 },
    events: {
      onReady: (e) => { try { e.target.playVideo(); } catch {} startTimer(); },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) startTimer();
        else stopTimer();
      },
    },
  });
}

function startTimer() {
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    watchedSeconds++;
    const v = currentVideo;
    const pct = Math.min(100, (watchedSeconds / v.duration_seconds) * 100);
    const pb = $('#watch-progress'); if (pb) pb.style.width = pct + '%';
    const wc = $('#watch-counter'); if (wc) wc.textContent = Math.min(watchedSeconds, v.duration_seconds);
    const wp = $('#watch-pct'); if (wp) wp.textContent = Math.round(pct) + '%';
    if (watchedSeconds >= v.duration_seconds) {
      stopTimer();
      const btn = $('#claim-btn');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${I.check} Réclamer ${fmtMoney(v.reward_cents)}`;
        btn.onclick = claimReward;
      }
    }
  }, 1000);
}

function stopTimer() { if (watchTimer) { clearInterval(watchTimer); watchTimer = null; } }

async function claimReward() {
  const btn = $('#claim-btn');
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const r = await api(`/videos/${currentVideo.id}/claim`, 'POST', { watchedSeconds });
    state.user.balance_cents = r.balance_cents;
    state.user.lifetime_earned_cents += r.reward_cents;
    state.user.total_views += 1;
    const hdr = $('#hdr-balance'); if (hdr) hdr.textContent = fmtMoney(r.balance_cents);
    showRewardAnimation(r.reward_cents);
    setTimeout(loadNextVideo, 1500);
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Réessayer';
  }
}

function showRewardAnimation(cents) {
  const div = document.createElement('div');
  div.className = 'coin-pop fixed inset-0 flex items-center justify-center z-[100] pointer-events-none';
  div.innerHTML = `<div class="bg-gradient-to-br from-brand-500 to-brand-600 text-white text-4xl md:text-5xl font-extrabold px-8 py-6 rounded-2xl shadow-2xl flex items-center gap-3">+${fmtMoney(cents)} ${I.bolt.replace('w-5 h-5', 'w-9 h-9')}</div>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1500);
}

// =====================================================================
// REFERRALS
// =====================================================================
async function referralsView() {
  const u = state.user;
  const link = `${location.origin}/?ref=${u.referral_code}`;
  let data = { referrals: [], totalBonusCents: 0 };
  try { data = await api('/referrals'); } catch {}
  return `
    <div class="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold">Parrainage</h1>
        <p class="text-ink-400 mt-1">Invitez vos amis et gagnez un bonus à chaque inscription.</p>
      </div>

      <div class="grid lg:grid-cols-3 gap-5 mb-5">
        ${kpiCard('Filleuls', fmtNum(data.referrals.length), I.users, 'text-blue-300')}
        ${kpiCard('Bonus gagnés', fmtMoney(data.totalBonusCents), I.trophy, 'text-amber-300')}
        ${kpiCard('Votre code', `<span class="font-mono">${u.referral_code}</span>`, I.star, 'text-brand-300')}
      </div>

      <div class="card p-6 mb-5">
        <h2 class="font-semibold text-lg mb-3">Votre lien de partage</h2>
        <div class="flex flex-col sm:flex-row gap-2">
          <input id="ref-link" readonly value="${link}" class="input flex-1 font-mono text-sm" />
          <button onclick="copyText('${link}')" class="btn btn-primary">${I.copy} Copier</button>
        </div>
        <p class="text-xs text-ink-500 mt-2">Partagez ce lien sur WhatsApp, Instagram, TikTok, par email…</p>
      </div>

      <div class="card overflow-hidden">
        <div class="px-6 py-4 border-b border-ink-800/60">
          <h2 class="font-semibold text-lg">Vos filleuls</h2>
        </div>
        ${data.referrals.length === 0
          ? `<div class="px-6 py-12 text-center text-ink-400">Aucun filleul pour l'instant. Partagez votre lien !</div>`
          : `<table class="data">
              <thead><tr><th>Utilisateur</th><th>Inscrit le</th><th class="text-right">Bonus</th></tr></thead>
              <tbody>${data.referrals.map(r => `
                <tr>
                  <td><div class="flex items-center gap-3"><div class="avatar">${initials(r.username || r.email)}</div><div><div class="font-medium">${escape(r.username || r.email)}</div><div class="text-xs text-ink-500">${escape(r.email)}</div></div></div></td>
                  <td class="text-ink-400">${new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td class="text-right font-bold text-brand-300">+${fmtMoney(r.bonus_cents)}</td>
                </tr>`).join('')}</tbody></table>`
        }
      </div>
    </div>`;
}

// =====================================================================
// WITHDRAW
// =====================================================================
async function withdrawView() {
  const u = state.user;
  let withdrawals = [];
  try { withdrawals = (await api('/withdrawals')).withdrawals; } catch {}
  const statusBadge = (s) => {
    const m = { pending: ['badge-warn', 'En attente'], paid: ['badge-success', 'Payé'], rejected: ['badge-danger', 'Refusé'] };
    const [cls, label] = m[s] || ['badge-info', s];
    return `<span class="badge ${cls}">${label}</span>`;
  };
  return `
    <div class="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold">Retrait</h1>
        <p class="text-ink-400 mt-1">Demandez le versement de vos gains. Délai 1-3 jours ouvrés.</p>
      </div>

      <div class="grid lg:grid-cols-2 gap-5">
        <div class="card p-6">
          <div class="bg-gradient-to-br from-brand-500/20 to-brand-700/10 border border-brand-500/30 rounded-xl p-5 mb-5 text-center">
            <div class="text-xs uppercase tracking-wider text-brand-200">Solde disponible</div>
            <div class="text-4xl font-extrabold text-brand-300 mt-1">${fmtMoney(u.balance_cents)}</div>
          </div>
          <form id="withdraw-form" class="space-y-3">
            <div>
              <label class="text-xs text-ink-400 mb-1 block">Montant (€)</label>
              <input id="w-amount" type="number" step="0.01" min="5" placeholder="5,00" required class="input" />
            </div>
            <div>
              <label class="text-xs text-ink-400 mb-1 block">Méthode de paiement</label>
              <select id="w-method" class="input">
                <option value="paypal">PayPal</option>
                <option value="stripe">Virement bancaire (IBAN)</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-ink-400 mb-1 block">Email PayPal ou IBAN</label>
              <input id="w-dest" type="text" required class="input" placeholder="vous@email.com ou FR76…" />
            </div>
            <button type="submit" class="btn btn-primary w-full py-3">${I.wallet} Demander le versement</button>
            <p class="text-xs text-ink-500 text-center">Retrait minimum 5 €. Aucun frais.</p>
          </form>
        </div>

        <div class="card overflow-hidden">
          <div class="px-6 py-4 border-b border-ink-800/60">
            <h2 class="font-semibold text-lg">Historique des retraits</h2>
          </div>
          ${withdrawals.length === 0
            ? `<div class="px-6 py-12 text-center text-ink-400">Aucun retrait pour le moment.</div>`
            : `<div class="divide-y divide-ink-800/60">${withdrawals.map(w => `
                <div class="px-6 py-4 flex items-center justify-between gap-3">
                  <div>
                    <div class="font-semibold">${fmtMoney(w.amount_cents)} <span class="text-ink-500 font-normal text-sm">via ${escape(w.method)}</span></div>
                    <div class="text-xs text-ink-500 mt-0.5">${new Date(w.created_at).toLocaleString('fr-FR')}</div>
                    ${w.admin_note ? `<div class="text-xs text-ink-400 mt-1">${escape(w.admin_note)}</div>` : ''}
                  </div>
                  ${statusBadge(w.status)}
                </div>`).join('')}</div>`
          }
        </div>
      </div>
    </div>`;
}

function bindWithdraw() {
  const form = $('#withdraw-form');
  if (!form) return;
  const u = state.user;
  const minAmt = u.is_premium ? 5 : 10;
  const amtField = $('#w-amount');
  if (amtField) {
    amtField.min = minAmt;
    amtField.placeholder = minAmt.toFixed(2);
  }
  const hint = form.querySelector('p.text-xs');
  if (hint) {
    hint.innerHTML = u.is_premium
      ? `Retrait minimum <strong class="text-amber-300">${minAmt} €</strong> (Premium). Aucun frais.`
      : `Retrait minimum ${minAmt} €. <button type="button" onclick="navigate('premium')" class="text-amber-300 underline">Premium</button> : retrait dès 5 €.`;
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat($('#w-amount').value) * 100);
    try {
      await api('/withdrawals', 'POST', { amountCents, method: $('#w-method').value, destination: $('#w-dest').value });
      toast('Demande envoyée — vous recevrez votre paiement sous 1-3 jours.', 'success');
      await loadMe();
      render();
    } catch (e) { toast(e.message, 'error'); }
  };
}

// =====================================================================
// PREMIUM
// =====================================================================
async function premiumView() {
  let data = { plans: [], benefits: {}, is_premium: false, balance_cents: 0 };
  try { data = await api('/premium/plans'); } catch (e) { toast(e.message, 'error'); }
  const b = data.benefits;
  const u = state.user;
  return `
    <div class="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div class="mb-6 flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-ink-950">${I.crown}</div>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">Money-Maker Premium</h1>
          <p class="text-ink-400 mt-1">Plus de gains, plus de retraits, plus de privilèges.</p>
        </div>
      </div>

      ${data.is_premium ? `
        <div class="card p-6 mb-6 bg-gradient-to-br from-amber-500/15 to-amber-700/5 border-amber-500/40">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="badge badge-warn">${I.crown} Premium actif</div>
            <div class="text-sm text-ink-300">Vous bénéficiez de tous les avantages jusqu'au <strong class="text-amber-300">${new Date(data.premium_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</div>
          </div>
        </div>` : ''}

      <div class="grid md:grid-cols-2 gap-5 mb-7">
        ${data.plans.map(p => `
          <div class="card p-6 ${p.bestValue ? 'border-amber-400/60 ring-1 ring-amber-400/30' : ''}">
            ${p.bestValue ? '<div class="badge badge-warn mb-3">★ Meilleur rapport</div>' : ''}
            <div class="text-lg font-semibold">${p.label}</div>
            <div class="text-4xl font-extrabold mt-2 text-amber-300">${fmtMoney(p.cost_cents)}</div>
            <div class="text-xs text-ink-400 mt-1">soit ${(p.cost_cents / p.days / 100).toFixed(3)} €/jour</div>
            <ul class="mt-5 space-y-2 text-sm">
              <li class="flex gap-2"><span class="text-amber-300 flex-shrink-0">${I.check}</span> Récompenses ×${b.multiplier} sur chaque vidéo</li>
              <li class="flex gap-2"><span class="text-amber-300 flex-shrink-0">${I.check}</span> Retrait dès ${(b.premium_min_withdraw_cents/100).toFixed(2)}€ (au lieu de ${(b.free_min_withdraw_cents/100).toFixed(2)}€)</li>
              <li class="flex gap-2"><span class="text-amber-300 flex-shrink-0">${I.check}</span> ${b.ai_messages_per_day_premium} messages/jour à l'assistant Maya (vs ${b.ai_messages_per_day_free})</li>
              <li class="flex gap-2"><span class="text-amber-300 flex-shrink-0">${I.check}</span> Badge Premium visible sur le classement</li>
              <li class="flex gap-2"><span class="text-amber-300 flex-shrink-0">${I.check}</span> Support prioritaire</li>
            </ul>
            <button onclick="buyPremium('${p.id}', ${p.cost_cents})" class="btn btn-primary w-full mt-5 py-3">
              ${data.is_premium ? `Prolonger de ${p.days} jours` : `Activer ${p.label}`}
            </button>
            <p class="text-xs text-ink-500 mt-2 text-center">Payé depuis votre solde Money-Maker</p>
          </div>`).join('')}
      </div>

      <div class="card p-6">
        <h3 class="font-semibold mb-2">Comment ça marche ?</h3>
        <ul class="text-sm text-ink-300 space-y-2">
          <li>• Le coût Premium est débité <strong>directement de votre solde</strong> (${fmtMoney(data.balance_cents)} disponible).</li>
          <li>• L'abonnement reste actif pour la durée choisie, même sans regarder de vidéo.</li>
          <li>• Aucun renouvellement automatique : vous décidez quand prolonger.</li>
          <li>• Annulable à tout moment depuis ce panneau (la durée restante est perdue).</li>
        </ul>
      </div>
    </div>`;
}

window.buyPremium = async (plan, cost) => {
  // Option A : payer par carte via Stripe Checkout
  if (window._stripeEnabled) {
    if (!confirm(`Payer ${fmtMoney(cost)} par carte bancaire (Stripe Checkout) ?`)) return;
    try {
      const r = await api('/premium/checkout', 'POST', { plan });
      if (r.url) { window.location.href = r.url; return; }
    } catch (e) {
      toast('Paiement carte indisponible, utilisation du solde.', 'error');
    }
  }
  // Option B : déduire du solde
  if (state.user.balance_cents < cost) {
    toast(`Solde insuffisant. Il vous manque ${fmtMoney(cost - state.user.balance_cents)}.`, 'error');
    return;
  }
  if (!confirm(`Confirmer l'achat Premium pour ${fmtMoney(cost)} (débité de votre solde) ?`)) return;
  try {
    await api('/premium/purchase', 'POST', { plan });
    await loadMe();
    toast('Bienvenue dans Premium ! 🎉', 'success');
    render();
  } catch (e) { toast(e.message, 'error'); }
};

// =====================================================================
// AI CHAT WIDGET (Maya)
// =====================================================================
const chat = { open: false, sending: false, history: [] };

function chatWidget() {
  if (!state.user) return '';
  return `
    <div id="chat-fab" class="fixed bottom-5 right-5 z-50 ${chat.open ? 'hidden' : ''}">
      <button onclick="toggleChat()" class="relative bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 text-white rounded-full w-14 h-14 shadow-2xl flex items-center justify-center transition transform hover:scale-105">
        ${I.chat}
        <span class="absolute top-0 right-0 w-3 h-3 bg-amber-400 rounded-full border-2 border-ink-950"></span>
      </button>
    </div>
    <div id="chat-panel" class="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-2.5rem)] card flex flex-col overflow-hidden shadow-2xl ${chat.open ? '' : 'hidden'}">
      <div class="flex items-center justify-between p-4 border-b border-ink-800/60 bg-ink-900/40">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm">M</div>
          <div>
            <div class="font-semibold text-sm">Maya — Assistante</div>
            <div class="text-[11px] text-ink-500 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> En ligne</div>
          </div>
        </div>
        <button onclick="toggleChat()" class="text-ink-500 hover:text-white p-1">${I.close}</button>
      </div>
      <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 text-sm"></div>
      <form id="chat-form" class="p-3 border-t border-ink-800/60 flex gap-2">
        <input id="chat-input" type="text" placeholder="Posez votre question..." maxlength="500" class="input flex-1 text-sm" autocomplete="off" />
        <button type="submit" class="btn btn-primary px-3" id="chat-send">${I.send}</button>
      </form>
    </div>`;
}

window.toggleChat = async () => {
  chat.open = !chat.open;
  $('#chat-fab')?.classList.toggle('hidden', chat.open);
  $('#chat-panel')?.classList.toggle('hidden', !chat.open);
  if (chat.open && chat.history.length === 0) {
    await loadChatHistory();
    bindChat();
    setTimeout(() => $('#chat-input')?.focus(), 50);
  }
};

async function loadChatHistory() {
  const box = $('#chat-messages');
  if (!box) return;
  try {
    const { messages } = await api('/ai/history');
    chat.history = messages || [];
  } catch { chat.history = []; }
  if (chat.history.length === 0) {
    chat.history = [{
      role: 'assistant',
      content: `Bonjour ${escape(state.user.username || '')} ! Je suis Maya, votre assistante Money-Maker. Posez-moi vos questions sur le visionnage, les retraits, le parrainage ou Premium. Je ne peux pas vous aider à frauder ni promettre de gains 😉`,
    }];
  }
  renderChatMessages();
}

function renderChatMessages() {
  const box = $('#chat-messages');
  if (!box) return;
  box.innerHTML = chat.history.map(m => {
    if (m.role === 'user') {
      return `<div class="flex justify-end"><div class="bg-brand-600/30 border border-brand-500/40 text-white px-3 py-2 rounded-xl rounded-br-sm max-w-[80%] whitespace-pre-wrap">${escape(m.content)}</div></div>`;
    }
    return `<div class="flex gap-2"><div class="w-7 h-7 flex-shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold">M</div><div class="bg-ink-800/60 border border-ink-700/60 text-ink-100 px-3 py-2 rounded-xl rounded-bl-sm max-w-[80%] whitespace-pre-wrap">${escape(m.content)}</div></div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function bindChat() {
  const form = $('#chat-form');
  if (!form || form._bound) return;
  form._bound = true;
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (chat.sending) return;
    const input = $('#chat-input');
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    chat.history.push({ role: 'user', content: text });
    chat.history.push({ role: 'assistant', content: '…' });
    renderChatMessages();
    chat.sending = true;
    $('#chat-send').disabled = true;
    try {
      const { reply } = await api('/ai/chat', 'POST', { message: text });
      chat.history[chat.history.length - 1].content = reply;
    } catch (err) {
      chat.history[chat.history.length - 1].content = `⚠️ ${err.message}`;
    } finally {
      chat.sending = false;
      $('#chat-send') && ($('#chat-send').disabled = false);
      renderChatMessages();
      $('#chat-input')?.focus();
    }
  };
}

// =====================================================================
// ADMIN
// =====================================================================
async function adminView() {
  let stats = {}, users = [], withdrawals = [], videos = [], settings = [], tickets = [], auditEntries = [];
  try {
    [stats, users, withdrawals, videos, settings, tickets, auditEntries] = await Promise.all([
      api('/admin/stats'),
      api('/admin/users').then(r => r.users),
      api('/admin/withdrawals').then(r => r.withdrawals),
      api('/admin/videos').then(r => r.videos),
      api('/admin/settings').then(r => r.settings),
      api('/admin/support').then(r => r.tickets),
      api('/admin/audit').then(r => r.entries),
    ]);
  } catch (e) { toast(e.message, 'error'); }

  const tab = state.adminTab || 'overview';
  const tabs = [
    ['overview', 'Vue d\'ensemble'],
    ['users', 'Utilisateurs'],
    ['withdrawals', 'Retraits'],
    ['videos', 'Vidéos'],
    ['settings', 'Paramètres'],
    ['support', 'Support 💬'],
    ['audit', 'Audit'],
  ];

  let content = '';
  if (tab === 'overview') {
    content = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${miniStat('Utilisateurs', fmtNum(stats.users_total), `+${fmtNum(stats.users_24h)} sur 24h`, 'text-blue-300')}
        ${miniStat('Premium actifs', fmtNum(stats.premium_active), '', 'text-purple-300')}
        ${miniStat('Vues totales', fmtNum(stats.views_total), `+${fmtNum(stats.views_24h)} sur 24h`, 'text-cyan-300')}
        ${miniStat('Revenu pubs', fmtMoney(stats.ad_revenue_cents), '', 'text-amber-300')}
        ${miniStat('Revenu Premium', fmtMoney(stats.premium_revenue_cents), '', 'text-purple-300')}
        ${miniStat('Versé aux users', fmtMoney(stats.user_payouts_cents), '', 'text-ink-300')}
        ${miniStat('Profit total', fmtMoney(stats.profit_cents), 'Pubs + Premium - Gains', 'text-brand-300')}
        ${miniStat('Solde users', fmtMoney(stats.outstanding_balance_cents), 'À payer', 'text-ink-300')}
        ${miniStat('Retraits en attente', fmtNum(stats.pending_withdrawals), '', 'text-amber-300')}
        ${miniStat('Total payé', fmtMoney(stats.paid_out_cents), '', 'text-brand-300')}
      </div>`;
  } else if (tab === 'users') {
    content = `<div class="card overflow-x-auto"><table class="data">
      <thead><tr><th>Utilisateur</th><th>Solde</th><th>Total gagné</th><th>Vues</th><th>Filleuls</th><th>IP</th><th>Action</th></tr></thead>
      <tbody>${users.map(u => `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="avatar">${initials(u.username || u.email)}</div>
              <div>
                <div class="font-medium">${escape(u.username || u.email)}</div>
                <div class="text-xs text-ink-500">${escape(u.email)}</div>
                <div class="flex gap-1 mt-1">
                  ${u.is_admin ? '<span class="badge badge-warn">ADMIN</span>' : ''}
                  ${u.is_blocked ? '<span class="badge badge-danger">BLOQUÉ</span>' : ''}
                </div>
              </div>
            </div>
          </td>
          <td class="text-brand-300 font-semibold">${fmtMoney(u.balance_cents)}</td>
          <td>${fmtMoney(u.lifetime_earned_cents)}</td>
          <td>${u.view_count}</td>
          <td>${u.referral_count}</td>
          <td class="text-xs text-ink-500">${escape(u.last_ip || '-')}</td>
          <td class="flex gap-1 flex-wrap">
            <button onclick="toggleBlock(${u.id}, ${!u.is_blocked})" class="btn btn-sm ${u.is_blocked ? 'btn-primary' : 'btn-danger'}">${u.is_blocked ? 'Débloquer' : 'Bloquer'}</button>
            ${u.premium_until && new Date(u.premium_until) > new Date()
              ? `<button onclick="grantPremium(${u.id}, 0)" class="btn btn-sm btn-ghost">Retirer Premium</button>`
              : `<button onclick="grantPremium(${u.id}, 30)" class="btn btn-sm btn-ghost">+30j Premium</button>`
            }
          </td>
        </tr>`).join('')}</tbody></table></div>`;
  } else if (tab === 'withdrawals') {
    content = `<div class="space-y-3">
      ${withdrawals.length === 0 ? '<div class="card p-8 text-center text-ink-400">Aucun retrait</div>' : withdrawals.map(w => `
        <div class="card p-4 flex justify-between items-center flex-wrap gap-3">
          <div>
            <div class="font-semibold">${escape(w.email)} — <span class="text-brand-300">${fmtMoney(w.amount_cents)}</span> <span class="text-ink-500 font-normal">via ${escape(w.method)}</span></div>
            <div class="text-xs text-ink-500 mt-1">→ ${escape(w.destination)} · ${new Date(w.created_at).toLocaleString('fr-FR')}</div>
            ${w.admin_note ? `<div class="text-xs text-ink-400 mt-1">Note: ${escape(w.admin_note)}</div>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${w.status === 'pending' ? 'badge-warn' : w.status === 'paid' ? 'badge-success' : 'badge-danger'}">${w.status}</span>
            ${w.status === 'pending' ? `
              <button onclick="processWithdrawal(${w.id}, 'paid')" class="btn btn-sm btn-primary">Marquer payé</button>
              <button onclick="processWithdrawal(${w.id}, 'rejected')" class="btn btn-sm btn-danger">Refuser</button>
            ` : ''}
          </div>
        </div>`).join('')}
    </div>`;
  } else if (tab === 'videos') {
    content = `
      <form id="add-video-form" class="card p-5 mb-4 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div class="md:col-span-4"><label class="text-xs text-ink-400 mb-1 block">Titre</label><input id="vf-title" required class="input input-sm" placeholder="Titre de la vidéo" /></div>
        <div class="md:col-span-3"><label class="text-xs text-ink-400 mb-1 block">YouTube ID</label><input id="vf-yt" required class="input input-sm" placeholder="dQw4w9WgXcQ" /></div>
        <div class="md:col-span-2"><label class="text-xs text-ink-400 mb-1 block">Durée (s)</label><input id="vf-dur" type="number" value="30" class="input input-sm" /></div>
        <div class="md:col-span-1"><label class="text-xs text-ink-400 mb-1 block">¢</label><input id="vf-rew" type="number" value="2" class="input input-sm" /></div>
        <div class="md:col-span-2"><button type="submit" class="btn btn-primary w-full btn-sm">Ajouter</button></div>
      </form>
      <div class="grid md:grid-cols-2 gap-3">
        ${videos.map(v => `
          <div class="card p-4 flex justify-between items-center gap-3 flex-wrap">
            <div class="min-w-0 flex-1">
              <div class="font-semibold truncate">${escape(v.title)}</div>
              <div class="text-xs text-ink-500 mt-1">ID: ${escape(v.youtube_id)} · ${v.duration_seconds}s · Récompense ${fmtMoney(v.reward_cents)} · Pub ${fmtMoney(v.ad_revenue_cents)}</div>
              ${v.is_active ? '<span class="badge badge-success mt-2">Active</span>' : '<span class="badge badge-warn mt-2">Inactive</span>'}
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button onclick="toggleVideo(${v.id}, ${!v.is_active})" class="btn btn-sm btn-ghost">${v.is_active ? 'Désactiver' : 'Activer'}</button>
              <button onclick="deleteVideo(${v.id})" class="btn btn-sm btn-danger">Suppr.</button>
            </div>
          </div>`).join('')}
      </div>`;
  } else if (tab === 'support') {
    const openTickets = tickets.filter(t => t.status === 'open');
    const closedTickets = tickets.filter(t => t.status !== 'open');
    content = `
      <div class="space-y-3">
        <div class="flex items-center gap-3 mb-4">
          <span class="badge badge-warn">${openTickets.length} ouvert${openTickets.length > 1 ? 's' : ''}</span>
          <span class="badge">${closedTickets.length} fermé${closedTickets.length > 1 ? 's' : ''}</span>
        </div>
        ${tickets.length === 0 ? '<div class="card p-8 text-center text-ink-400">Aucun ticket pour le moment</div>' :
          tickets.map(t => `
            <div class="card p-4">
              <div class="flex justify-between items-start gap-3 flex-wrap mb-3">
                <div>
                  <div class="font-semibold">${escape(t.subject)}</div>
                  <div class="text-xs text-ink-500">${escape(t.email)} · ${new Date(t.created_at).toLocaleString('fr-FR')}</div>
                </div>
                <span class="badge ${t.status === 'open' ? 'badge-warn' : 'badge-success'}">${t.status === 'open' ? 'Ouvert' : 'Fermé'}</span>
              </div>
              <p class="text-sm text-ink-300 bg-ink-900/50 rounded-lg p-3 mb-3">${escape(t.message)}</p>
              ${t.admin_reply ? `<p class="text-sm text-brand-300 bg-brand-500/10 rounded-lg p-3 mb-3">✅ Réponse: ${escape(t.admin_reply)}</p>` : ''}
              ${t.status === 'open' ? `
                <div class="flex gap-2">
                  <input id="reply-${t.id}" type="text" placeholder="Votre réponse..." class="input input-sm flex-1" />
                  <button onclick="replyTicket(${t.id})" class="btn btn-primary btn-sm">Répondre</button>
                </div>` : ''}
            </div>`).join('')}
      </div>`;
  } else if (tab === 'audit') {
    content = `
      <div class="card overflow-x-auto">
        <table class="data w-full text-sm">
          <thead><tr>
            <th class="text-left py-2 px-3">Date</th>
            <th class="text-left py-2 px-3">Action</th>
            <th class="text-left py-2 px-3">Acteur</th>
            <th class="text-left py-2 px-3">Cible</th>
            <th class="text-left py-2 px-3">IP</th>
          </tr></thead>
          <tbody>
            ${auditEntries.length === 0
              ? '<tr><td colspan="5" class="text-center py-8 text-ink-500">Aucune entrée</td></tr>'
              : auditEntries.map(e => `
                <tr class="border-t border-ink-800">
                  <td class="py-2 px-3 text-xs text-ink-500 whitespace-nowrap">${new Date(e.created_at).toLocaleString('fr-FR')}</td>
                  <td class="py-2 px-3 font-mono text-xs text-brand-300">${escape(e.action)}</td>
                  <td class="py-2 px-3 text-xs">${escape(e.actor_email || '—')}</td>
                  <td class="py-2 px-3 text-xs text-ink-400">${escape(e.target || '—')}</td>
                  <td class="py-2 px-3 text-xs text-ink-500">${escape(e.ip || '—')}</td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    content = `<div class="card p-5 space-y-3">
      ${settings.map(s => `
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <div class="font-mono text-sm text-brand-300">${escape(s.key)}</div>
            <div class="text-xs text-ink-500">${settingHint(s.key)}</div>
          </div>
          <input id="set-${escape(s.key)}" value="${escape(s.value)}" class="input input-sm w-32" />
          <button onclick="saveSetting('${escape(s.key)}')" class="btn btn-primary btn-sm">Enregistrer</button>
        </div>`).join('')}
    </div>`;
  }

  return `
    <div class="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold">Panneau d'administration</h1>
        <p class="text-ink-400 mt-1">Pilotez votre plateforme.</p>
      </div>
      <div class="flex gap-1 p-1 bg-ink-900/60 rounded-xl mb-5 overflow-x-auto">
        ${tabs.map(([t, label]) => `<button onclick="setAdminTab('${t}')" class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${tab === t ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}">${label}</button>`).join('')}
      </div>
      ${content}
    </div>`;
}

function miniStat(label, value, hint, color) {
  return `<div class="card p-5">
    <div class="text-xs uppercase text-ink-500 font-semibold tracking-wider">${label}</div>
    <div class="text-2xl font-extrabold mt-2 ${color}">${value}</div>
    ${hint ? `<div class="text-xs text-ink-500 mt-1">${hint}</div>` : ''}
  </div>`;
}

function settingHint(key) {
  return ({
    free_min_withdraw_cents:     'Retrait minimum compte gratuit (centimes)',
    premium_min_withdraw_cents:  'Retrait minimum compte Premium (centimes)',
    premium_reward_multiplier:   'Multiplicateur gains Premium (ex: 150 = ×1.5)',
    premium_monthly_cents:       'Prix Premium 1 mois (centimes)',
    premium_quarterly_cents:     'Prix Premium 3 mois (centimes)',
    referral_bonus_cents:        'Bonus parrainage (centimes)',
    ai_messages_per_day_free:    'Messages Maya/jour (compte gratuit)',
    ai_messages_per_day_premium: 'Messages Maya/jour (compte Premium)',
    min_seconds_between_views:   'Délai minimum entre 2 vidéos (secondes)',
    max_views_per_ip_per_hour:   'Limite vues par IP par heure (anti-fraude)',
  })[key] || key;
}

window.setAdminTab = (t) => { state.adminTab = t; render(); };
window.replyTicket = async (id) => {
  const input = document.getElementById(`reply-${id}`);
  const reply = input?.value?.trim();
  if (!reply) return toast('Entrez une réponse', 'error');
  try {
    await api(`/admin/support/${id}/reply`, 'POST', { reply });
    toast('Réponse envoyée ✅', 'success');
    render();
  } catch (e) { toast(e.message, 'error'); }
};
window.toggleBlock = async (id, blocked) => {
  try { await api(`/admin/users/${id}/block`, 'POST', { blocked }); render(); } catch (e) { toast(e.message, 'error'); }
};
window.grantPremium = async (id, days) => {
  try {
    if (days === 0) {
      await api(`/admin/users/${id}/revoke-premium`, 'POST', {});
      toast('Premium retiré', 'success');
    } else {
      await api(`/admin/users/${id}/grant-premium`, 'POST', { days });
      toast(`${days} jours Premium accordés ✅`, 'success');
    }
    render();
  } catch (e) { toast(e.message, 'error'); }
};
window.processWithdrawal = async (id, status) => {
  let note = '';
  if (status === 'rejected') { note = prompt('Raison du refus (optionnel)') || ''; }
  try { await api(`/admin/withdrawals/${id}/process`, 'POST', { status, note }); toast('Traité', 'success'); render(); }
  catch (e) { toast(e.message, 'error'); }
};
window.toggleVideo = async (id, is_active) => {
  try { await api(`/admin/videos/${id}`, 'POST', { is_active }); render(); } catch (e) { toast(e.message, 'error'); }
};
window.deleteVideo = async (id) => {
  if (!confirm('Supprimer cette vidéo ?')) return;
  try { await api(`/admin/videos/${id}`, 'DELETE'); render(); } catch (e) { toast(e.message, 'error'); }
};
window.saveSetting = async (key) => {
  const value = $(`#set-${key}`).value;
  try { await api('/admin/settings', 'POST', { key, value }); toast('Enregistré', 'success'); } catch (e) { toast(e.message, 'error'); }
};

function bindAddVideo() {
  const f = $('#add-video-form');
  if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const reward = parseInt($('#vf-rew').value, 10);
      await api('/admin/videos', 'POST', {
        title: $('#vf-title').value,
        youtube_id: $('#vf-yt').value,
        duration_seconds: parseInt($('#vf-dur').value, 10),
        reward_cents: reward,
        ad_revenue_cents: reward * 4,
      });
      toast('Vidéo ajoutée', 'success');
      render();
    } catch (e) { toast(e.message, 'error'); }
  };
}

// =====================================================================
// RENDER
// =====================================================================
async function render() {
  if (!state.user && state.view !== 'auth' && state.view !== 'landing') {
    state.view = 'landing';
  }

  if (state.view === 'landing') {
    app.innerHTML = landingView();
    bindLanding();
    return;
  }
  if (state.view === 'auth') {
    app.innerHTML = authView();
    bindAuth();
    return;
  }

  let body = '';
  switch (state.view) {
    case 'dashboard': body = dashboardView(); break;
    case 'watch': body = watchView(); break;
    case 'referrals': body = await referralsView(); break;
    case 'withdraw': body = await withdrawView(); break;
    case 'premium': body = await premiumView(); break;
    case 'earnings': body = await earningsView(); break;
    case 'support': body = supportView(); break;
    case 'cgu': body = cguView(); break;
    case 'privacy': body = privacyView(); break;
    case 'admin':
      if (!state.user.is_admin) { state.view = 'dashboard'; return render(); }
      body = await adminView();
      break;
    default: body = notFoundView();
  }
  app.innerHTML = appHeader() + '<main class="pb-16">' + body + '</main>' + chatWidget();
  if (chat.open) { await loadChatHistory(); bindChat(); }
  if (state.view === 'watch') loadNextVideo();
  if (state.view === 'withdraw') bindWithdraw();
  if (state.view === 'admin' && state.adminTab === 'videos') bindAddVideo();
}

// =====================================================================
// PAGE 404
// =====================================================================
function notFoundView() {
  return `
    <div class="min-h-[60vh] flex flex-col items-center justify-center text-center px-5">
      <div class="text-8xl mb-6">🔍</div>
      <h1 class="text-3xl font-bold mb-3">Page introuvable</h1>
      <p class="text-ink-400 mb-8">Cette page n'existe pas ou a été déplacée.</p>
      <button onclick="navigate('dashboard')" class="btn btn-primary px-8 py-3">Retour au tableau de bord</button>
    </div>`;
}

// =====================================================================
// HISTORIQUE DES GAINS
// =====================================================================
async function earningsView() {
  let data = { history: [], page: 1, total: 0, pages: 1 };
  try { data = await api('/earnings/history'); } catch (e) {}
  const totalEur = (data.history.reduce((s, r) => s + r.reward_cents, 0) / 100).toFixed(2);
  const rows = data.history.length === 0
    ? `<tr><td colspan="3" class="text-center py-10 text-ink-500">Aucun gain enregistré</td></tr>`
    : data.history.map(r => `
        <tr class="border-t border-ink-800">
          <td class="py-3 px-4 text-sm text-ink-300">${new Date(r.created_at).toLocaleString('fr-FR')}</td>
          <td class="py-3 px-4 text-sm truncate max-w-[180px]">${r.video_title || '—'}</td>
          <td class="py-3 px-4 text-sm font-semibold text-brand-400">+${(r.reward_cents/100).toFixed(2)} €</td>
        </tr>`).join('');
  return `
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="flex items-center gap-3 mb-6">
        <button onclick="navigate('dashboard')" class="text-ink-400 hover:text-white">←</button>
        <h1 class="text-2xl font-bold">Historique des gains</h1>
      </div>
      <div class="card p-5 mb-6 flex items-center justify-between">
        <div>
          <p class="text-xs text-ink-400 mb-1">Total sur cette page</p>
          <p class="text-2xl font-bold text-brand-400">${totalEur} €</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-ink-400 mb-1">Total vues</p>
          <p class="text-2xl font-bold">${data.total}</p>
        </div>
      </div>
      <div class="card overflow-hidden">
        <table class="w-full">
          <thead><tr class="bg-ink-900/60">
            <th class="py-3 px-4 text-left text-xs text-ink-400">Date</th>
            <th class="py-3 px-4 text-left text-xs text-ink-400">Vidéo</th>
            <th class="py-3 px-4 text-left text-xs text-ink-400">Gain</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${data.pages > 1 ? `
      <div class="flex justify-center gap-2 mt-4">
        ${data.page > 1 ? `<button onclick="loadEarningsPage(${data.page-1})" class="btn btn-ghost btn-sm">← Précédent</button>` : ''}
        <span class="text-ink-400 text-sm py-2">Page ${data.page}/${data.pages}</span>
        ${data.page < data.pages ? `<button onclick="loadEarningsPage(${data.page+1})" class="btn btn-ghost btn-sm">Suivant →</button>` : ''}
      </div>` : ''}
    </div>`;
}
window.loadEarningsPage = async (page) => {
  try {
    const data = await api(`/earnings/history?page=${page}`);
    state._earningsData = data;
    render();
  } catch (e) { toast(e.message, 'error'); }
};

// =====================================================================
// SUPPORT / CONTACT
// =====================================================================
function supportView() {
  return `
    <div class="max-w-lg mx-auto px-4 py-8">
      <div class="flex items-center gap-3 mb-6">
        <button onclick="navigate('dashboard')" class="text-ink-400 hover:text-white">←</button>
        <h1 class="text-2xl font-bold">Support</h1>
      </div>
      <div class="card p-6 mb-6">
        <h2 class="font-semibold mb-4">Envoyer un message</h2>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-ink-400 mb-1 block">Sujet</label>
            <input id="support-subject" type="text" placeholder="Ex : Problème de retrait" class="input" maxlength="150" />
          </div>
          <div>
            <label class="text-xs text-ink-400 mb-1 block">Message</label>
            <textarea id="support-message" rows="5" placeholder="Décrivez votre problème en détail..." class="input resize-none" maxlength="2000"></textarea>
          </div>
          <button onclick="sendSupport()" class="btn btn-primary w-full py-3">Envoyer</button>
        </div>
      </div>
      <div class="card p-5 bg-ink-900/40">
        <h3 class="font-semibold mb-2 text-sm">Questions fréquentes</h3>
        <div class="space-y-2 text-sm text-ink-400">
          <p>• <strong class="text-ink-300">Délai de retrait</strong> : 1 à 3 jours ouvrés</p>
          <p>• <strong class="text-ink-300">Retrait minimum</strong> : 10 € (5 € avec Premium)</p>
          <p>• <strong class="text-ink-300">Méthodes</strong> : PayPal ou virement bancaire</p>
          <p>• <strong class="text-ink-300">Parrainage</strong> : 0,50 € par filleul inscrit</p>
        </div>
      </div>
    </div>`;
}
window.sendSupport = async () => {
  const subject = document.getElementById('support-subject')?.value?.trim();
  const message = document.getElementById('support-message')?.value?.trim();
  if (!subject || !message) return toast('Remplissez tous les champs', 'error');
  try {
    const r = await api('/support', 'POST', { subject, message });
    toast(r.message || 'Message envoyé !', 'success');
    navigate('dashboard');
  } catch (e) { toast(e.message, 'error'); }
};

// =====================================================================
// CGU — CONDITIONS GÉNÉRALES D'UTILISATION
// =====================================================================
function cguView() {
  const APP = 'Money-Maker';
  const EMAIL = process?.env?.SUPPORT_EMAIL || 'support@money-maker.app';
  return `
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="flex items-center gap-3 mb-6">
        <button onclick="history.back()" class="text-ink-400 hover:text-white">←</button>
        <h1 class="text-2xl font-bold">Conditions Générales d'Utilisation</h1>
      </div>
      <div class="card p-6 space-y-5 text-sm text-ink-300 leading-relaxed">
        <p class="text-xs text-ink-500">Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}</p>

        <div><h2 class="font-bold text-white mb-2">1. Objet</h2>
        <p>${APP} est une plateforme permettant aux utilisateurs de gagner des récompenses en visionnant des vidéos. Les présentes CGU régissent l'utilisation du service.</p></div>

        <div><h2 class="font-bold text-white mb-2">2. Inscription</h2>
        <p>L'accès au service nécessite la création d'un compte avec une adresse email valide. L'utilisateur doit avoir au moins 18 ans. Un seul compte par personne est autorisé.</p></div>

        <div><h2 class="font-bold text-white mb-2">3. Gains et récompenses</h2>
        <p>Les récompenses sont créditées après validation du visionnage complet d'une vidéo. ${APP} se réserve le droit de modifier les taux de récompense. Les gains sont soumis à des limites anti-fraude.</p></div>

        <div><h2 class="font-bold text-white mb-2">4. Retraits</h2>
        <p>Les retraits sont soumis à un montant minimum (10 € standard, 5 € Premium). Le délai de traitement est de 1 à 3 jours ouvrés. ${APP} se réserve le droit de refuser un retrait en cas de suspicion de fraude.</p></div>

        <div><h2 class="font-bold text-white mb-2">5. Premium</h2>
        <p>L'abonnement Premium est payant et non remboursable une fois activé. Les avantages Premium sont décrits sur la page dédiée et peuvent évoluer.</p></div>

        <div><h2 class="font-bold text-white mb-2">6. Comportements interdits</h2>
        <p>Sont interdits : l'utilisation de bots ou scripts automatisés, la création de faux comptes, toute tentative de fraude ou manipulation du système de gains.</p></div>

        <div><h2 class="font-bold text-white mb-2">7. Suspension et résiliation</h2>
        <p>${APP} peut suspendre ou supprimer tout compte en cas de violation des présentes CGU, sans préavis ni remboursement du solde.</p></div>

        <div><h2 class="font-bold text-white mb-2">8. Responsabilité</h2>
        <p>${APP} ne garantit pas la disponibilité continue du service. La responsabilité de la plateforme est limitée au montant des gains non versés en cas de fermeture du service.</p></div>

        <div><h2 class="font-bold text-white mb-2">9. Contact</h2>
        <p>Pour toute question : support via la page Contact de la plateforme.</p></div>
      </div>
    </div>`;
}

// =====================================================================
// POLITIQUE DE CONFIDENTIALITÉ (RGPD)
// =====================================================================
function privacyView() {
  return `
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="flex items-center gap-3 mb-6">
        <button onclick="history.back()" class="text-ink-400 hover:text-white">←</button>
        <h1 class="text-2xl font-bold">Politique de Confidentialité</h1>
      </div>
      <div class="card p-6 space-y-5 text-sm text-ink-300 leading-relaxed">
        <p class="text-xs text-ink-500">Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}</p>

        <div><h2 class="font-bold text-white mb-2">1. Données collectées</h2>
        <p>Nous collectons : adresse email, nom d'utilisateur, adresse IP de connexion, historique des visionnages et des transactions. Ces données sont nécessaires au fonctionnement du service.</p></div>

        <div><h2 class="font-bold text-white mb-2">2. Utilisation des données</h2>
        <p>Vos données sont utilisées pour : gérer votre compte, calculer vos gains, traiter vos retraits, prévenir la fraude, et vous envoyer les emails transactionnels liés à votre compte.</p></div>

        <div><h2 class="font-bold text-white mb-2">3. Conservation</h2>
        <p>Vos données sont conservées pendant la durée de votre compte et 3 ans après sa suppression, conformément aux obligations légales et comptables.</p></div>

        <div><h2 class="font-bold text-white mb-2">4. Partage des données</h2>
        <p>Nous ne vendons jamais vos données. Elles peuvent être transmises à nos prestataires de paiement (Stripe, PayPal) uniquement pour traiter vos transactions.</p></div>

        <div><h2 class="font-bold text-white mb-2">5. Vos droits (RGPD)</h2>
        <p>Vous avez le droit d'accéder à vos données, de les rectifier, de les supprimer, de vous opposer à leur traitement, et de les exporter. Exercez ces droits via la page Support.</p></div>

        <div><h2 class="font-bold text-white mb-2">6. Cookies</h2>
        <p>Nous utilisons uniquement un cookie de session sécurisé, strictement nécessaire au fonctionnement de votre connexion. Aucun cookie publicitaire ou de tracking tiers.</p></div>

        <div><h2 class="font-bold text-white mb-2">7. Sécurité</h2>
        <p>Vos mots de passe sont hachés (bcrypt). Les connexions sont chiffrées (HTTPS en production). Les sessions expirent automatiquement après 30 jours d'inactivité.</p></div>

        <div><h2 class="font-bold text-white mb-2">8. Contact DPO</h2>
        <p>Pour toute question relative à vos données personnelles, contactez-nous via la page Support.</p></div>
      </div>
    </div>`;
}

(async function init() {
  // Détecter si Stripe Checkout est configuré côté serveur
  try {
    const r = await api('/premium/plans');
    window._stripeEnabled = !!r.stripe_enabled;
  } catch (e) { window._stripeEnabled = false; }

  // Toast de confirmation email si redirection depuis verify-email
  const params = new URLSearchParams(location.search);
  if (params.get('verified') === '1') toast('✅ Email confirmé avec succès !', 'success');
  if (params.get('verified') === '0') toast('⚠️ Lien de confirmation expiré ou invalide.', 'error');

  // Retour depuis Stripe Checkout
  if (params.get('checkout') === 'success') {
    toast('🎉 Paiement réussi ! Votre Premium est en cours d\'activation...', 'success');
    history.replaceState({}, '', '/');
  }
  if (params.get('checkout') === 'cancel') {
    toast('Paiement annulé.', 'error');
    history.replaceState({}, '', '/');
  }

  // Réinitialisation mot de passe via token dans l'URL
  const resetToken = params.get('token') && location.search.includes('reset-password') ? params.get('token') : null;
  if (resetToken || location.pathname.includes('reset-password')) {
    const token = params.get('token');
    if (token) {
      const newPw = prompt('Entrez votre nouveau mot de passe (min. 8 caractères, 1 lettre + 1 chiffre) :');
      if (newPw) {
        try {
          await api('/auth/reset-password', 'POST', { token, password: newPw });
          toast('✅ Mot de passe modifié ! Vous pouvez vous connecter.', 'success');
        } catch (err) {
          toast('❌ ' + err.message, 'error');
        }
      }
      history.replaceState({}, '', '/');
    }
  }

  await loadMe();
  if (state.user) state.view = 'dashboard';
  else state.view = 'landing';
  render();
})();
