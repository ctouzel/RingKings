/**
 * Repêchage annuel : de jeunes espoirs à choisir pour remplacer les retraités.
 * Le vrai potentiel est caché : le promoteur ne voit que l'estimation du recruteur.
 */
import { Rng, clamp } from '../core/rng';
import { generateBoxer, nameRegistryOf } from '../gen/generator';
import { fullName, overallRating } from '../model/boxer';
import { WEIGHT_CLASS_INFO } from '../model/labels';
import type { BoxerId, Draft, DraftProspect, League, WeightClass } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { addNews } from './career';
import { recomputeRankings } from './ranking';

/** Taille cible d'une division. */
export const ROSTER_SIZE = 15;
/** Nombre d'espoirs proposés en plus des choix disponibles. */
export const EXTRA_PROSPECTS = 3;

export function activeCount(league: League, wc: WeightClass): number {
  return Object.values(league.boxers).filter((b) => b.weightClass === wc && b.status !== 'retired').length;
}

export function createDraft(league: League, year: number, rng: Rng): Draft {
  const reg = nameRegistryOf(league);
  const picks = {} as Draft['picks'];
  const pool = {} as Draft['pool'];
  for (const wc of WEIGHT_CLASSES) {
    // Au moins un choix par an, plus un par place libérée.
    picks[wc] = Math.max(1, ROSTER_SIZE - activeCount(league, wc));
    pool[wc] = [];
    for (let i = 0; i < picks[wc] + EXTRA_PROSPECTS; i++) {
      const age = rng.int(19, 23);
      const b = generateBoxer(rng, league, { weightClass: wc, rating: rng.gaussian(60, 4), age }, reg);
      b.seedPoints = 0;
      // Vrai potentiel (caché) et estimation du recruteur (parfois à côté de la plaque).
      const ovr = overallRating(b);
      b.development.potential = Math.round(clamp(ovr + rng.gaussian(17, 7), ovr + 3, 96));
      b.development.peakAge = rng.int(26, 31);
      b.development.wear = 0;
      b.popularity = Math.round(clamp(rng.gaussian(18, 6), 3, 40));
      const center = b.development.potential + rng.gaussian(0, 5);
      const width = rng.int(4, 9);
      const prospect: DraftProspect = {
        boxer: b,
        scoutLow: Math.round(clamp(center - width / 2, ovr, 99)),
        scoutHigh: Math.round(clamp(center + width / 2, ovr + 2, 99)),
      };
      pool[wc].push(prospect);
    }
    // Liste triée par estimation (comme un classement de recruteur).
    pool[wc].sort((a, b) => b.scoutHigh + b.scoutLow - a.scoutHigh - a.scoutLow);
  }
  return { year, picks, pool };
}

/** Vérifie une sélection : retourne un message d'erreur ou null. */
export function validateDraft(league: League, chosen: BoxerId[]): string | null {
  const d = league.draft;
  if (!d) return 'Aucun repêchage en cours.';
  for (const wc of WEIGHT_CLASSES) {
    const ids = new Set(d.pool[wc].map((p) => p.boxer.id));
    const n = chosen.filter((id) => ids.has(id)).length;
    if (n !== d.picks[wc]) return `${WEIGHT_CLASS_INFO[wc].label} : choisis ${d.picks[wc]} espoir${d.picks[wc] > 1 ? 's' : ''} (${n} sélectionné${n > 1 ? 's' : ''}).`;
  }
  return null;
}

/** Valide le repêchage : les espoirs choisis rejoignent la ligue. */
export function completeDraft(league: League, chosen: BoxerId[]): BoxerId[] {
  const err = validateDraft(league, chosen);
  if (err) throw new Error(err);
  const d = league.draft!;
  const added: BoxerId[] = [];
  for (const wc of WEIGHT_CLASSES) {
    for (const p of d.pool[wc]) {
      if (!chosen.includes(p.boxer.id)) continue;
      const b = p.boxer;
      b.draftYear = d.year;
      league.boxers[b.id] = b;
      added.push(b.id);
      addNews(league, {
        kind: 'info', boxerIds: [b.id],
        text: `Repêchage ${d.year} : ${fullName(b)} (${b.hometown}, potentiel estimé ${p.scoutLow}–${p.scoutHigh}) rejoint les ${WEIGHT_CLASS_INFO[wc].label.toLowerCase()}.`,
      });
    }
  }
  const review = league.seasons[league.seasons.length - 1];
  if (review) review.drafted = added;
  league.draft = null;
  recomputeRankings(league);
  return added;
}

/** Choix automatique : les meilleures estimations de chaque catégorie. */
export function autoPicks(league: League): BoxerId[] {
  const d = league.draft;
  if (!d) return [];
  return WEIGHT_CLASSES.flatMap((wc) => d.pool[wc].slice(0, d.picks[wc]).map((p) => p.boxer.id));
}

export function autoDraft(league: League): BoxerId[] {
  return completeDraft(league, autoPicks(league));
}
