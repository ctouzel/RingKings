/**
 * Classement par points (façon classements mondiaux).
 *
 * - Une victoire rapporte des points selon la valeur de l'adversaire (son rang),
 *   la méthode (un KO vaut plus) et l'enjeu (combat de titre).
 * - Une défaite en retire, surtout face à un adversaire moins bien classé.
 * - Les points gardent leur pleine valeur 6 mois, puis s'effacent jusqu'à 2 ans :
 *   un boxeur inactif glisse au classement.
 */
import { daysBetween } from '../core/date';
import { overallRating } from '../model/boxer';
import type { Boxer, BoxerId, Corner, Fight, FightResult, IsoDate, League, WeightClass } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';

/** Nombre de boxeurs affichés au classement (champion exclu). */
export const RANKED_SPOTS = 14;

/** Valeur d'un adversaire selon son rang : champion = 100, n°1 = 85 … n°14 = 20, non classé = 15. */
export function opponentValue(rank: number | null): number {
  if (rank === 0) return 100;
  if (rank === null || rank > RANKED_SPOTS) return 15;
  return 85 - (rank - 1) * 5;
}

const METHOD_MULT: Record<FightResult['method'], number> = {
  KO: 1.2, TKO: 1.2, UD: 1.0, MD: 0.9, SD: 0.85, DRAW: 0.4, DQ: 0.8,
};

/** Points de classement gagnés/perdus par chaque coin pour un combat terminé. */
export function fightPoints(fight: Fight, result: FightResult): Record<Corner, number> {
  const rank = fight.rankAtFight;
  const roundsMult = fight.scheduledRounds >= 10 ? 1 : 0.8;
  const titleMult = fight.isTitleFight ? 1.25 : 1;
  const winPts = (loserRank: number | null) =>
    (20 + opponentValue(loserRank)) * METHOD_MULT[result.method] * roundsMult * titleMult;

  if (result.winner === null) {
    return {
      red: Math.round(winPts(rank.blue)),
      blue: Math.round(winPts(rank.red)),
    };
  }
  const w = result.winner, l: Corner = w === 'red' ? 'blue' : 'red';
  const stopped = result.method === 'KO' || result.method === 'TKO';
  const lossPts = -(10 + (100 - opponentValue(rank[w])) * 0.15) * (stopped ? 1.3 : 1);
  return { [w]: Math.round(winPts(rank[l])), [l]: Math.round(lossPts) } as Record<Corner, number>;
}

/** Poids d'un résultat selon son ancienneté : 100 % pendant 6 mois, puis 0 à 2 ans. */
export function decay(from: IsoDate, to: IsoDate): number {
  const age = daysBetween(from, to);
  if (age <= 180) return 1;
  return Math.max(0, 1 - (age - 180) / 550);
}

/** Total des points de classement d'un boxeur à une date. */
export function rankingPoints(league: League, b: Boxer, date: IsoDate = league.currentDate): number {
  let pts = b.seedPoints * decay(league.startDate, date);
  for (const id of b.fightIds) {
    const f = league.fights[id];
    if (!f?.result?.rankingPoints) continue;
    const corner: Corner = f.red === b.id ? 'red' : 'blue';
    pts += f.result.rankingPoints[corner] * decay(f.date, date);
  }
  return Math.round(pts);
}

/** Recalcule l'ordre de chaque division (champion exclu). */
export function recomputeRankings(league: League): void {
  for (const wc of WEIGHT_CLASSES) recomputeDivision(league, wc);
}

export function recomputeDivision(league: League, wc: WeightClass): void {
  const div = league.divisions[wc];
  const candidates = Object.values(league.boxers)
    .filter((b) => b.weightClass === wc && b.status !== 'retired' && b.id !== div.championId)
    .map((b) => ({ b, pts: rankingPoints(league, b) }))
    .sort((x, y) => y.pts - x.pts || overallRating(y.b) - overallRating(x.b));
  div.rankings = candidates.map((x) => x.b.id);
}

/** Rang d'un boxeur : 0 = champion, 1..n = classé, null = hors classement. */
export function rankOf(league: League, id: BoxerId): number | null {
  const b = league.boxers[id];
  if (!b) return null;
  const div = league.divisions[b.weightClass];
  if (div.championId === id) return 0;
  const i = div.rankings.indexOf(id);
  return i >= 0 && i < RANKED_SPOTS ? i + 1 : null;
}
