/**
 * Pointage des juges (système des 10 points).
 *
 * Chaque juge a un "profil" : l'un valorise l'agressivité, un autre la boxe
 * propre et la défense. Ajouté à une part de subjectivité, ça rend possibles
 * les décisions partagées dans les rounds serrés, comme dans la vraie vie.
 */
import type { Rng } from '../core/rng';
import type { Corner, Scorecard } from '../model/types';

export interface RoundTally {
  powerLanded: number;
  jabsLanded: number;
  thrown: number;
  knockdowns: number;
  opponentMissed: number; // coups de l'adversaire esquivés (défense)
}

export interface JudgeProfile {
  power: number;
  jab: number;
  aggression: number;
  defense: number;
  /** Écart-type de la subjectivité du juge. */
  noise: number;
}

export const JUDGE_PROFILES: JudgeProfile[] = [
  { power: 1.0, jab: 0.5, aggression: 0.02, defense: 0.03, noise: 2.2 }, // neutre
  { power: 1.1, jab: 0.4, aggression: 0.05, defense: 0.0, noise: 2.6 }, // aime l'agressivité
  { power: 0.95, jab: 0.65, aggression: 0.0, defense: 0.06, noise: 2.2 }, // aime la technique
];

function points(t: RoundTally, j: JudgeProfile): number {
  return t.powerLanded * j.power + t.jabsLanded * j.jab + t.thrown * j.aggression + t.opponentMissed * j.defense;
}

/** Retourne [points rouge, points bleu] pour un round. */
export function scoreRound(rng: Rng, red: RoundTally, blue: RoundTally, judge: JudgeProfile): [number, number] {
  const diff = points(red, judge) - points(blue, judge) + rng.gaussian(0, judge.noise);
  let r = 10, b = 10;
  if (diff > 0.6) b = 9;
  else if (diff < -0.6) r = 9;
  // Domination écrasante sans knockdown : 10-8 (rare).
  if (Math.abs(diff) > 14 && rng.chance(0.3)) { if (diff > 0) b = 8; else r = 8; }
  // Chaque knockdown coûte un point à celui qui va au tapis.
  r -= blue.knockdowns;
  b -= red.knockdowns;
  // Normalisation : le gagnant du round reçoit 10.
  const top = Math.max(r, b);
  return [r + (10 - top), b + (10 - top)];
}

/** Décision finale à partir des trois cartes. */
export function decide(cards: Scorecard[]): { winner: Corner | null; method: 'UD' | 'SD' | 'MD' | 'DRAW' } {
  let red = 0, blue = 0, draw = 0;
  for (const c of cards) {
    const r = c.red.reduce((a, b) => a + b, 0);
    const b = c.blue.reduce((a, b) => a + b, 0);
    if (r > b) red++; else if (b > r) blue++; else draw++;
  }
  const winner: Corner | null = red >= 2 ? 'red' : blue >= 2 ? 'blue' : null;
  if (!winner) return { winner: null, method: 'DRAW' };
  const w = winner === 'red' ? red : blue;
  const l = winner === 'red' ? blue : red;
  if (w === 3) return { winner, method: 'UD' };
  if (l === 1) return { winner, method: 'SD' };
  return { winner, method: draw > 0 ? 'MD' : 'UD' };
}
