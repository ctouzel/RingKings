/**
 * Fin de saison (passage du 31 décembre) :
 *  1. bilan de l'année (récompenses),
 *  2. progression / déclin de chaque boxeur selon son âge, son potentiel et son usure,
 *  3. retraites,
 *  4. ouverture du repêchage.
 */
import { formatDate } from '../core/date';
import { Rng, clamp } from '../core/rng';
import { ageOn, fullName, overallRating, recordString } from '../model/boxer';
import { WEIGHT_CLASS_INFO } from '../model/labels';
import type {
  AttributeKey, Boxer, BoxerId, Corner, Fight, FightResult, IsoDate, League, SeasonReview, WeightClass,
} from '../model/types';
import { ATTRIBUTE_KEYS, WEIGHT_CLASSES } from '../model/types';
import { addNews } from './career';
import { autoDraft, createDraft } from './draft';
import { unbookFight } from './events';
import { opponentValue, recomputeRankings } from './ranking';

const other = (c: Corner): Corner => (c === 'red' ? 'blue' : 'red');
type Played = Fight & { result: FightResult };

/** RNG propre à chaque fin de saison (reproductible pour une même partie). */
export function seasonRng(league: League, year: number): Rng {
  return new Rng((league.seed * 31 + year * 7919) >>> 0);
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

/**
 * Poids de chaque attribut quand un boxeur décline : le physique (vitesse,
 * jambes, menton, récupération) part en premier ; l'expérience (QI de ring)
 * continue même de progresser.
 */
const DECLINE_WEIGHTS: Record<AttributeKey, number> = {
  power: 0.6, handSpeed: 1.3, accuracy: 0.6, defense: 0.8, footwork: 1.3,
  chin: 1.4, stamina: 1.1, recovery: 1.2, ringIQ: -0.3,
};

/** Fait évoluer un boxeur d'un an. Retourne sa note avant / après. */
export function ageOneYear(b: Boxer, date: IsoDate, rng: Rng): { before: number; after: number } {
  const before = overallRating(b);
  const age = ageOn(b.birthDate, date);
  const { potential, peakAge, wear } = b.development;
  let base: number;
  if (age < peakAge) base = Math.max(0, potential - before) * rng.float(0.12, 0.35) + rng.gaussian(0.3, 1);
  else if (age <= peakAge + 1) base = rng.gaussian(0, 1);
  else base = Math.max(-9, -((age - peakAge) * rng.float(0.4, 0.9) + wear * 0.03) + rng.gaussian(0, 1));

  for (const k of ATTRIBUTE_KEYS) {
    const w = base >= 0 ? 1 : DECLINE_WEIGHTS[k];
    b.attributes[k] = b.attributes[k] + base * w + rng.gaussian(0, 0.8);
  }
  // Un boxeur ne dépasse pas son potentiel.
  const over = overallRating({ attributes: b.attributes, style: b.style }) - potential;
  if (base > 0 && over > 0) for (const k of ATTRIBUTE_KEYS) b.attributes[k] -= over;
  for (const k of ATTRIBUTE_KEYS) b.attributes[k] = Math.round(clamp(b.attributes[k], 20, 99));

  // L'usure se résorbe un peu chez les jeunes, s'accumule chez les vétérans.
  b.development.wear = Math.round(clamp(wear + (age >= 33 ? 1 : -4), 0, 100));
  if (b.development.potential < overallRating(b)) b.development.potential = overallRating(b);
  return { before, after: overallRating(b) };
}

// ---------------------------------------------------------------------------
// Retraites
// ---------------------------------------------------------------------------

export function retirementChance(league: League, b: Boxer, date: IsoDate, yearFights: Played[]): { p: number; reason: string } {
  const age = ageOn(b.birthDate, date);
  if (age >= 40) return { p: 1, reason: 'âge' };
  // Chaque facteur ajoute au risque ; la raison affichée est le facteur dominant.
  const factors: [string, number][] = [['âge', age < 30 ? 0 : age <= 33 ? 0.04 : [0.12, 0.2, 0.3, 0.45, 0.65][Math.min(4, age - 34)]!]];
  if (b.development.wear > 65 && age >= 29) factors.push(['usure physique', 0.2]);
  if (overallRating(b) < 55 && age >= 28) factors.push(['déclin', 0.2]);
  const mine = yearFights.filter((f) => f.red === b.id || f.blue === b.id);
  const losses = mine.filter((f) => f.result.winner !== null && (f.result.winner === 'red' ? f.red : f.blue) !== b.id).length;
  if (age >= 30 && mine.length >= 2 && losses === mine.length) factors.push(['série de défaites', 0.15]);
  if (age >= 33 && mine.length === 0) factors.push(['inactivité', 0.1]);
  let p = factors.reduce((sum, [, v]) => sum + v, 0);
  const reason = [...factors].sort((x, y) => y[1] - x[1])[0]![0];
  if (league.divisions[b.weightClass].championId === b.id) p -= 0.15; // un champion s'accroche
  return { p: clamp(p, 0, 0.95), reason };
}

export function retireBoxer(league: League, b: Boxer, date: IsoDate, reason: string): void {
  b.status = 'retired';
  b.retiredDate = date;
  const div = league.divisions[b.weightClass];
  if (div.championId === b.id) {
    const reign = div.titleHistory[div.titleHistory.length - 1];
    if (reign && !reign.lostOn) { reign.lostOn = date; reign.endedBy = 'retired'; }
    div.championId = null;
    div.mandatoryDue = null;
    addNews(league, { kind: 'vacated', boxerIds: [b.id], text: `${fullName(b)} prend sa retraite en champion : le titre ${WEIGHT_CLASS_INFO[b.weightClass].label} est vacant.` });
  }
  // Ses combats déjà programmés sont annulés.
  for (const f of Object.values(league.fights)) {
    if (!f.result && (f.red === b.id || f.blue === b.id)) unbookFight(league, f.id);
  }
  addNews(league, { kind: 'info', boxerIds: [b.id], text: `Retraite de ${fullName(b)} (${ageOn(b.birthDate, date)} ans, ${recordString(b.stats)}) — ${reason}.` });
}

// ---------------------------------------------------------------------------
// Récompenses
// ---------------------------------------------------------------------------

const vs = (l: League, f: Fight) => `${fullName(l.boxers[f.red]!)} vs ${fullName(l.boxers[f.blue]!)}`;
const winnerOf = (f: Played) => (f.result.winner ? f[f.result.winner] : null);

export function seasonAwards(league: League, fights: Played[]): SeasonReview['awards'] {
  const awards: SeasonReview['awards'] = {};
  if (fights.length === 0) return awards;

  // Boxeur de l'année : points gagnés + titres + KO.
  const score = new Map<BoxerId, { pts: number; w: number; l: number; d: number; ko: number; titles: number }>();
  for (const f of fights) {
    for (const c of ['red', 'blue'] as const) {
      const id = f[c];
      const s = score.get(id) ?? { pts: 0, w: 0, l: 0, d: 0, ko: 0, titles: 0 };
      s.pts += f.result.rankingPoints?.[c] ?? 0;
      if (f.result.winner === c) {
        s.w++;
        if (f.result.method === 'KO' || f.result.method === 'TKO') s.ko++;
        if (f.isTitleFight) s.titles++;
      } else if (f.result.winner === null) s.d++; else s.l++;
      score.set(id, s);
    }
  }
  const best = [...score.entries()].sort((a, b) =>
    (b[1].pts + b[1].titles * 40 + b[1].ko * 5) - (a[1].pts + a[1].titles * 40 + a[1].ko * 5))[0];
  if (best) {
    const [id, s] = best;
    const b = league.boxers[id]!;
    awards.boxer = { boxerId: id, text: `${fullName(b)} — ${s.w}-${s.l}-${s.d} (${s.ko} KO) cette année${s.titles ? `, ${s.titles} victoire${s.titles > 1 ? 's' : ''} en championnat` : ''}.` };
  }

  // KO de l'année : contre un adversaire de valeur, tôt, avec un titre en jeu…
  const kos = fights.filter((f) => f.result.method === 'KO' || f.result.method === 'TKO');
  const koScore = (f: Played) => {
    const w = f.result.winner!, l = other(w);
    return opponentValue(f.rankAtFight[l]) + (13 - f.result.endRound) * 4 + (f.isTitleFight ? 25 : 0)
      + (f.result.method === 'KO' ? 10 : 0);
  };
  const ko = kos.sort((a, b) => koScore(b) - koScore(a))[0];
  if (ko) awards.ko = { fightId: ko.id, boxerId: winnerOf(ko)!, text: `${fullName(league.boxers[winnerOf(ko)!]!)} : ${ko.result.summary} (${vs(league, ko)}, ${formatDate(ko.date)}).` };

  // Combat de l'année : knockdowns des deux côtés, cartes serrées, enjeu.
  const fightScore = (f: Played) => {
    const r = f.result, kd = r.stats.red.knockdowns + r.stats.blue.knockdowns;
    const both = r.stats.red.knockdowns > 0 && r.stats.blue.knockdowns > 0 ? 25 : 0;
    const close = r.method === 'KO' || r.method === 'TKO' ? 0
      : 20 - (r.scorecards.reduce((s, c) => s + Math.abs(c.red.reduce((a, b) => a + b, 0) - c.blue.reduce((a, b) => a + b, 0)), 0) / 3) * 4;
    return kd * 12 + both + Math.max(0, close) + r.endRound * 1.5 + (f.isTitleFight ? 20 : 0) + (r.titleChange ? 10 : 0);
  };
  const fot = [...fights].sort((a, b) => fightScore(b) - fightScore(a))[0];
  if (fot) awards.fight = { fightId: fot.id, text: `${vs(league, fot)} — ${fot.result.summary} (${formatDate(fot.date)}).` };

  // Surprise de l'année : la plus grande différence de rang en faveur du moins bien classé.
  const upsetGap = (f: Played) => {
    const w = f.result.winner;
    return w ? opponentValue(f.rankAtFight[other(w)]) - opponentValue(f.rankAtFight[w]) : -1;
  };
  const up = [...fights].sort((a, b) => upsetGap(b) - upsetGap(a))[0];
  if (up && upsetGap(up) >= 20) {
    const w = up.result.winner!;
    awards.upset = { fightId: up.id, boxerId: up[w], text: `${fullName(league.boxers[up[w]]!)} bat ${fullName(league.boxers[up[other(w)]]!)} (${up.result.summary}).` };
  }
  return awards;
}

// ---------------------------------------------------------------------------
// Fin de saison
// ---------------------------------------------------------------------------

export function endSeason(league: League, year: number): SeasonReview {
  const rng = seasonRng(league, year);
  const date = `${year}-12-31`;
  const fights = Object.values(league.fights).filter(
    (f): f is Played => !!f.result && f.date.startsWith(String(year)),
  );

  const review: SeasonReview = {
    year,
    awards: seasonAwards(league, fights),
    progress: [],
    retirements: [],
    champions: Object.fromEntries(WEIGHT_CLASSES.map((wc) => [wc, league.divisions[wc].championId])) as Record<WeightClass, BoxerId | null>,
    drafted: [],
  };

  // 1. Retraites (décidées sur l'année écoulée, avant le vieillissement).
  const active = Object.values(league.boxers).filter((b) => b.status !== 'retired');
  for (const b of active) {
    const { p, reason } = retirementChance(league, b, date, fights);
    if (rng.chance(p)) {
      review.retirements.push({ boxerId: b.id, age: ageOn(b.birthDate, date), record: recordString(b.stats), reason });
      retireBoxer(league, b, date, reason);
    }
  }
  // 2. Progression / déclin des autres.
  for (const b of active.filter((x) => x.status !== 'retired')) {
    const { before, after } = ageOneYear(b, date, rng);
    review.progress.push({ boxerId: b.id, before, after });
  }
  // 3. Repêchage (un repêchage précédent non terminé est complété automatiquement).
  if (league.draft) autoDraft(league);
  league.draft = createDraft(league, year + 1, rng);

  league.seasons.push(review);
  addNews(league, { kind: 'info', boxerIds: [], text: `Bilan de la saison ${year} publié. Le repêchage ${year + 1} est ouvert !` });
  recomputeRankings(league);
  return review;
}
