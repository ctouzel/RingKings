/**
 * Sons chiptune générés en direct (Web Audio API) : aucun fichier audio.
 * Oscillateurs carrés / triangles et bruit blanc filtré, comme les consoles 8-bit.
 */
const MUTE_KEY = 'ringkings.mute';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setMuted(m: boolean): void {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* rien */ }
  if (master) master.gain.value = m ? 0 : 0.35;
}

/** Le contexte audio doit être créé après un geste de l'utilisateur (clic). */
function audio(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = isMuted() ? 0 : 0.35;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return isMuted() ? null : ctx;
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
  const a = ctx!, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master!);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(start: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, attack = 0.002): void {
  const a = ctx!, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf;
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.02);
}

export const sfx = {
  /** Cloche du ring (n coups). */
  bell(n = 1): void {
    const a = audio(); if (!a) return;
    for (let i = 0; i < n; i++) {
      const t = a.currentTime + i * 0.28;
      tone(1320, t, 0.9, 'triangle', 0.35);
      tone(1980, t, 0.6, 'square', 0.06);
      tone(2640, t, 0.4, 'triangle', 0.08);
    }
  },
  /** Coup porté : plus grave et plus fort selon les dégâts ; un "clac" pour un coup propre. */
  punch(damage: number, clean: boolean, body: boolean): void {
    const a = audio(); if (!a) return;
    const t = a.currentTime;
    const heavy = Math.min(1, damage / 12);
    noise(t, 0.09 + heavy * 0.08, 0.5 + heavy * 0.4, 'lowpass', body ? 500 : 900 - heavy * 400);
    tone(body ? 90 : 140 - heavy * 50, t, 0.12, 'square', 0.25 + heavy * 0.2, 50);
    if (clean) { noise(t, 0.05, 0.4, 'highpass', 3000); tone(880, t, 0.06, 'square', 0.12, 440); }
  },
  /** Coup dans le vide. */
  whoosh(): void {
    const a = audio(); if (!a) return;
    noise(a.currentTime, 0.12, 0.12, 'bandpass', 1800, 2, 0.04);
  },
  /** Clameur de la foule. */
  crowd(intensity = 1): void {
    const a = audio(); if (!a) return;
    noise(a.currentTime, 1.2 + intensity * 0.8, 0.12 + intensity * 0.12, 'bandpass', 700, 0.7, 0.15);
  },
  /** Bip du compte de l'arbitre. */
  count(n: number): void {
    const a = audio(); if (!a) return;
    tone(n >= 10 ? 330 : 523, a.currentTime, 0.12, 'square', 0.18);
  },
  /** K.O. : arpège descendant. */
  ko(): void {
    const a = audio(); if (!a) return;
    [76, 72, 67, 64, 60, 55].forEach((n, i) => tone(midi(n), a.currentTime + i * 0.09, 0.14, 'square', 0.16));
    this.crowd(1.5);
  },
  /** Petite fanfare d'entrée (composition originale). */
  fanfare(): void {
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + 0.05, beat = 0.13;
    const melody: [number, number][] = [[67, 1], [67, 1], [72, 2], [71, 1], [72, 1], [74, 2], [76, 1], [74, 1], [72, 1], [74, 1], [79, 4]];
    let t = t0;
    for (const [n, d] of melody) { tone(midi(n), t, d * beat * 0.95, 'square', 0.12); t += d * beat; }
    const bass: [number, number][] = [[48, 4], [53, 4], [55, 4], [48, 4]];
    t = t0;
    for (const [n, d] of bass) { tone(midi(n), t, d * beat * 0.9, 'triangle', 0.22); t += d * beat; }
  },
  /** Jingle de victoire : arpège ascendant. */
  victory(): void {
    const a = audio(); if (!a) return;
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(midi(n), a.currentTime + i * 0.08, 0.2, 'square', 0.13));
    tone(midi(48), a.currentTime, 0.7, 'triangle', 0.25);
    this.crowd(1.5);
  },
  /** Roulement de tambour (décision). */
  drumroll(): void {
    const a = audio(); if (!a) return;
    for (let i = 0; i < 14; i++) noise(a.currentTime + i * 0.07, 0.06, 0.18 + i * 0.015, 'bandpass', 250, 1);
  },
};
