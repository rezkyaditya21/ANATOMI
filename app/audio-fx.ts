// High-Tech Synthesized Medical Web Audio Engine (100% Client-Side, Zero External Assets)

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function toggleSound(enabled?: boolean): boolean {
  soundEnabled = enabled !== undefined ? enabled : !soundEnabled;
  return soundEnabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

// Gentle futuristic acoustic UI chime
export function playSelectSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3600, now);

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(987.77, now); // B5
  osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.05); // E6

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1975.53, now); // B6
  osc2.frequency.exponentialRampToValueAtTime(2637.02, now + 0.05); // E7

  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(filter);
  filter.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.12);
  osc2.stop(now + 0.12);
}

// Medical CT Scanner Holographic Hum
export function playScanSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(520, now);
  filter.Q.setValueAtTime(3.5, now);

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.linearRampToValueAtTime(440, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(330, now + 0.32);

  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.32);
}

// Physiological Lub-Dub Heartbeat Pulse with Sub-Bass Resonance
export function playHeartbeatSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // S1 "Lub" (Mitral & Tricuspid valve closure)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(62, now);
  osc1.frequency.exponentialRampToValueAtTime(38, now + 0.09);
  gain1.gain.setValueAtTime(0.11, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.09);

  // S2 "Dub" (~130ms later, Aortic & Pulmonic valve closure)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(78, now + 0.13);
  osc2.frequency.exponentialRampToValueAtTime(45, now + 0.22);
  gain2.gain.setValueAtTime(0.08, now + 0.13);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.13);
  osc2.stop(now + 0.22);
}

