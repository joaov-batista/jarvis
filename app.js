/* ═══════════════════════════════════════════
   J.A.R.V.I.S — app.js
   Gemini integrado via código · Áudio local · VFX
   ═══════════════════════════════════════════ */

'use strict';

// ══════════════════════════════════════
// CONFIG — API já embutida no código
// ══════════════════════════════════════
const CONFIG = {
  // ✅ Gemini integrado diretamente no código
  geminiKey: 'AIzaSyDLvfcy7kyxzUKu1u5RMA2B4Jm1cbA9k3s',
  geminiModel: 'gemini-2.0-flash-preview',  // modelo solicitado

  // Spotify (OAuth — configurar nas settings se quiser)
  spotifyClientId: localStorage.getItem('jarvis_spotify_client_id') || '',
  spotifyRedirect: localStorage.getItem('jarvis_spotify_redirect') || window.location.href.split('?')[0],

  // Voz
  voiceLang: localStorage.getItem('jarvis_voice_lang') || 'pt-BR',
  ttsRate: parseFloat(localStorage.getItem('jarvis_tts_rate') || '1'),
  ttsPitch: parseFloat(localStorage.getItem('jarvis_tts_pitch') || '0.9'),

  // Câmera
  enableCamera: localStorage.getItem('jarvis_camera') !== 'false',
  enableFace: localStorage.getItem('jarvis_face') !== 'false',
  enableHands: localStorage.getItem('jarvis_hands') !== 'false',

  // Personalidade
  systemPrompt: localStorage.getItem('jarvis_system_prompt') ||
    'Você é J.A.R.V.I.S. (Just A Rather Very Intelligent System), a IA pessoal do Tony Stark. Responda sempre de forma inteligente, sofisticada e ligeiramente sarcástica, como um mordomo britânico high-tech. Use termos técnicos, chame o usuário de "Senhor" ou pelo nome se souber. Seja conciso nas respostas faladas. Responda em português do Brasil.',
};

const STATE = {
  isListening: false,
  isSpeaking: false,
  spotifyToken: null,
  spotifyDeviceId: null,
  currentTrack: null,
  cameraActive: false,
  faceDetected: false,
  handsDetected: false,
  conversationHistory: [],
  recognition: null,
  audioCtx: null,
  analyser: null,
  animFrameId: null,
  localAudio: null,  // player de áudio local
};

// ══════════════════════════════════════
// DOM REFERENCES
// ══════════════════════════════════════
const $ = id => document.getElementById(id);
const dom = {
  bgCanvas: $('bg-canvas'),
  waveCanvas: $('wave-canvas'),
  visionCanvas: $('vision-canvas'),
  cameraFeed: $('camera-feed'),
  chatLog: $('chat-log'),
  micBtn: $('mic-btn'),
  transcriptPreview: $('transcript-preview'),
  arcCore: $('arc-core'),
  settingsBtn: $('settings-btn'),
  settingsOverlay: $('settings-overlay'),
  closeSettings: $('close-settings'),
  saveSettings: $('save-settings'),
  visionToggle: $('vision-toggle'),
  visionOverlay: $('vision-overlay'),
  faceData: $('face-data'),
  handData: $('hand-data'),
  spotifyBar: $('spotify-bar'),
  trackName: $('track-name'),
  artistName: $('artist-name'),
  spPrev: $('sp-prev'),
  spPlay: $('sp-play'),
  spNext: $('sp-next'),
  hudTime: $('hud-time'),
  hudDate: $('hud-date'),
  aiDot: $('ai-dot'),
  micDot: $('mic-dot'),
  spotifyDot: $('spotify-dot'),
  camDot: $('cam-dot'),
  aiStatusText: $('ai-status-text'),
  micStatusText: $('mic-status-text'),
  spotifyStatusText: $('spotify-status-text'),
  camStatusText: $('cam-status-text'),
};

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  registerPWA();
  loadSettingsToUI();
  startClock();
  initBgCanvas();
  initWaveform();
  setupEventListeners();
  handleSpotifyCallback();
  updateStatusDots();

  // Gemini já está configurado no código
  updateDot('ai', 'online', 'IA: Online');

  setTimeout(() => {
    jarvisSpeak('Sistema online. Todos os subsistemas operacionais. Bem-vindo, Senhor.');
    addMessage('jarvis', 'Sistema online. Todos os subsistemas operacionais. Bem-vindo, Senhor. 🔵');
    if (CONFIG.enableCamera) initCamera();
  }, 800);
});

// ══════════════════════════════════════
// PWA
// ══════════════════════════════════════
function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ══════════════════════════════════════
// CLOCK
// ══════════════════════════════════════
function startClock() {
  const tick = () => {
    const now = new Date();
    dom.hudTime.textContent = now.toLocaleTimeString('pt-BR');
    dom.hudDate.textContent = now.toLocaleDateString('pt-BR');
  };
  tick();
  setInterval(tick, 1000);
}

// ══════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════
function loadSettingsToUI() {
  // Gemini key não precisa mais ser configurada pelo usuário
  const geminiInput = $('gemini-key');
  if (geminiInput) {
    geminiInput.value = '✅ Configurado via código';
    geminiInput.disabled = true;
    geminiInput.style.opacity = '0.6';
  }
  $('spotify-client-id').value = CONFIG.spotifyClientId;
  $('spotify-redirect').value = CONFIG.spotifyRedirect;
  $('voice-lang').value = CONFIG.voiceLang;
  $('tts-rate').value = CONFIG.ttsRate;
  $('tts-pitch').value = CONFIG.ttsPitch;
  $('enable-camera').checked = CONFIG.enableCamera;
  $('enable-face').checked = CONFIG.enableFace;
  $('enable-hands').checked = CONFIG.enableHands;
  $('system-prompt').value = CONFIG.systemPrompt;
  $('tts-rate-val').textContent = CONFIG.ttsRate + 'x';
  $('tts-rate').addEventListener('input', e => {
    $('tts-rate-val').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
  });
}

function saveSettings() {
  CONFIG.spotifyClientId = $('spotify-client-id').value.trim();
  CONFIG.spotifyRedirect  = $('spotify-redirect').value.trim();
  CONFIG.voiceLang  = $('voice-lang').value;
  CONFIG.ttsRate    = parseFloat($('tts-rate').value);
  CONFIG.ttsPitch   = parseFloat($('tts-pitch').value);
  CONFIG.enableCamera = $('enable-camera').checked;
  CONFIG.enableFace   = $('enable-face').checked;
  CONFIG.enableHands  = $('enable-hands').checked;
  CONFIG.systemPrompt = $('system-prompt').value;

  localStorage.setItem('jarvis_spotify_client_id', CONFIG.spotifyClientId);
  localStorage.setItem('jarvis_spotify_redirect',  CONFIG.spotifyRedirect);
  localStorage.setItem('jarvis_voice_lang',   CONFIG.voiceLang);
  localStorage.setItem('jarvis_tts_rate',     CONFIG.ttsRate);
  localStorage.setItem('jarvis_tts_pitch',    CONFIG.ttsPitch);
  localStorage.setItem('jarvis_camera',       CONFIG.enableCamera);
  localStorage.setItem('jarvis_face',         CONFIG.enableFace);
  localStorage.setItem('jarvis_hands',        CONFIG.enableHands);
  localStorage.setItem('jarvis_system_prompt',CONFIG.systemPrompt);

  updateStatusDots();
  if (CONFIG.enableCamera) initCamera();

  dom.settingsOverlay.classList.add('hidden');
  addMessage('system', '[ CONFIGURAÇÕES SALVAS — SISTEMA ATUALIZADO ]');
  jarvisSpeak('Configurações salvas, Senhor. Sistema atualizado.');
}

// ══════════════════════════════════════
// STATUS DOTS
// ══════════════════════════════════════
function updateDot(key, state, text) {
  const dot   = dom[key + 'Dot'];
  const label = dom[key + 'StatusText'];
  if (!dot || !label) return;
  dot.className = 'status-dot ' + state;
  label.textContent = text;
}
function updateStatusDots() {
  updateDot('ai', 'online', 'IA: Online');
  updateDot('spotify', STATE.spotifyToken ? 'online' : 'warn',
    STATE.spotifyToken ? 'SPOTIFY: On' : 'SPOTIFY: Off');
}

// ══════════════════════════════════════
// CHAT MESSAGES
// ══════════════════════════════════════
function addMessage(role, text) {
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.textContent = text;
  dom.chatLog.appendChild(div);
  dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'chat-msg jarvis';
  div.id = 'typing-msg';
  div.innerHTML = `<div class="typing-indicator">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`;
  dom.chatLog.appendChild(div);
  dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
  return div;
}

// ══════════════════════════════════════
// TEXT TO SPEECH
// ══════════════════════════════════════
function jarvisSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[🔵🎵⚙✕★]/g, '');
  const utt   = new SpeechSynthesisUtterance(clean);
  utt.lang    = CONFIG.voiceLang;
  utt.rate    = CONFIG.ttsRate;
  utt.pitch   = CONFIG.ttsPitch;

  const voices    = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith(CONFIG.voiceLang.split('-')[0]) &&
    (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('google'))
  ) || voices.find(v => v.lang.startsWith(CONFIG.voiceLang.split('-')[0]));
  if (preferred) utt.voice = preferred;

  utt.onstart = () => {
    STATE.isSpeaking = true;
    dom.arcCore.classList.add('active');
    updateDot('mic', 'active', 'TTS: Falando');
  };
  utt.onend = () => {
    STATE.isSpeaking = false;
    dom.arcCore.classList.remove('active');
    updateDot('mic', 'warn', 'MIC: Aguardando');
    if (!STATE.isListening) startListening();
  };
  window.speechSynthesis.speak(utt);
}

window.speechSynthesis.onvoiceschanged = () => {};

// ══════════════════════════════════════
// SPEECH RECOGNITION
// ══════════════════════════════════════
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    addMessage('system', '[ ERRO: Reconhecimento de voz não suportado neste navegador ]');
    return null;
  }
  const rec = new SR();
  rec.lang          = CONFIG.voiceLang;
  rec.continuous    = false;
  rec.interimResults = true;

  rec.onstart = () => {
    STATE.isListening = true;
    dom.micBtn.classList.add('listening');
    updateDot('mic', 'active', 'MIC: Ouvindo...');
    dom.transcriptPreview.textContent = '...';
  };

  rec.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    dom.transcriptPreview.textContent = (final || interim).trim();
    if (final) handleUserInput(final.trim());
  };

  rec.onerror = (e) => {
    if (e.error === 'no-speech') {
      if (!STATE.isSpeaking) startListening();
    } else {
      updateDot('mic', 'warn', 'MIC: Erro');
      dom.transcriptPreview.textContent = '';
    }
  };

  rec.onend = () => {
    STATE.isListening = false;
    dom.micBtn.classList.remove('listening');
    dom.transcriptPreview.textContent = '';
    updateDot('mic', 'warn', 'MIC: Parado');
    if (!STATE.isSpeaking) {
      setTimeout(() => startListening(), 500);
    }
  };

  return rec;
}

function startListening() {
  if (STATE.isListening || STATE.isSpeaking) return;
  if (!STATE.recognition) STATE.recognition = initSpeechRecognition();
  if (!STATE.recognition) return;
  try {
    STATE.recognition.lang = CONFIG.voiceLang;
    STATE.recognition.start();
  } catch (e) {}
}

function stopListening() {
  STATE.isListening = false;
  if (STATE.recognition) {
    try { STATE.recognition.stop(); } catch (e) {}
  }
  dom.micBtn.classList.remove('listening');
  updateDot('mic', 'warn', 'MIC: Parado');
}

// ══════════════════════════════════════
// ÁUDIO LOCAL — STARK.MP3
// ══════════════════════════════════════
function playLocalTrack(filename, trackLabel) {
  // Para qualquer áudio Spotify em andamento
  if (STATE.spotifyToken) spotifyPause();

  // Para qualquer áudio local em andamento
  if (STATE.localAudio) {
    STATE.localAudio.pause();
    STATE.localAudio = null;
  }

  const audio = new Audio(filename);
  STATE.localAudio = audio;

  audio.oncanplaythrough = () => {
    audio.play().then(() => {
      // Mostra a barra de música
      dom.spotifyBar.classList.remove('hidden');
      dom.trackName.textContent  = trackLabel || filename;
      dom.artistName.textContent = '🎵 Áudio Local';
      updateDot('spotify', 'online', 'ÁUDIO: On');

      const resp = `Tocando ${trackLabel || filename}, Senhor.`;
      addMessage('jarvis', resp);
      jarvisSpeak(resp);
    }).catch(err => {
      addMessage('jarvis', `Não consegui tocar o arquivo, Senhor: ${err.message}`);
    });
  };

  audio.onerror = () => {
    addMessage('jarvis', `Arquivo ${filename} não encontrado na raiz do projeto, Senhor.`);
    jarvisSpeak(`Arquivo de áudio não encontrado, Senhor.`);
    STATE.localAudio = null;
    dom.spotifyBar.classList.add('hidden');
  };

  audio.onended = () => {
    STATE.localAudio = null;
    dom.spotifyBar.classList.add('hidden');
    updateDot('spotify', 'warn', 'SPOTIFY: Off');
  };

  // Controles na barra
  dom.spPlay.textContent = '⏸';
  audio.onpause = () => { dom.spPlay.textContent = '▶'; };
  audio.onplay  = () => { dom.spPlay.textContent = '⏸'; };
}

function toggleLocalAudio() {
  if (!STATE.localAudio) return;
  if (STATE.localAudio.paused) {
    STATE.localAudio.play();
  } else {
    STATE.localAudio.pause();
  }
}

function stopLocalAudio() {
  if (STATE.localAudio) {
    STATE.localAudio.pause();
    STATE.localAudio.currentTime = 0;
    STATE.localAudio = null;
    dom.spotifyBar.classList.add('hidden');
    updateDot('spotify', 'warn', 'SPOTIFY: Off');
  }
}

// Mapeamento de músicas locais — adicione quantas quiser
const LOCAL_TRACKS = {
  'stark':     { file: 'stark.mp3',   label: 'Stark — Tony Stark Theme' },
  'iron man':  { file: 'stark.mp3',   label: 'Iron Man — Stark Theme' },
  // Adicione mais: 'avengers': { file: 'avengers.mp3', label: 'Avengers Theme' },
};

function findLocalTrack(query) {
  const q = query.toLowerCase().trim();
  for (const [key, track] of Object.entries(LOCAL_TRACKS)) {
    if (q.includes(key)) return track;
  }
  return null;
}

// ══════════════════════════════════════
// COMMAND ROUTER
// ══════════════════════════════════════
async function handleUserInput(text) {
  if (!text || text.length < 2) return;
  addMessage('user', text);
  dom.transcriptPreview.textContent = '';

  const lower = text.toLowerCase();

  // ── Comandos de música/toque ──
  if (lower.includes('tocar') || lower.includes('toque') || lower.includes('play') ||
      lower.includes('música') || lower.includes('musica') || lower.includes('reproduz')) {

    const query = text
      .replace(/tocar?|toque|play|música|musica|reproduz|no spotify|por favor|jarvis,?/gi, '')
      .trim();

    // 1️⃣ Verifica se é uma música local
    const localTrack = findLocalTrack(query || lower);
    if (localTrack) {
      playLocalTrack(localTrack.file, localTrack.label);
      return;
    }

    // 2️⃣ Tenta Spotify (se conectado)
    if (STATE.spotifyToken) {
      await spotifySearch(query || 'Iron Man Black Sabbath');
      return;
    }

    // 3️⃣ Sem opção disponível
    const resp = 'Spotify não conectado, Senhor. Mas posso tocar músicas locais — diga "toque stark" para um exemplo.';
    addMessage('jarvis', resp);
    jarvisSpeak(resp);
    return;
  }

  // ── Pausar / Parar ──
  if (lower.includes('pausar') || lower.includes('pause') || lower.includes('parar música') || lower.includes('para música')) {
    if (STATE.localAudio && !STATE.localAudio.paused) {
      STATE.localAudio.pause();
      addMessage('jarvis', 'Música pausada, Senhor.');
      jarvisSpeak('Música pausada, Senhor.');
    } else {
      await spotifyPause();
    }
    return;
  }

  // ── Parar completamente ──
  if (lower.includes('parar tudo') || lower.includes('silêncio')) {
    stopLocalAudio();
    await spotifyPause();
    window.speechSynthesis.cancel();
    return;
  }

  // ── Próxima / Anterior (só Spotify) ──
  if (lower.includes('próxima') || lower.includes('proxima') || lower.includes('next')) {
    await spotifyNext();
    return;
  }
  if (lower.includes('anterior') || lower.includes('voltar música')) {
    await spotifyPrev();
    return;
  }

  // ── Hora / Data ──
  if (lower.includes('hora') || lower.includes('horas') || lower.includes('que hora')) {
    const now  = new Date();
    const resp = `São exatamente ${now.toLocaleTimeString('pt-BR')}, Senhor. O dia ${now.toLocaleDateString('pt-BR')}.`;
    addMessage('jarvis', resp);
    jarvisSpeak(resp);
    return;
  }

  // ── Gemini AI ──
  await askGemini(text);
}

// ══════════════════════════════════════
// GEMINI AI — integrado via código
// ══════════════════════════════════════
async function askGemini(text) {
  const typing = addTypingIndicator();

  STATE.conversationHistory.push({ role: 'user', parts: [{ text }] });
  if (STATE.conversationHistory.length > 20) {
    STATE.conversationHistory = STATE.conversationHistory.slice(-20);
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: CONFIG.systemPrompt }] },
        contents: STATE.conversationHistory,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 512,
        }
      })
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message || 'Erro desconhecido na API Gemini');
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';

    STATE.conversationHistory.push({ role: 'model', parts: [{ text: reply }] });

    typing.remove();
    addMessage('jarvis', reply);
    jarvisSpeak(reply);

  } catch (err) {
    typing.remove();
    const msg = `Erro na IA: ${err.message}`;
    addMessage('jarvis', msg);
    jarvisSpeak('Houve um erro ao consultar a inteligência artificial, Senhor.');
    console.error('[JARVIS Gemini]', err);
  }
}

// ══════════════════════════════════════
// SPOTIFY (OAuth — opcional)
// ══════════════════════════════════════
function spotifyLogin() {
  if (!CONFIG.spotifyClientId) {
    alert('Configure seu Spotify Client ID primeiro!');
    return;
  }
  const scope = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
  const url = `https://accounts.spotify.com/authorize?response_type=token&client_id=${CONFIG.spotifyClientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(CONFIG.spotifyRedirect)}`;
  window.location.href = url;
}

function handleSpotifyCallback() {
  const hash   = window.location.hash.substring(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const token  = params.get('access_token');
  if (token) {
    STATE.spotifyToken = token;
    localStorage.setItem('jarvis_spotify_token', token);
    window.history.replaceState({}, '', window.location.pathname);
    updateDot('spotify', 'online', 'SPOTIFY: On');
    dom.spotifyBar.classList.remove('hidden');
    addMessage('system', '[ SPOTIFY: CONECTADO ]');
    jarvisSpeak('Spotify conectado com sucesso, Senhor.');
  }
  // Reutiliza token salvo
  const saved = localStorage.getItem('jarvis_spotify_token');
  if (!STATE.spotifyToken && saved) {
    STATE.spotifyToken = saved;
    updateDot('spotify', 'online', 'SPOTIFY: On');
  }
}

async function spotifySearch(query) {
  if (!STATE.spotifyToken || !query) return;
  try {
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${STATE.spotifyToken}` }
    });
    const data = await res.json();
    if (data.error?.status === 401) {
      STATE.spotifyToken = null;
      localStorage.removeItem('jarvis_spotify_token');
      updateDot('spotify', 'warn', 'SPOTIFY: Expirou');
      jarvisSpeak('Token do Spotify expirado, Senhor. Por favor, reconecte.');
      return;
    }
    const track = data.tracks?.items?.[0];
    if (!track) {
      jarvisSpeak('Não encontrei essa música no Spotify, Senhor.');
      addMessage('jarvis', 'Não encontrei essa música no Spotify, Senhor.');
      return;
    }
    await spotifyPlay(track.uri);
    const resp = `Tocando "${track.name}" por ${track.artists[0].name}, Senhor.`;
    addMessage('jarvis', resp);
    jarvisSpeak(resp);
  } catch (e) {
    addMessage('jarvis', 'Erro ao buscar no Spotify.');
  }
}

async function spotifyPlay(uri) {
  if (!STATE.spotifyToken || !STATE.spotifyDeviceId) return;
  const body = uri ? { uris: [uri] } : {};
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${STATE.spotifyDeviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${STATE.spotifyToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function spotifyPause() {
  if (!STATE.spotifyToken) return;
  await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${STATE.spotifyToken}` }
  });
  const resp = 'Música pausada, Senhor.';
  addMessage('jarvis', resp);
  jarvisSpeak(resp);
}

async function spotifyNext() {
  if (!STATE.spotifyToken) return;
  await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST',
    headers: { Authorization: `Bearer ${STATE.spotifyToken}` }
  });
  const resp = 'Próxima faixa, Senhor.';
  addMessage('jarvis', resp);
  jarvisSpeak(resp);
}

async function spotifyPrev() {
  if (!STATE.spotifyToken) return;
  await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST',
    headers: { Authorization: `Bearer ${STATE.spotifyToken}` }
  });
  const resp = 'Faixa anterior, Senhor.';
  addMessage('jarvis', resp);
  jarvisSpeak(resp);
}

// ══════════════════════════════════════
// CAMERA & VISION (MediaPipe)
// ══════════════════════════════════════
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    dom.cameraFeed.srcObject = stream;
    dom.cameraFeed.classList.add('active');
    STATE.cameraActive = true;
    updateDot('cam', 'online', 'CAM: Ativa');

    if (CONFIG.enableFace || CONFIG.enableHands) {
      dom.visionOverlay.classList.remove('hidden');
      initMediaPipe();
    }
  } catch (e) {
    updateDot('cam', 'warn', 'CAM: Negada');
    addMessage('system', '[ CÂMERA: ACESSO NEGADO ]');
  }
}

function initMediaPipe() {
  const vc  = dom.visionCanvas;
  const ctx = vc.getContext('2d');

  const updateSize = () => {
    vc.width  = window.innerWidth;
    vc.height = window.innerHeight;
  };
  updateSize();
  window.addEventListener('resize', updateSize);

  if (CONFIG.enableFace && window.FaceDetection) {
    const face = new FaceDetection({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}` });
    face.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
    face.onResults(results => {
      ctx.clearRect(0, 0, vc.width, vc.height);
      STATE.faceDetected = results.detections.length > 0;
      results.detections.forEach(d => {
        const bb = d.boundingBox;
        const x  = (1 - bb.xCenter - bb.width / 2) * vc.width;
        const y  = (bb.yCenter - bb.height / 2) * vc.height;
        const w  = bb.width * vc.width;
        const h  = bb.height * vc.height;
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth   = 2;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur  = 10;
        drawHUDBox(ctx, x, y, w, h);
        ctx.font      = '10px Orbitron, monospace';
        ctx.fillStyle = '#00d4ff';
        ctx.fillText('FACE DETECTED', x, y - 8);
      });
      dom.faceData.textContent = STATE.faceDetected
        ? `Rostos: ${results.detections.length}\nConfiança: ${Math.round(results.detections[0]?.score[0] * 100)}%`
        : 'Nenhum rosto';
    });

    const camFace = new Camera(dom.cameraFeed, {
      onFrame: async () => { await face.send({ image: dom.cameraFeed }); },
      width: 640, height: 480
    });
    camFace.start();
  }

  if (CONFIG.enableHands && window.Hands) {
    const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
    hands.onResults(results => {
      STATE.handsDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
      if (STATE.handsDetected) {
        results.multiHandLandmarks.forEach((landmarks, i) => {
          const label   = results.multiHandedness[i].label;
          drawHandSkeleton(ctx, landmarks, vc.width, vc.height, label);
          const gesture = detectGesture(landmarks);
          dom.handData.textContent = `Mão: ${label === 'Left' ? 'Esquerda' : 'Direita'}\nGesto: ${gesture}`;
          handleGestureCommand(gesture);
        });
      } else {
        dom.handData.textContent = 'Nenhuma mão';
      }
    });

    const camHands = new Camera(dom.cameraFeed, {
      onFrame: async () => { await hands.send({ image: dom.cameraFeed }); },
      width: 640, height: 480
    });
    camHands.start();
  }
}

function drawHUDBox(ctx, x, y, w, h) {
  const c = 16;
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x, y); ctx.lineTo(x, y + c);
  ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
  ctx.moveTo(x, y + h - c); ctx.lineTo(x, y + h); ctx.lineTo(x + c, y + h);
  ctx.moveTo(x + w - c, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - c);
  ctx.stroke();
}

function drawHandSkeleton(ctx, landmarks, w, h, label) {
  const color = label === 'Left' ? '#ff6b35' : '#00d4ff';
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;

  const connections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17]
  ];
  connections.forEach(([a, b]) => {
    const pa = landmarks[a], pb = landmarks[b];
    ctx.beginPath();
    ctx.moveTo((1 - pa.x) * w, pa.y * h);
    ctx.lineTo((1 - pb.x) * w, pb.y * h);
    ctx.stroke();
  });
  landmarks.forEach(pt => {
    ctx.beginPath();
    ctx.arc((1 - pt.x) * w, pt.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function detectGesture(lm) {
  const fingerTips = [4, 8, 12, 16, 20];
  const fingerMids = [3, 6, 10, 14, 18];
  const extended   = fingerTips.map((tip, i) => lm[tip].y < lm[fingerMids[i]].y);

  if (extended.every(Boolean))  return '✋ Aberta';
  if (extended.every(e => !e))  return '✊ Fechada';
  if (extended[1] && !extended[2] && !extended[3] && !extended[4]) return '☝ Índice';
  if (extended[1] &&  extended[2] && !extended[3] && !extended[4]) return '✌ Paz';
  if (extended[0] && !extended[1] && !extended[2] && !extended[3]) return '👍 Positivo';
  return '— Desconhecido';
}

const lastGestureCmd = { gesture: '', time: 0 };
function handleGestureCommand(gesture) {
  const now = Date.now();
  if (gesture === lastGestureCmd.gesture || now - lastGestureCmd.time < 3000) return;
  lastGestureCmd.gesture = gesture;
  lastGestureCmd.time    = now;
  if (gesture === '✋ Aberta') {
    stopListening();
    addMessage('system', '[ GESTO: SILÊNCIO ]');
  } else if (gesture === '☝ Índice') {
    startListening();
    addMessage('system', '[ GESTO: ATIVAR MICROFONE ]');
  } else if (gesture === '👍 Positivo') {
    spotifyNext();
  }
}

// ══════════════════════════════════════
// BACKGROUND VFX CANVAS
// ══════════════════════════════════════
function initBgCanvas() {
  const canvas = dom.bgCanvas;
  const ctx    = canvas.getContext('2d');
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 1.5 + 0.3,
    a: Math.random(),
  }));

  const hexagons = Array.from({ length: 12 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 30 + 15,
    rot: Math.random() * Math.PI,
    speed: (Math.random() - 0.5) * 0.003,
    a: Math.random() * 0.15 + 0.03,
  }));

  let frame = 0;
  function drawBg() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 212, 255, 0.04)';
    ctx.lineWidth   = 1;
    const spacing   = 60;
    for (let x = 0; x < canvas.width; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    hexagons.forEach(h => {
      h.rot += h.speed;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        i === 0
          ? ctx.moveTo(Math.cos(a) * h.size, Math.sin(a) * h.size)
          : ctx.lineTo(Math.cos(a) * h.size, Math.sin(a) * h.size);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(0, 212, 255, ${h.a})`;
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.restore();
    });

    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${p.a * 0.6})`;
      ctx.fill();
    });

    const scanY    = ((frame * 0.8) % (canvas.height + 40)) - 20;
    const scanGrad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2);
    scanGrad.addColorStop(0, 'transparent');
    scanGrad.addColorStop(0.5, 'rgba(0, 212, 255, 0.08)');
    scanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY - 2, canvas.width, 4);

    requestAnimationFrame(drawBg);
  }
  drawBg();
}

// ══════════════════════════════════════
// WAVEFORM VISUALIZER
// ══════════════════════════════════════
function initWaveform() {
  const canvas = dom.waveCanvas;
  const ctx    = canvas.getContext('2d');

  const resize = () => {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  let phase = 0;
  function drawWave() {
    canvas.width = canvas.offsetWidth;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width, h = canvas.height, mid = h / 2;
    const active = STATE.isListening || STATE.isSpeaking;
    const amp    = active ? 12 : 3;
    const freq   = active ? 0.04 : 0.02;
    const speed  = active ? 0.1  : 0.02;

    phase += speed;

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0,   'transparent');
    grad.addColorStop(0.2, active ? 'rgba(255,107,53,0.8)' : 'rgba(0,212,255,0.4)');
    grad.addColorStop(0.5, active ? 'rgba(0,212,255,1)'   : 'rgba(0,212,255,0.6)');
    grad.addColorStop(0.8, active ? 'rgba(255,107,53,0.8)' : 'rgba(0,212,255,0.4)');
    grad.addColorStop(1,   'transparent');

    ctx.strokeStyle = grad;
    ctx.lineWidth   = 2;
    ctx.shadowColor = active ? '#ff6b35' : '#00d4ff';
    ctx.shadowBlur  = active ? 12 : 6;

    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const y = mid
        + Math.sin(x * freq + phase) * amp
        + Math.sin(x * freq * 2 + phase * 1.3) * (amp * 0.5)
        + Math.sin(x * freq * 0.5 + phase * 0.7) * (amp * 0.3);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    requestAnimationFrame(drawWave);
  }
  drawWave();
}

// ══════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════
function setupEventListeners() {
  dom.micBtn.addEventListener('click', () => {
    if (STATE.isListening) stopListening();
    else startListening();
  });

  dom.arcCore.addEventListener('click', () => {
    if (STATE.isListening) stopListening();
    else startListening();
  });

  dom.settingsBtn.addEventListener('click', () => dom.settingsOverlay.classList.remove('hidden'));
  dom.closeSettings.addEventListener('click', () => dom.settingsOverlay.classList.add('hidden'));
  dom.saveSettings.addEventListener('click', saveSettings);

  document.querySelectorAll('.qcmd').forEach(btn => {
    btn.addEventListener('click', () => handleUserInput(btn.dataset.cmd));
  });

  dom.visionToggle.addEventListener('click', () => {
    if (STATE.cameraActive) {
      dom.cameraFeed.classList.toggle('active');
      dom.visionOverlay.classList.toggle('hidden');
    } else {
      initCamera();
    }
  });

  // Controles Spotify / Áudio local
  dom.spPrev.addEventListener('click', () => {
    if (STATE.localAudio) { STATE.localAudio.currentTime = 0; }
    else spotifyPrev();
  });
  dom.spPlay.addEventListener('click', () => {
    if (STATE.localAudio) { toggleLocalAudio(); }
    else {
      if (STATE.spotifyToken) {
        fetch('https://api.spotify.com/v1/me/player', {
          headers: { Authorization: `Bearer ${STATE.spotifyToken}` }
        }).then(r => r.json()).then(data => {
          if (data.is_playing) spotifyPause();
          else spotifyPlay();
        });
      }
    }
  });
  dom.spNext.addEventListener('click', () => {
    if (STATE.localAudio) { stopLocalAudio(); }
    else spotifyNext();
  });

  $('spotify-auth-btn').addEventListener('click', spotifyLogin);

  $('tts-rate').addEventListener('input', e => {
    $('tts-rate-val').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
  });

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (STATE.isListening) stopListening();
      else startListening();
    }
    if (e.code === 'Escape') dom.settingsOverlay.classList.add('hidden');
  });

  dom.settingsOverlay.addEventListener('click', e => {
    if (e.target === dom.settingsOverlay) dom.settingsOverlay.classList.add('hidden');
  });
}

// ══════════════════════════════════════
// AUTO-START
// ══════════════════════════════════════
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!STATE.isSpeaking) startListening();
  }, 3000);
});