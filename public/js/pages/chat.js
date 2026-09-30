import { api, state } from '../state.js';
import { $, esc } from '../ui.js';

let farmId = null;
let started = false;

const SUGGESTIONS = [
  'When should I irrigate MM-MD-0110?',
  'How much fertiliser for MM-MD-0166?',
  'ನನ್ನ ಹೊಲ MM-MD-0645 ಗೆ ಯಾವಾಗ ನೀರು ಹಾಯಿಸಬೇಕು?',
  'MM-MD-0991 में रोग का खतरा है क्या?',
  'MM-MD-0110 ला पाणी कधी द्यावे?',
  'What yield can I expect?',
];

function add(who, lines) {
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.innerHTML = `<div class="who">${who === 'bot' ? 'Krishi Mitra' : 'You'}</div>${lines.map(esc).join('\n')}`;
  $('#chatLog').appendChild(div);
  $('#chatLog').scrollTop = $('#chatLog').scrollHeight;
}

async function send(text) {
  if (!text.trim()) return;
  add('user', [text]);
  $('#chatInput').value = '';
  try {
    const r = await api('/chat', { method: 'POST', body: { message: text, lang: state.lang, farmId: farmId || state.farmId, scenario: state.scenario } });
    if (r.farmId) farmId = r.farmId;
    add('bot', r.messages);
  } catch (err) {
    add('bot', [`Sorry - ${err.message}`]);
  }
}

export function init() {
  $('#chatSuggestions').innerHTML = SUGGESTIONS.map((s) => `<button class="chip">${esc(s)}</button>`).join('');
  $('#chatSuggestions').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (c) send(c.textContent);
  });
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    send($('#chatInput').value);
  });
}

export async function render() {
  if (started) return;
  started = true;
  add('bot', [
    'Namaskara! I am Krishi Mitra, the SMA advisory assistant.',
    'Ask me about irrigation, fertiliser, disease, yield or rain for any plot - in English, ಕನ್ನಡ, हिंदी or मराठी.',
    'Answers use the same AI models as the dashboard and follow the weather scenario selected above.',
  ]);
}
