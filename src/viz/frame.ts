/**
 * État complet de la scène à un instant donné de la timeline.
 * Fonction pure : le lecteur peut avancer, reculer ou sauter librement.
 */
import type { Corner } from '../model/types';
import { GUARD, POSES, lerpPose, punchCurve, reactCurve, type Pose } from './poses';
import { TIMING, type Beat, type Timeline } from './timeline';

export interface FighterFrame { pose: Pose; x: number }

export interface Frame {
  red: FighterFrame;
  blue: FighterFrame;
  ref: { pose: Pose; x: number; facing: 1 | -1 };
  hp: Record<Corner, number>;
  round: number;
  clock: number;
  banner: { big: string; small?: string; kind?: string } | null;
  comment: string;
  /** Impact à dessiner sur le défenseur. */
  spark: { on: Corner; body: boolean; size: number; clean: boolean } | null;
  shake: number;
  excitement: number;
  finished: boolean;
}

const CENTER = 128;
const GAP = { long: 34, inside: 25, clinch: 17 };
const CORNER_X: Record<Corner, number> = { red: 44, blue: 212 };
/** Conversion dégâts du moteur -> points de barre de vie. */
const HP_PER_DAMAGE = 0.09;

const other = (c: Corner): Corner => (c === 'red' ? 'blue' : 'red');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const STOP_BANNER: Record<string, string> = {
  KO: 'K.O. !', referee: 'ARRÊT !', threeKnockdowns: '3 KNOCKDOWNS', corner: 'ABANDON', doctor: 'ARRÊT MÉDICAL',
};

function knockdownPhases(b: Extract<Beat, { kind: 'knockdown' }>) {
  const per = (b.dur - TIMING.fall - (b.getsUp ? TIMING.getUp : 0)) / b.count;
  return { per, countEnd: b.at + TIMING.fall + per * b.count };
}

export function frameAt(tl: Timeline, T: number, names: Record<Corner, string>): Frame {
  const beats = tl.beats;
  const past = beats.filter((b) => b.at <= T);
  const active = past.filter((b) => T < b.at + b.dur);
  const last = past[past.length - 1];
  const find = <K extends Beat['kind']>(kind: K) => active.find((b) => b.kind === kind) as Extract<Beat, { kind: K }> | undefined;

  // --- Distance entre les boxeurs ----------------------------------------
  const ranges = past.filter((b): b is Extract<Beat, { kind: 'range' }> => b.kind === 'range');
  const lastR = ranges[ranges.length - 1], prevR = ranges[ranges.length - 2];
  let gap: number = GAP.long;
  if (lastR) {
    const from = prevR ? GAP[prevR.range] : GAP.long;
    gap = lerp(from, GAP[lastR.range], clamp((T - lastR.at) / 0.5, 0, 1));
  }
  if (find('clinch')) gap = GAP.clinch;

  // --- Barres de vie -----------------------------------------------------
  const hp: Record<Corner, number> = { red: 100, blue: 100 };
  const koed = new Set<Corner>();
  for (const b of past) {
    if (b.kind === 'punch' && b.landed && b.at + b.dur * 0.4 <= T) hp[other(b.by)] -= b.damage * HP_PER_DAMAGE * (b.punch === 'body' ? 0.6 : 1);
    if (b.kind === 'knockdown') { hp[b.who] -= 8; if (!b.getsUp && T >= knockdownPhases(b).countEnd) koed.add(b.who); }
    if (b.kind === 'roundEnd' && b.at + b.dur <= T) for (const c of ['red', 'blue'] as const) hp[c] = Math.min(100, hp[c] + 6);
    if (b.kind === 'stoppage') hp[b.who] = Math.min(hp[b.who], 6);
  }
  for (const c of ['red', 'blue'] as const) hp[c] = clamp(hp[c], koed.has(c) ? 0 : 3, 100);
  for (const c of koed) hp[c] = 0;

  // --- Poses et positions par défaut (garde qui sautille) ----------------
  /** Garde avec un léger sautillement (le haut du corps monte et descend). */
  const bob = (phase: number): Pose => {
    const dy = Math.sin(T * 5 + phase) > 0.3 ? 1 : 0;
    const out = { ...GUARD };
    for (const k of ['hip', 'shoulder', 'head', 'elbowF', 'gloveF', 'elbowR', 'gloveR'] as const) {
      out[k] = { x: GUARD[k].x, y: GUARD[k].y + dy };
    }
    return out;
  };
  const f: Record<Corner, FighterFrame> = {
    red: { pose: bob(0), x: CENTER - gap / 2 + Math.round(Math.sin(T * 1.3) * 2) },
    blue: { pose: bob(2), x: CENTER + gap / 2 + Math.round(Math.sin(T * 1.1 + 1) * 2) },
  };
  // L'arbitre se tient en retrait, sur le côté, et se déplace lentement.
  const ref: Frame['ref'] = { pose: POSES.refStand, x: CENTER + 52 + Math.round(Math.sin(T * 0.4) * 8), facing: -1 };
  let banner: Frame['banner'] = null;
  let spark: Frame['spark'] = null;
  let shake = 0;
  const dir = (c: Corner) => (c === 'red' ? 1 : -1);

  // --- Entrée / sortie de round : les boxeurs quittent / rejoignent leur coin.
  const intro = find('roundIntro');
  if (intro) {
    const p = clamp((T - intro.at) / (intro.dur * 0.75), 0, 1);
    for (const c of ['red', 'blue'] as const) f[c].x = lerp(CORNER_X[c], f[c].x, p);
    banner = { big: `ROUND ${intro.round}`, kind: 'round' };
  }
  const end = find('roundEnd');
  if (end) {
    const p = clamp((T - end.at) / (end.dur * 0.5), 0, 1);
    for (const c of ['red', 'blue'] as const) f[c].x = lerp(f[c].x, CORNER_X[c], p);
    banner = { big: `FIN DU ROUND ${end.round}`, small: end.scores.map((s) => `${s.red}-${s.blue}`).join(' · '), kind: 'round' };
  }
  const clinch = find('clinch');
  if (clinch) { f.red.pose = POSES.clinch; f.blue.pose = POSES.clinch; }

  // --- Boxeur ébranlé : il titube.
  const hurt = find('hurt');
  if (hurt) f[hurt.who].pose = lerpPose(GUARD, POSES.hit, 0.35 + 0.3 * Math.sin(T * 12));

  // --- Coups ---------------------------------------------------------------
  const punch = find('punch');
  if (punch) {
    const p = clamp((T - punch.at) / punch.dur, 0, 1);
    const a = punch.by, d = other(a);
    f[a].pose = lerpPose(f[a].pose, POSES[punch.punch], punchCurve(p));
    f[a].x += dir(a) * 3 * punchCurve(p);
    if (punch.landed) {
      if (p >= 0.4) {
        const r = reactCurve((p - 0.4) / 0.6);
        f[d].pose = lerpPose(f[d].pose, punch.punch === 'body' ? POSES.hitBody : POSES.hit, r);
        f[d].x += dir(a) * 3 * r;
      }
      if (p >= 0.36 && p <= 0.62) {
        spark = { on: d, body: punch.punch === 'body', size: Math.round(clamp(punch.damage / 2.2, 2, 6)), clean: punch.clean };
        shake = punch.clean ? 2 : punch.damage >= 8 ? 1 : 0;
      }
    } else {
      f[d].pose = lerpPose(f[d].pose, POSES.slip, reactCurve(p));
    }
  }

  // --- Knockdown : chute, compte de l'arbitre, relevé ----------------------
  const kd = find('knockdown');
  if (kd) {
    const { per, countEnd } = knockdownPhases(kd);
    const down = kd.who, up = other(down);
    const target = kd.getsUp ? POSES.kneel : POSES.down;
    const t = T - kd.at;
    // L'autre boxeur recule vers un coin neutre.
    f[up].x = lerp(f[up].x, CORNER_X[up], clamp(t / 0.6, 0, 1) * 0.6);
    f[up].pose = GUARD;
    ref.x = Math.round(lerp(ref.x, f[down].x + dir(down) * -18, clamp(t / 0.6, 0, 1)));
    ref.facing = down === 'red' ? -1 : 1;
    if (t < TIMING.fall) {
      f[down].pose = lerpPose(POSES.hit, target, clamp(t / TIMING.fall, 0, 1));
      banner = { big: 'KNOCKDOWN !', kind: 'kd' };
      shake = 2;
    } else if (T < countEnd) {
      const n = Math.min(kd.count, 1 + Math.floor((T - kd.at - TIMING.fall) / per));
      const inTick = ((T - kd.at - TIMING.fall) % per) / per;
      f[down].pose = target;
      ref.pose = inTick < 0.5 ? POSES.refCount : POSES.refStand;
      banner = { big: String(n), small: names[down], kind: 'count' };
    } else if (kd.getsUp) {
      f[down].pose = lerpPose(POSES.kneel, GUARD, clamp((T - countEnd) / TIMING.getUp, 0, 1));
      banner = { big: 'IL SE RELÈVE !', kind: 'kd' };
    } else {
      f[down].pose = POSES.down;
      banner = { big: 'K.O. !', kind: 'ko' };
    }
  }

  // --- Arrêt, décision, résultat --------------------------------------------
  const stop = find('stoppage');
  if (stop) {
    if (!koed.has(stop.who)) f[stop.who].pose = lerpPose(GUARD, POSES.hit, 0.6);
    ref.pose = POSES.refWave;
    ref.x = Math.round(lerp(f.red.x, f.blue.x, 0.5));
    banner = { big: STOP_BANNER[stop.reason] ?? 'ARRÊT !', small: names[other(stop.who)], kind: 'ko' };
  }
  const decision = find('decision');
  if (decision) {
    for (const c of ['red', 'blue'] as const) f[c].x = CORNER_X[c] + dir(c) * 30;
    banner = { big: 'DÉCISION', small: 'des juges…', kind: 'round' };
  }
  const result = past.find((b) => b.kind === 'result') as Extract<Beat, { kind: 'result' }> | undefined;
  if (result) {
    const t = T - result.at;
    for (const c of ['red', 'blue'] as const) {
      if (koed.has(c)) { f[c].pose = POSES.down; continue; }
      if (result.winner === c) f[c].pose = lerpPose(GUARD, POSES.victory, clamp(t / 0.6, 0, 1));
      else f[c].pose = lerpPose(GUARD, POSES.hit, 0.3);
    }
    ref.x = CENTER;
    ref.pose = POSES.refStand;
    banner = result.winner
      ? { big: names[result.winner].toUpperCase(), small: result.summary, kind: 'winner' }
      : { big: 'MATCH NUL', small: result.summary, kind: 'winner' };
  }
  // Un boxeur KO reste au sol.
  for (const c of koed) f[c].pose = POSES.down;

  // --- Ambiance : la foule s'enflamme sur les gros moments ---------------
  const hot = past.filter((b) => T - b.at < 1.5 && (b.kind === 'knockdown' || b.kind === 'stoppage' || b.kind === 'hurt' || (b.kind === 'punch' && b.clean && b.landed)));
  const excitement = hot.length ? 1 : 0;

  // --- Horloge et commentaire ---------------------------------------------
  let clock = last?.clock ?? 0;
  if (tl.mode === 'full' && last && (last.kind === 'punch' || last.kind === 'range' || last.kind === 'roundIntro' || last.kind === 'hurt' || last.kind === 'clinch')) {
    clock = last.kind === 'roundIntro' ? 0 : last.clock + (T - last.at);
  }
  const commented = [...past].reverse().find((b) => b.text);

  return {
    red: f.red, blue: f.blue, ref, hp,
    round: last?.round ?? 1,
    clock: clamp(Math.round(clock), 0, 180),
    banner,
    comment: commented?.text ?? '',
    spark, shake, excitement,
    finished: T >= tl.duration,
  };
}
