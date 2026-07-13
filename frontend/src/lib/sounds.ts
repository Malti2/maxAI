// Tiny WebAudio sound engine for iMessage-style send / receive cues.
//
// No audio files are shipped — the tones are synthesised on the fly, so there
// is nothing to download and nothing that resembles Apple's copyrighted assets.
// Sounds are gated behind a runtime flag mirrored from the user's setting and
// only ever play after a user gesture (browsers block audio otherwise).

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  start: number;   // seconds from now
  duration: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number; // optional frequency glide target
}

function playTones(tones: Tone[]): void {
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;

  for (const t of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.setValueAtTime(t.freq, now + t.start);
    if (t.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(t.slideTo, now + t.start + t.duration);
    }
    const peak = t.gain ?? 0.09;
    // Fast attack, smooth exponential decay — a soft "pop".
    gain.gain.setValueAtTime(0.0001, now + t.start);
    gain.gain.exponentialRampToValueAtTime(peak, now + t.start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.duration + 0.02);
  }
}

// Sending: a crisp upward blip.
export function playSend(): void {
  if (!enabled) return;
  playTones([{ freq: 620, slideTo: 1180, start: 0, duration: 0.16, type: 'sine', gain: 0.08 }]);
}

// Receiving: a soft two-note chime.
export function playReceive(): void {
  if (!enabled) return;
  playTones([
    { freq: 880, start: 0, duration: 0.14, type: 'sine', gain: 0.06 },
    { freq: 1320, start: 0.09, duration: 0.2, type: 'sine', gain: 0.07 },
  ]);
}

// Tapback: a light tick.
export function playTapback(): void {
  if (!enabled) return;
  playTones([{ freq: 1040, slideTo: 1560, start: 0, duration: 0.1, type: 'triangle', gain: 0.05 }]);
}
