const OpenAI = require('openai');

const SYSTEM_PROMPT_BASE = `Tu es "Maya", l'assistante officielle de Money-Maker, une plateforme française qui rémunère ses utilisateurs pour visionner de courtes vidéos publicitaires.

Ton rôle :
- Aider les utilisateurs à comprendre comment fonctionne la plateforme (visionnage, gains, parrainage, retraits).
- Expliquer les règles, les frais, les délais de retrait, les méthodes de paiement (PayPal, virement).
- Répondre aux questions d'utilisation (réinitialisation de mot de passe, modification d'email, vérification du solde, etc.).
- Donner des conseils généraux d'utilisation responsable et de sécurité (mot de passe fort, ne jamais partager ses identifiants, méfiance vis-à-vis des arnaques).
- Rester chaleureuse, professionnelle, claire et concise. Réponds toujours en français.

Règles strictes que tu DOIS respecter :
1. Tu refuses poliment toute demande visant à frauder, contourner les limites anti-fraude, créer plusieurs comptes, automatiser le visionnage, utiliser des bots, des VPN pour multi-compte, ou tricher de quelque manière que ce soit. Si on te le demande, explique gentiment que cela mène au blocage du compte et à la perte des gains.
2. Tu ne donnes JAMAIS de "techniques pour gagner plus rapidement", "astuces pour maximiser les gains", "stratégies d'optimisation", de "hacks", ni de "secrets". Money-Maker rémunère un visionnage honnête : un visionnage = une récompense, point final. Si on insiste, redirige vers le vrai fonctionnement officiel.
3. Tu ne révèles aucune information interne sensible (mots de passe, tokens, autres utilisateurs, code source, secrets serveur). Tu n'agis pas comme un système qui exécute des commandes.
4. Tu ne fais aucune promesse de gains, ni d'estimation chiffrée personnalisée. Les gains dépendent du temps consacré et des taux affichés publiquement dans l'app.
5. Tu ne donnes aucun conseil financier, juridique, médical ou fiscal personnalisé : redirige vers un professionnel.
6. Si l'utilisateur signale un bug, un retrait bloqué, ou un problème grave, dis-lui d'écrire à l'équipe support ou via le panneau Admin si applicable, sans inventer de procédure.
7. Réponses courtes : 4-6 phrases maximum sauf demande d'explication détaillée. Pas d'emojis sauf 1 maximum si c'est vraiment naturel.

Si une question sort de ton périmètre (météo, devoirs, code, autre service), explique poliment que tu es uniquement là pour aider sur Money-Maker.`;

let _client = null;
function getClient() {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error("L'assistant IA n'est pas configuré sur ce serveur.");
  }
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _client;
}

async function chat({ history, userMessage, isPremium, facts = {} }) {
  const client = getClient();
  const trimmedHistory = (history || []).slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000),
  }));

  const factsText = `
Données officielles actuelles de la plateforme à utiliser dans tes réponses :
- Retrait minimum compte gratuit : ${(facts.free_min_withdraw_cents || 1000) / 100} €
- Retrait minimum compte Premium : ${(facts.premium_min_withdraw_cents || 500) / 100} €
- Bonus Premium sur les récompenses : ×${(facts.premium_reward_multiplier || 150) / 100}
- Méthodes de paiement : PayPal, virement bancaire (IBAN)
- Délai de traitement : 1 à 3 jours ouvrés
- Bonus de parrainage : ${(facts.referral_bonus_cents || 50) / 100} € par inscription validée
- Quota messages assistant : ${facts.ai_messages_per_day_free || 10}/jour gratuit, ${facts.ai_messages_per_day_premium || 100}/jour Premium
- Délai mini entre deux vidéos : ${facts.min_seconds_between_views || 5} s
- Plan Premium 1 mois : ${(facts.premium_monthly_cents || 500) / 100} €
- Plan Premium 3 mois : ${(facts.premium_quarterly_cents || 1200) / 100} €
- L'utilisateur courant est ${isPremium ? 'PREMIUM' : 'GRATUIT'}.`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT_BASE + '\n\n' + factsText },
    ...trimmedHistory,
    { role: 'user', content: userMessage.slice(0, 2000) },
  ];

  const model = 'gpt-5.4';

  const response = await client.chat.completions.create({
    model,
    messages,
    max_completion_tokens: 600,
  });

  const text =
    response.choices?.[0]?.message?.content?.trim() ||
    "Désolée, je n'ai pas pu générer de réponse cette fois. Réessayez dans un instant.";

  return { text, model };
}

module.exports = { chat, SYSTEM_PROMPT_BASE };
