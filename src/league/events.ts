/**
 * Galas : création, programmation des combats (avec validations) et déroulement.
 */
import { formatDate } from '../core/date';
import { fullName, isAvailable } from '../model/boxer';
import { nextEventId, nextFightId } from '../model/league';
import type { BoxerId, Corner, Fight, FightEvent, IsoDate, League } from '../model/types';
import { simulateFight } from '../sim/engine';
import { fighterFromBoxer } from '../sim/fighter';
import { advanceTo } from './calendar';
import { applyResult } from './career';
import { RANKED_SPOTS, rankOf, recomputeRankings } from './ranking';

export interface EventInput {
  name: string;
  date: IsoDate;
  venue: string;
  city: string;
}

export function createEvent(league: League, input: EventInput): FightEvent {
  if (input.date < league.currentDate) throw new Error('Un gala ne peut pas être dans le passé.');
  const ev: FightEvent = { id: nextEventId(league), ...input, status: 'planned', fightIds: [] };
  league.events[ev.id] = ev;
  return ev;
}

/** Combats prévus (galas non encore disputés) d'un boxeur. */
export function plannedFightsOf(league: League, boxerId: BoxerId): Fight[] {
  return Object.values(league.fights).filter(
    (f) => !f.result && (f.red === boxerId || f.blue === boxerId) && league.events[f.eventId]?.status === 'planned',
  );
}

export interface BookOptions {
  rounds?: Fight['scheduledRounds'];
  title?: boolean;
  /** Seed du combat (aléatoire par défaut ; fixé dans les tests). */
  seed?: number;
}

/** Vérifie qu'un combat peut être programmé. Retourne un message d'erreur, ou null si c'est possible. */
export function canBook(league: League, eventId: string, a: BoxerId, b: BoxerId, opts: BookOptions = {}): string | null {
  const ev = league.events[eventId];
  if (!ev || ev.status !== 'planned') return 'Gala introuvable ou déjà disputé.';
  if (a === b) return 'Un boxeur ne peut pas s’affronter lui-même.';
  const ba = league.boxers[a], bb = league.boxers[b];
  if (!ba || !bb) return 'Boxeur introuvable.';
  if (ba.weightClass !== bb.weightClass) return 'Les deux boxeurs doivent être de la même catégorie.';
  for (const x of [ba, bb]) {
    if (x.status === 'retired') return `${fullName(x)} est à la retraite.`;
    if (!isAvailable(x, ev.date)) return `${fullName(x)} est indisponible jusqu’au ${formatDate(x.unavailableUntil!)}.`;
    if (plannedFightsOf(league, x.id).length > 0) return `${fullName(x)} est déjà programmé dans un gala.`;
  }
  if (opts.title) {
    const div = league.divisions[ba.weightClass];
    if (ev.fightIds.some((id) => league.fights[id]?.isTitleFight && league.fights[id]?.weightClass === ba.weightClass)) {
      return 'Ce gala a déjà un combat de titre dans cette catégorie.';
    }
    if (div.championId) {
      if (div.championId !== a && div.championId !== b) return 'Un combat de titre doit inclure le champion.';
      const challenger = div.championId === a ? b : a;
      const r = rankOf(league, challenger);
      if (r === null || r > 10) return 'L’aspirant doit faire partie du top 10.';
    } else {
      const ra = rankOf(league, a), rb = rankOf(league, b);
      if (ra === null || rb === null || ra > 5 || rb > 5) return 'Un titre vacant se dispute entre deux boxeurs du top 5.';
    }
  }
  return null;
}

export function bookFight(league: League, eventId: string, a: BoxerId, b: BoxerId, opts: BookOptions = {}): Fight {
  const err = canBook(league, eventId, a, b, opts);
  if (err) throw new Error(err);
  const ev = league.events[eventId]!;
  // Coin rouge : le champion, sinon le mieux classé.
  const rank = (id: BoxerId) => rankOf(league, id) ?? 99;
  const [red, blue] = rank(a) <= rank(b) ? [a, b] : [b, a];
  const fight: Fight = {
    id: nextFightId(league),
    eventId,
    date: ev.date,
    weightClass: league.boxers[a]!.weightClass,
    red, blue,
    scheduledRounds: opts.title ? 12 : opts.rounds ?? 10,
    isTitleFight: !!opts.title,
    isMainEvent: false,
    rankAtFight: { red: null, blue: null },
    seed: opts.seed ?? Math.floor(Math.random() * 2 ** 32),
  };
  league.fights[fight.id] = fight;
  ev.fightIds.push(fight.id);
  markMainEvent(league, ev);
  return fight;
}

export function unbookFight(league: League, fightId: string): void {
  const f = league.fights[fightId];
  if (!f || f.result) return;
  const ev = league.events[f.eventId]!;
  ev.fightIds = ev.fightIds.filter((id) => id !== fightId);
  delete league.fights[fightId];
  markMainEvent(league, ev);
}

/** Déplace un combat sur la carte (-1 = plus tôt, +1 = plus tard). Le dernier est le combat principal. */
export function moveFight(league: League, fightId: string, dir: -1 | 1): void {
  const f = league.fights[fightId];
  if (!f || f.result) return;
  const ev = league.events[f.eventId]!;
  const i = ev.fightIds.indexOf(fightId), j = i + dir;
  if (j < 0 || j >= ev.fightIds.length) return;
  [ev.fightIds[i], ev.fightIds[j]] = [ev.fightIds[j]!, ev.fightIds[i]!];
  markMainEvent(league, ev);
}

/** Fait d'un combat le combat principal (dernier de la carte). */
export function setMainEvent(league: League, fightId: string): void {
  const f = league.fights[fightId];
  if (!f || f.result) return;
  const ev = league.events[f.eventId]!;
  ev.fightIds = [...ev.fightIds.filter((id) => id !== fightId), fightId];
  markMainEvent(league, ev);
}

/** Annule un gala prévu (et ses combats). */
export function deleteEvent(league: League, eventId: string): void {
  const ev = league.events[eventId];
  if (!ev || ev.status !== 'planned') return;
  for (const id of ev.fightIds) delete league.fights[id];
  delete league.events[eventId];
}

/** Galas prévus, du plus proche au plus lointain. */
export function plannedEvents(league: League): FightEvent[] {
  return Object.values(league.events).filter((e) => e.status === 'planned')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Le dernier combat de la carte est le combat principal. */
function markMainEvent(league: League, ev: FightEvent): void {
  ev.fightIds.forEach((id, i) => { league.fights[id]!.isMainEvent = i === ev.fightIds.length - 1; });
}

/** Rejoue un combat disputé à l'identique (mêmes caractéristiques, même seed). */
export function replayFight(league: League, fight: Fight) {
  const red = league.boxers[fight.red]!, blue = league.boxers[fight.blue]!;
  const snap = fight.snapshot;
  return simulateFight({
    red: snap ? { name: fullName(red), ...snap.red } : fighterFromBoxer(red),
    blue: snap ? { name: fullName(blue), ...snap.blue } : fighterFromBoxer(blue),
    rounds: fight.scheduledRounds,
    weightClass: fight.weightClass,
    seed: fight.seed,
  });
}

/** Dispute tous les combats d'un gala et met la ligue à jour. */
export function runEvent(league: League, eventId: string): Fight[] {
  const ev = league.events[eventId];
  if (!ev || ev.status !== 'planned') throw new Error('Gala introuvable ou déjà disputé.');
  if (plannedEvents(league)[0]?.id !== ev.id) throw new Error('Les galas se disputent dans l’ordre chronologique.');
  if (ev.fightIds.length === 0) throw new Error('La carte est vide.');
  if (league.draft) throw new Error(`Le repêchage ${league.draft.year} doit être terminé avant de disputer un gala.`);
  advanceTo(league, ev.date);
  // Le passage à une nouvelle saison ouvre un repêchage : on s'arrête là.
  const opened = league.draft as League['draft']; // (TypeScript ne sait pas qu'advanceTo peut le créer)
  if (opened) throw new Error(`Nouvelle saison ! Consulte le bilan et fais ton repêchage ${opened.year}, puis dispute ${ev.name}.`);
  if (ev.fightIds.length === 0) throw new Error('Des retraites ont vidé la carte de ce gala : recompose-la.');

  const fights = ev.fightIds.map((id) => league.fights[id]!);
  // Un combat de titre peut devenir caduc (titre déclaré vacant entre-temps) : il reste
  // un combat de titre seulement s'il est encore valide.
  for (const f of fights) {
    const div = league.divisions[f.weightClass];
    if (f.isTitleFight && div.championId && div.championId !== f.red && div.championId !== f.blue) f.isTitleFight = false;
    f.rankAtFight = { red: rankOf(league, f.red), blue: rankOf(league, f.blue) };
    const snap = (id: BoxerId) => {
      const { name: _name, ...rest } = fighterFromBoxer(league.boxers[id]!);
      return rest;
    };
    f.snapshot = { red: snap(f.red), blue: snap(f.blue) } as Record<Corner, ReturnType<typeof snap>>;
  }
  for (const f of fights) {
    const { result } = replayFight(league, f);
    applyResult(league, f, result);
  }
  ev.status = 'completed';
  recomputeRankings(league);
  return fights;
}

export { RANKED_SPOTS };
