/**
 * Matchmaking automatique : propose une carte de gala cohérente.
 * Sert au bouton "Gala rapide" et servira plus tard aux promoteurs rivaux (IA).
 */
import { addDays } from '../core/date';
import type { Rng } from '../core/rng';
import { isAvailable } from '../model/boxer';
import { WEIGHT_CLASS_INFO } from '../model/labels';
import type { BoxerId, IsoDate, League, WeightClass } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { mandatoryBooked } from './calendar';
import { bookFight, createEvent, plannedFightsOf, type BookOptions } from './events';
import { RANKED_SPOTS } from './ranking';

const EVENT_NAMES = ['Nuit des Champions', 'Choc des Titans', 'Guerre au Sommet', 'Coup de Tonnerre', 'La Grande Revanche', 'Ring de Feu', 'Soirée Explosive', 'Gants d’Or', 'Rendez-vous Royal', 'Collision'];
const VENUES: [string, string][] = [
  ['Centre Vidéotron', 'Québec'], ['Centre Bell', 'Montréal'], ['Madison Square Garden', 'New York'],
  ['MGM Grand Garden Arena', 'Las Vegas'], ['O2 Arena', 'Londres'], ['Arena Ciudad de México', 'Mexico'],
  ['Scotiabank Arena', 'Toronto'], ['Manchester Arena', 'Manchester'], ['Barclays Center', 'Brooklyn'],
];

interface Proposal { a: BoxerId; b: BoxerId; opts: BookOptions; appeal: number }

function free(league: League, id: BoxerId | null | undefined, date: IsoDate, used: Set<BoxerId>): id is BoxerId {
  if (!id || used.has(id)) return false;
  const b = league.boxers[id]!;
  return isAvailable(b, date) && plannedFightsOf(league, id).length === 0;
}

/** Meilleur combat possible dans une division à une date donnée. */
export function proposeFight(league: League, wc: WeightClass, date: IsoDate, rng: Rng, used: Set<BoxerId>): Proposal | null {
  const div = league.divisions[wc];
  const ranked = div.rankings.slice(0, RANKED_SPOTS);
  const pop = (id: BoxerId) => league.boxers[id]!.popularity;
  const champ = div.championId;

  // 1. Défense obligatoire qui approche : champion contre le n°1.
  if (champ && div.mandatoryDue && !mandatoryBooked(league, wc) && div.mandatoryDue <= addDays(date, 150)
    && free(league, champ, date, used) && free(league, ranked[0], date, used)) {
    return { a: champ, b: ranked[0]!, opts: { title: true }, appeal: pop(champ) + pop(ranked[0]!) + 40 };
  }
  // 2. Titre vacant : n°1 contre n°2 (ou les meilleurs disponibles du top 5).
  if (!champ) {
    const top = ranked.slice(0, 5).filter((id) => free(league, id, date, used));
    if (top.length >= 2) return { a: top[0]!, b: top[1]!, opts: { title: true }, appeal: pop(top[0]!) + pop(top[1]!) + 40 };
  }
  // 3. Défense volontaire contre un membre du top 5.
  if (champ && free(league, champ, date, used) && rng.chance(0.3)) {
    const challengers = ranked.slice(0, 5).filter((id) => free(league, id, date, used));
    if (challengers.length) {
      const c = rng.pick(challengers);
      return { a: champ, b: c, opts: { title: true }, appeal: pop(champ) + pop(c) + 30 };
    }
  }
  // 4. Combat entre aspirants proches au classement.
  const avail = ranked.filter((id) => free(league, id, date, used));
  if (avail.length < 2) return null;
  const i = rng.int(0, Math.max(0, avail.length - 2));
  const j = Math.min(avail.length - 1, i + rng.int(1, 3));
  const top5 = div.rankings.indexOf(avail[i]!) < 5 && div.rankings.indexOf(avail[j]!) < 5;
  return { a: avail[i]!, b: avail[j]!, opts: { rounds: top5 ? 12 : 10 }, appeal: pop(avail[i]!) + pop(avail[j]!) };
}

/** Crée et remplit un gala complet (un combat par catégorie quand c'est possible). */
export function autoCard(league: League, rng: Rng, date: IsoDate = addDays(league.currentDate, 28)) {
  const [venue, city] = rng.pick(VENUES);
  const ev = createEvent(league, { name: rng.pick(EVENT_NAMES), date, venue, city });
  const used = new Set<BoxerId>();
  const proposals: Proposal[] = [];
  for (const wc of rng.shuffle([...WEIGHT_CLASSES])) {
    const p = proposeFight(league, wc, date, rng, used);
    if (p) { proposals.push(p); used.add(p.a); used.add(p.b); }
  }
  // Ordre de la carte : du moins attrayant au combat principal.
  proposals.sort((x, y) => x.appeal - y.appeal);
  for (const p of proposals) bookFight(league, ev.id, p.a, p.b, { ...p.opts, seed: rng.seed() });
  const main = proposals[proposals.length - 1];
  if (main) {
    const wc = league.boxers[main.a]!.weightClass;
    ev.name = `${ev.name} — ${WEIGHT_CLASS_INFO[wc].label}`;
  }
  return ev;
}
