/**
 * "Krishi Mitra" - a lightweight multilingual advisory chatbot.
 *
 * Intent detection is keyword based (works offline, in four languages) and the
 * answers are generated from the same model outputs as the dashboard, so the
 * bot never contradicts the advisory. A production system could route the
 * same structured context to an LLM for open-ended questions.
 */
const i18n = require('./i18n');

const INTENTS = {
  irrigation: ['irrigat', 'water', 'when', 'pani', 'paani', 'पानी', 'सिंचाई', 'ನೀರು', 'ನೀರಾವರಿ', 'पाणी', 'सिंचन'],
  rain: ['rain', 'weather', 'forecast', 'बारिश', 'वर्षा', 'मौसम', 'ಮಳೆ', 'ಹವಾಮಾನ', 'पाऊस', 'हवामान'],
  fertigation: ['fert', 'urea', 'npk', 'nutrient', 'manure', 'potash', 'खाद', 'उर्वरक', 'यूरिया', 'ಗೊಬ್ಬರ', 'ರಸಾವರಿ', 'खत', 'युरिया'],
  disease: ['disease', 'pest', 'borer', 'rust', 'rot', 'smut', 'insect', 'रोग', 'कीट', 'ರೋಗ', 'ಕೀಟ', 'कीड'],
  yield: ['yield', 'production', 'tonne', 'ton', 'harvest', 'उपज', 'पैदावार', 'ಇಳುವರಿ', 'उत्पादन'],
  stress: ['stress', 'dry', 'wilt', 'तनाव', 'सूखा', 'ಒತ್ತಡ', 'ಒಣ', 'ताण', 'कोरड'],
  greeting: ['hello', ' hi ', ' hey ', 'namaste', 'namaskar', 'नमस्ते', 'नमस्कार', 'ನಮಸ್ಕಾರ'],
  help: ['help', 'what can', 'मदद', 'ಸಹಾಯ', 'मदत'],
};

const INTENT_LINES = {
  irrigation: ['irrigation', 'drip'],
  rain: ['irrigation'],
  fertigation: ['fertigation'],
  disease: ['disease'],
  yield: ['yield', 'delay'],
  stress: ['stress', 'delay'],
};

function detectLanguage(text, fallback) {
  if (/[ಀ-೿]/.test(text)) return 'kn';
  if (/[ऀ-ॿ]/.test(text)) {
    return /(पाणी|कधी|द्यावे|खत|काय|आहे|माझ्या|शेत)/.test(text) ? 'mr' : 'hi';
  }
  return fallback || 'en';
}

function detectIntents(text) {
  const t = ` ${text.toLowerCase()} `;
  return Object.entries(INTENTS).filter(([, words]) => words.some((w) => t.includes(w))).map(([k]) => k);
}

/**
 * @param message   user text
 * @param opts { lang, farmId, findFarm(id) -> farm|null, advise(farm, lang) -> advisory }
 */
function reply(message, { lang, farmId, findFarm, advise }) {
  const text = String(message || '').slice(0, 500);
  const L = detectLanguage(text, lang);
  const intents = detectIntents(text);
  const idMatch = text.toUpperCase().match(/MM-MD-\d{3,4}/);
  const id = idMatch ? idMatch[0] : farmId;
  const out = [];

  if (intents.includes('greeting')) out.push(i18n.t(L, 'chat_greeting'));
  if (!id) {
    out.push(intents.length && !intents.every((i) => i === 'greeting' || i === 'help')
      ? i18n.t(L, 'chat_need_farm')
      : i18n.t(L, 'chat_help'));
    return { lang: L, intents, farmId: null, messages: out };
  }
  const farm = findFarm(id);
  if (!farm) {
    out.push(i18n.t(L, 'chat_unknown_farm', { id }));
    return { lang: L, intents, farmId: null, messages: out };
  }
  const adv = advise(farm, L);
  out.push(i18n.t(L, 'chat_summary', { id: farm.id, village: farm.village, taluk: farm.taluk, age: farm.crop_age_days, stage: adv.stage }));
  const wanted = new Set();
  for (const i of intents) (INTENT_LINES[i] || []).forEach((k) => wanted.add(k));
  const lines = wanted.size ? adv.advisory.filter((l) => wanted.has(l.key)) : adv.advisory;
  lines.forEach((l) => out.push(l.text));
  if (!intents.length || intents.every((i) => i === 'greeting' || i === 'help')) out.push(i18n.t(L, 'chat_help'));
  return { lang: L, intents, farmId: farm.id, messages: out };
}

module.exports = { reply, detectLanguage, detectIntents };
