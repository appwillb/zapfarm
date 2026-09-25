// Web Audio API & Web Speech API Sound & Voice Alert Service for ZapFarm Balcão
// Generates pleasant, attention-grabbing chimes and crystal-clear Brazilian Portuguese voice announcements.

const STORAGE_KEY = 'zapfarm_sound_alerts_config';

const DEFAULT_CONFIG = {
  enabled: true,
  mode: 'voice_and_chime', // 'voice_and_chime' | 'chime_only' | 'voice_only'
  volume: 0.9,             // 0.0 to 1.0
  announceName: true,
  speechRate: 1.05,
  speechPitch: 1.0,
  browserNotifications: true,
  throttleSeconds: 25,     // Anti-spam debounce per customer
};

let audioCtx = null;
const lastSpokenMap = new Map(); // phone -> timestamp (ms)

export function getAudioConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

export function saveAudioConfig(newConfig) {
  try {
    const current = getAudioConfig();
    const merged = { ...current, ...newConfig };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

/**
 * Initializes or unlocks the AudioContext upon user interaction
 * required by browser autoplay security policies.
 */
export function unlockAudio() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.warn('[SoundAlerts] Could not unlock AudioContext:', e);
  }
}

// Auto unlock on first user click anywhere in the window
if (typeof window !== 'undefined') {
  const triggerUnlock = () => {
    unlockAudio();
    window.removeEventListener('click', triggerUnlock);
    window.removeEventListener('keydown', triggerUnlock);
    window.removeEventListener('touchstart', triggerUnlock);
  };
  window.addEventListener('click', triggerUnlock);
  window.addEventListener('keydown', triggerUnlock);
  window.addEventListener('touchstart', triggerUnlock);
}

/**
 * Synthesizes a loud, pleasant, 2-tone "Ding-Dong!" attention chime
 * using the Web Audio API. 100% reliable across browsers with zero external assets.
 */
export function playChime(volume = 0.85) {
  try {
    unlockAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(Math.min(1.0, Math.max(0.1, volume)), now);
    masterGain.connect(audioCtx.destination);

    // Note 1: E5 (659.25 Hz) - bright and clear bell
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Note 2: B5 (987.77 Hz) - harmonic fifth above, rings prominently
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.16);
    gain2.gain.setValueAtTime(0, now + 0.16);
    gain2.gain.linearRampToValueAtTime(0.5, now + 0.20);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.warn('[SoundAlerts] Erro ao tocar sino:', err);
  }
}

/**
 * Synthesizes a Brazilian Portuguese voice announcement
 * using the browser's native window.speechSynthesis.
 */
export function speakPortuguese(text, options = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    const config = getAudioConfig();
    const volume = options.volume !== undefined ? options.volume : config.volume;
    const rate = options.rate !== undefined ? options.rate : config.speechRate;
    const pitch = options.pitch !== undefined ? options.pitch : config.speechPitch;

    // Cancel any previous stuck utterance
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.volume = Math.min(1.0, Math.max(0.1, volume));
    utterance.rate = rate;
    utterance.pitch = pitch;

    // Pick best Portuguese voice available
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(
      (v) =>
        v.lang === 'pt-BR' ||
        v.lang === 'pt_BR' ||
        v.name.toLowerCase().includes('brazil') ||
        v.name.toLowerCase().includes('brasil') ||
        v.lang.startsWith('pt')
    );
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[SoundAlerts] Erro na síntese de voz:', err);
  }
}

/**
 * Cleans and sanitizes the customer name for natural pronunciation.
 */
export function formatCustomerNameForVoice(rawName) {
  if (!rawName) return null;
  const trimmed = String(rawName).trim();
  if (!trimmed || trimmed.toLowerCase() === 'cliente' || trimmed.toLowerCase() === 'null') {
    return null;
  }
  // Strip emojis, weird symbols, and excess spaces
  const clean = trimmed.replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
  if (clean.length < 2) return null;

  // Take first 2 words max so the voice doesn't read full long names (e.g. "Rosana Silva")
  const parts = clean.split(' ');
  if (parts.length > 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return clean;
}

/**
 * Main dispatcher: Plays alert chime + voice announcement for an incoming customer WhatsApp message
 */
export function playIncomingMessageAlert({
  customerName,
  customerPhone,
  text = '',
  isHumanRequest = false,
  isNewOrder = false,
  force = false,
}) {
  const config = getAudioConfig();
  if (!config.enabled) return;

  const now = Date.now();
  const phoneKey = customerPhone || 'unknown';
  const lastSpoken = lastSpokenMap.get(phoneKey) || 0;

  // Debounce unless forced or human support requested
  if (!force && !isHumanRequest && !isNewOrder) {
    const elapsedSeconds = (now - lastSpoken) / 1000;
    if (elapsedSeconds < config.throttleSeconds) {
      // Still throttled, skip audio repeat
      return;
    }
  }

  lastSpokenMap.set(phoneKey, now);

  const cleanName = formatCustomerNameForVoice(customerName);

  // Construct phrase
  let speechPhrase = '';
  if (isHumanRequest) {
    speechPhrase = cleanName
      ? `Atenção balcão! Cliente ${cleanName} solicitou atendente no WhatsApp!`
      : 'Atenção balcão! Um cliente solicitou atendente no WhatsApp!';
  } else if (isNewOrder) {
    speechPhrase = cleanName
      ? `Novo pedido recebido de ${cleanName} no WhatsApp!`
      : 'Atenção balcão! Novo pedido recebido no WhatsApp!';
  } else {
    speechPhrase = cleanName
      ? `Atenção! Cliente ${cleanName} está chamando no WhatsApp.`
      : 'Atenção! Novo cliente chamando no WhatsApp.';
  }

  // 1. Play Chime
  if (config.mode === 'voice_and_chime' || config.mode === 'chime_only') {
    playChime(config.volume);
  }

  // 2. Play Voice (with slight delay so chime finishes cleanly)
  if (config.mode === 'voice_and_chime' || config.mode === 'voice_only') {
    const delay = config.mode === 'voice_and_chime' ? 450 : 0;
    setTimeout(() => {
      speakPortuguese(speechPhrase, { volume: config.volume });
    }, delay);
  }

  // 3. Desktop browser notification if tab is in background
  if (config.browserNotifications && typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        const notifTitle = isHumanRequest
          ? '👨‍⚕️ Chamado de Atendente!'
          : isNewOrder
          ? '📦 Novo Pedido Recebido!'
          : '💬 Novo Chamado no WhatsApp';

        const notifBody = cleanName
          ? `Cliente ${cleanName}: "${text.substring(0, 80)}"`
          : `Cliente chamando: "${text.substring(0, 80)}"`;

        new Notification(notifTitle, {
          body: notifBody,
          icon: '/favicon.ico',
        });
      } catch (e) {}
    }
  }
}

/**
 * Interactive test function for the user to test voice and chime with any custom name
 */
export function testAudioAlert(customName = 'Rozana') {
  unlockAudio();
  playIncomingMessageAlert({
    customerName: customName,
    customerPhone: 'test_phone',
    text: 'Olá, gostaria de saber se vocês entregam agora?',
    isHumanRequest: false,
    force: true,
  });
}

/**
 * Interactive test for Human Support request
 */
export function testHumanRequestAlert(customName = 'Rozana') {
  unlockAudio();
  playIncomingMessageAlert({
    customerName: customName,
    customerPhone: 'test_phone',
    text: 'Gostaria de falar com o farmacêutico por favor',
    isHumanRequest: true,
    force: true,
  });
}

/**
 * Requests desktop notification permission
 */
export async function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (e) {
      return false;
    }
  }
  return false;
}
