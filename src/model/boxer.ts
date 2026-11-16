import type {
  Attributes, Boxer, CareerStats, FightingStyle, IsoDate,
} from './types';
import MEASURED_WEIGHTS from './rating-weights.json';

/** Statistiques de carrière vierges (nouveau boxeur). */
export function emptyCareerStats(): CareerStats {
  return {
    fights: 0, wins: 0, losses: 0, draws: 0,
    koWins: 0, koLosses: 0, roundsFought: 0,
    punchesThrown: 0, punchesLanded: 0, powerPunchesLanded: 0,
    knockdownsScored: 0, knockdownsSuffered: 0,
    titleFights: 0, titleWins: 0, titleDefenses: 0,
  };
}

/** Âge (en années révolues) à une date donnée du jeu. */
export function ageOn(birthDate: IsoDate, date: IsoDate): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

export function fullName(b: Pick<Boxer, 'firstName' | 'lastName'>): string {
  return `${b.firstName} ${b.lastName}`;
}

/** Nom d'affiche : Prénom "Surnom" Nom. */
export function displayName(b: Pick<Boxer, 'firstName' | 'lastName' | 'nickname'>): string {
  return b.nickname ? `${b.firstName} "${b.nickname}" ${b.lastName}` : fullName(b);
}

/** Palmarès au format boxe : "24-3-1 (18 KO)". */
export function recordString(s: CareerStats): string {
  return `${s.wins}-${s.losses}-${s.draws} (${s.koWins} KO)`;
}

/**
 * "Identité" de chaque style : ce qu'on attend intuitivement d'un cogneur,
 * d'un technicien, etc. Chaque ligne somme à 1.
 */
const STYLE_IDENTITY: Record<FightingStyle, Attributes> = {
  slugger:        { power: .24, handSpeed: .08, accuracy: .10, defense: .06, footwork: .04, chin: .18, stamina: .12, recovery: .10, ringIQ: .08 },
  outBoxer:       { power: .06, handSpeed: .16, accuracy: .14, defense: .16, footwork: .18, chin: .06, stamina: .10, recovery: .04, ringIQ: .10 },
  counterPuncher: { power: .12, handSpeed: .14, accuracy: .18, defense: .18, footwork: .08, chin: .06, stamina: .06, recovery: .04, ringIQ: .14 },
  swarmer:        { power: .10, handSpeed: .14, accuracy: .08, defense: .06, footwork: .08, chin: .14, stamina: .20, recovery: .12, ringIQ: .08 },
  boxerPuncher:   { power: .14, handSpeed: .12, accuracy: .12, defense: .12, footwork: .10, chin: .10, stamina: .10, recovery: .08, ringIQ: .12 },
};

/**
 * Pondération utilisée pour la note globale : 70 % valeur réelle de chaque
 * attribut dans le moteur de combat (mesurée par scripts/attr-value.test.ts,
 * stockée dans rating-weights.json) + 30 % identité du style.
 * Ainsi, deux boxeurs de même note ont des chances comparables.
 */
const STYLE_WEIGHTS = {} as Record<FightingStyle, Attributes>;
for (const style of Object.keys(STYLE_IDENTITY) as FightingStyle[]) {
  const measured = (MEASURED_WEIGHTS as Record<FightingStyle, Attributes>)[style];
  const w = {} as Attributes;
  let total = 0;
  for (const k of Object.keys(STYLE_IDENTITY[style]) as (keyof Attributes)[]) {
    w[k] = 0.7 * measured[k] + 0.3 * STYLE_IDENTITY[style][k];
    total += w[k];
  }
  for (const k of Object.keys(w) as (keyof Attributes)[]) w[k] /= total;
  STYLE_WEIGHTS[style] = w;
}

/** Note globale 1–100, pondérée par le style du boxeur. */
export function overallRating(b: Pick<Boxer, 'attributes' | 'style'>): number {
  const w = STYLE_WEIGHTS[b.style];
  let total = 0;
  for (const key of Object.keys(w) as (keyof Attributes)[]) {
    total += b.attributes[key] * w[key];
  }
  return Math.round(total);
}

/** Un boxeur peut-il être programmé pour un combat à cette date ? */
export function isAvailable(b: Boxer, date: IsoDate): boolean {
  if (b.status === 'retired') return false;
  return !b.unavailableUntil || b.unavailableUntil <= date; // comparaison ISO = chronologique
}

/** Pourcentage de coups portés sur la carrière. */
export function accuracyPct(s: CareerStats): number {
  return s.punchesThrown === 0 ? 0 : Math.round((s.punchesLanded / s.punchesThrown) * 1000) / 10;
}

/** Pourcentage de victoires avant la limite. */
export function koPct(s: CareerStats): number {
  return s.wins === 0 ? 0 : Math.round((s.koWins / s.wins) * 100);
}
