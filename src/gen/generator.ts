import { addDays } from '../core/date';
import { Rng, clamp } from '../core/rng';
import { emptyCareerStats, overallRating } from '../model/boxer';
import { createEmptyLeague, nextBoxerId } from '../model/league';
import type {
  Appearance, Attributes, AttributeKey, Boxer, CareerStats, FightingStyle,
  IsoDate, League, WeightClass,
} from '../model/types';
import { ATTRIBUTE_KEYS, WEIGHT_CLASSES } from '../model/types';
import { NAME_POOLS, NICKNAMES, nationalityOf, type Origin } from './names';

// ---------------------------------------------------------------------------
// Paramètres de génération (faciles à ajuster pour équilibrer la ligue)
// ---------------------------------------------------------------------------

/**
 * Poids des origines : ~60 % viennent des 4 grands marchés
 * (Mexique, États-Unis, Royaume-Uni, Canada dont Québec), le reste est
 * un échantillon international.
 */
export const ORIGIN_WEIGHTS: Record<Origin, number> = {
  MX: 13, US: 14, GB: 10, QC: 7, CA: 5,
  CU: 2, PR: 1.5, DO: 1.5, CO: 1, BR: 1, AR: 1.5,
  IE: 1.5, FR: 1.5, DE: 1, IT: 1, ES: 1, PL: 1, UA: 1.5, RU: 1, KZ: 1.5, UZ: 1,
  NG: 1.5, GH: 1.5, ZA: 1, JP: 1.5, PH: 2, TH: 1, KR: 1, AU: 1,
};

/**
 * Tendance de certaines origines vers les catégories légères (-) ou lourdes (+).
 * Multiplie le poids de l'origine selon la division.
 */
const ORIGIN_SIZE_BIAS: Partial<Record<Origin, number>> = {
  JP: -1, PH: -1, TH: -1, KR: -0.6, MX: -0.4, PR: -0.4, DO: -0.3, CU: -0.2,
  UA: 0.6, RU: 0.5, GB: 0.4, NG: 0.7, PL: 0.5, DE: 0.4, US: 0.2, AU: 0.2,
};

/** Préférences de style par origine (multiplicateurs). */
const ORIGIN_STYLE_BIAS: Partial<Record<Origin, Partial<Record<FightingStyle, number>>>> = {
  MX: { swarmer: 1.8, slugger: 1.3 },
  CU: { outBoxer: 2, counterPuncher: 1.8, slugger: 0.5 },
  GB: { boxerPuncher: 1.3 },
  US: { counterPuncher: 1.3, boxerPuncher: 1.2 },
  QC: { swarmer: 1.3, slugger: 1.2 },
  UA: { outBoxer: 1.6 },
  KZ: { slugger: 1.4 },
  PH: { swarmer: 1.5 },
  JP: { boxerPuncher: 1.5 },
  IE: { swarmer: 1.4 },
};

const STYLE_WEIGHTS: Record<FightingStyle, number> = {
  slugger: 22, outBoxer: 20, counterPuncher: 16, swarmer: 20, boxerPuncher: 22,
};

/** Bonus/malus d'attributs selon le style (le "profil" du boxeur). */
const STYLE_MODS: Record<FightingStyle, Partial<Attributes>> = {
  slugger: { power: 12, chin: 6, recovery: 4, handSpeed: -5, footwork: -8, defense: -6, accuracy: -2, ringIQ: -2 },
  outBoxer: { footwork: 10, defense: 7, handSpeed: 6, accuracy: 4, ringIQ: 3, power: -10, chin: -5, recovery: -4 },
  counterPuncher: { accuracy: 10, defense: 8, ringIQ: 8, handSpeed: 3, stamina: -5, chin: -4, footwork: -2, recovery: -3 },
  swarmer: { stamina: 10, handSpeed: 5, chin: 5, recovery: 5, footwork: -5, defense: -7, accuracy: -4, ringIQ: -3 },
  boxerPuncher: {},
};

/** Morphologie par catégorie (taille moyenne en cm). */
const HEIGHT_BY_CLASS: Record<WeightClass, number> = {
  lightweight: 172, welterweight: 176, middleweight: 180, lightHeavyweight: 185, heavyweight: 194,
};

/**
 * Niveau visé (note globale) pour chaque place dans une division de 15.
 * Le classement final est recalculé, ces niveaux donnent juste la hiérarchie.
 */
function targetRating(slot: number, rng: Rng): number {
  if (slot === 0) return rng.gaussian(83, 2);
  if (slot < 5) return rng.gaussian(77, 2.5);
  if (slot < 10) return rng.gaussian(71, 3);
  return rng.gaussian(64, 3.5);
}

// Palettes de l'apparence (les indices correspondent aux palettes du sprite, étape 6).
export const SKIN_TONES = 6; // 0 = très clair … 5 = très foncé
export const HAIR_STYLES = 6; // 0 = chauve, 1 = ras, 2 = court, 3 = afro, 4 = queue, 5 = mohawk
export const HAIR_COLORS = 5; // 0 = noir, 1 = brun foncé, 2 = brun, 3 = blond, 4 = roux
export const TRUNKS_COLORS = ['#c0392b', '#2e86de', '#27ae60', '#f1c40f', '#8e44ad', '#ecf0f1', '#2c3e50', '#e67e22', '#16a085', '#d35400', '#e84393', '#111111'];
export const GLOVES_COLORS = ['#c0392b', '#2e86de', '#111111', '#f5f6fa', '#f1c40f', '#27ae60'];

/** Distribution des teintes de peau probables par origine (poids pour 0..5). */
const SKIN_BY_ORIGIN: Partial<Record<Origin, number[]>> = {
  US: [2, 2, 2, 2, 3, 3], CA: [4, 3, 2, 1, 1, 1], QC: [5, 3, 1, 1, 1, 1], GB: [5, 3, 1, 1, 1, 1],
  MX: [0, 2, 5, 3, 0, 0], CU: [1, 1, 2, 2, 2, 2], PR: [1, 2, 3, 2, 1, 1], DO: [0, 1, 2, 3, 3, 1],
  CO: [0, 1, 3, 3, 2, 1], BR: [1, 1, 2, 2, 2, 2], AR: [3, 4, 2, 0, 0, 0],
  NG: [0, 0, 0, 1, 3, 5], GH: [0, 0, 0, 1, 3, 5], ZA: [1, 1, 1, 1, 3, 4],
  JP: [2, 5, 2, 0, 0, 0], PH: [0, 2, 5, 2, 0, 0], TH: [0, 2, 5, 2, 0, 0], KR: [3, 5, 1, 0, 0, 0],
  KZ: [2, 4, 3, 0, 0, 0], UZ: [2, 4, 3, 0, 0, 0], FR: [3, 2, 2, 1, 2, 2],
};
const DEFAULT_SKIN = [5, 3, 1, 0, 0, 0];

// ---------------------------------------------------------------------------
// Génération d'un boxeur
// ---------------------------------------------------------------------------

export interface BoxerOptions {
  weightClass: WeightClass;
  /** Note globale visée (≈ 50–90). */
  rating: number;
  origin?: Origin;
  style?: FightingStyle;
  /** Âge forcé (sinon tiré au hasard selon le niveau). */
  age?: number;
}

function pickOrigin(rng: Rng, wc: WeightClass): Origin {
  const sizeFactor = (WEIGHT_CLASSES.indexOf(wc) - 2) / 2; // -1 (léger) … +1 (lourd)
  const weights: Partial<Record<Origin, number>> = {};
  for (const [origin, w] of Object.entries(ORIGIN_WEIGHTS) as [Origin, number][]) {
    const bias = ORIGIN_SIZE_BIAS[origin] ?? 0;
    weights[origin] = w * Math.max(0.15, 1 + bias * sizeFactor);
  }
  return rng.weighted(weights);
}

function pickStyle(rng: Rng, origin: Origin): FightingStyle {
  const bias = ORIGIN_STYLE_BIAS[origin] ?? {};
  const weights: Partial<Record<FightingStyle, number>> = {};
  for (const [s, w] of Object.entries(STYLE_WEIGHTS) as [FightingStyle, number][]) {
    weights[s] = w * (bias[s] ?? 1);
  }
  return rng.weighted(weights);
}

function generateAttributes(rng: Rng, style: FightingStyle, wc: WeightClass, target: number): Attributes {
  const f = (WEIGHT_CLASSES.indexOf(wc) - 2) / 2; // -1 … +1
  const weightMods: Partial<Attributes> = {
    power: 7 * f, handSpeed: -6 * f, footwork: -5 * f, stamina: -3 * f, chin: 2 * f,
  };
  const attrs = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) {
    attrs[k] = target + (STYLE_MODS[style][k] ?? 0) + (weightMods[k] ?? 0) + rng.gaussian(0, 5);
  }
  // Recentrer pour que la note globale corresponde à la cible.
  for (let i = 0; i < 3; i++) {
    const tmp = { attributes: roundAttrs(attrs), style };
    const diff = target - overallRating(tmp);
    for (const k of ATTRIBUTE_KEYS) attrs[k] += diff;
  }
  return roundAttrs(attrs);
}

function roundAttrs(a: Attributes): Attributes {
  const out = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) out[k as AttributeKey] = Math.round(clamp(a[k], 20, 99));
  return out;
}

function generateAppearance(rng: Rng, origin: Origin, wc: WeightClass, style: FightingStyle): Appearance {
  const skinWeights = SKIN_BY_ORIGIN[origin] ?? DEFAULT_SKIN;
  const skinTone = Number(rng.weighted(Object.fromEntries(skinWeights.map((w, i) => [String(i), w]))));
  const lightSkin = skinTone <= 1;
  const hairColor = lightSkin
    ? Number(rng.weighted({ '0': 2, '1': 3, '2': 3, '3': 2, '4': 1 }))
    : Number(rng.weighted({ '0': 6, '1': 2 }));
  const sizeIdx = WEIGHT_CLASSES.indexOf(wc) + (style === 'slugger' ? 1 : 0) + rng.int(-1, 1);
  return {
    skinTone,
    hairStyle: Number(rng.weighted({ '0': 2, '1': 4, '2': 4, '3': skinTone >= 3 ? 2 : 0.3, '4': 0.6, '5': 0.5 })),
    hairColor,
    trunksColor: rng.pick(TRUNKS_COLORS),
    glovesColor: rng.pick(GLOVES_COLORS),
    build: sizeIdx <= 1 ? 'slim' : sizeIdx >= 4 ? 'bulky' : 'medium',
    facialHair: Number(rng.weighted({ '0': 6, '1': 1.5, '2': 2 })),
  };
}

/** Palmarès d'avant-ligue cohérent avec le niveau, l'âge et le profil. */
function generateRecord(rng: Rng, attrs: Attributes, style: FightingStyle, rating: number, age: number, debutAge: number): CareerStats {
  const s = emptyCareerStats();
  const years = Math.max(1, age - debutAge);
  const fights = clamp(Math.round(years * rng.float(2.2, 3.4)), 5, 55);
  // Les jeunes espoirs sont protégés (palmarès quasi parfait) ; les vétérans
  // moyens ont servi de "faire-valoir" et accumulé les défaites.
  const prospectBonus = age < 26 ? (26 - age) * 0.05 : 0;
  const journeymanMalus = age >= 30 && rating < 70 ? 0.08 : 0;
  const winPct = clamp(
    0.5 + (rating - 60) * 0.018 + prospectBonus - journeymanMalus + rng.gaussian(0, 0.06), 0.4, 1,
  );
  s.fights = fights;
  s.draws = rng.chance(0.35) ? rng.int(1, Math.max(1, Math.round(fights * 0.04))) : 0;
  s.wins = Math.min(fights - s.draws, Math.round((fights - s.draws) * winPct));
  s.losses = fights - s.wins - s.draws;
  const koRate = clamp(0.25 + (attrs.power - 55) * 0.013 + rng.gaussian(0, 0.08), 0.08, 0.95);
  s.koWins = Math.round(s.wins * koRate);
  const koLossRate = clamp(0.25 + (65 - attrs.chin) * 0.012, 0.05, 0.85);
  s.koLosses = Math.round(s.losses * koLossRate);

  const koFights = s.koWins + s.koLosses;
  s.roundsFought = Math.round(koFights * rng.float(3.5, 5.5) + (fights - koFights) * rng.float(7, 9.5));
  const volume = { slugger: 42, outBoxer: 52, counterPuncher: 38, swarmer: 66, boxerPuncher: 48 }[style];
  s.punchesThrown = Math.round(s.roundsFought * (volume + attrs.handSpeed * 0.15) * rng.float(0.9, 1.1));
  s.punchesLanded = Math.round(s.punchesThrown * clamp(0.18 + attrs.accuracy * 0.0025, 0.2, 0.48));
  s.powerPunchesLanded = Math.round(s.punchesLanded * rng.float(0.4, 0.55));
  s.knockdownsScored = Math.round(s.koWins * rng.float(1.1, 1.6) + s.wins * 0.08);
  s.knockdownsSuffered = Math.round(s.koLosses * rng.float(1.1, 1.5) + s.losses * 0.2 + (fights * (75 - attrs.chin)) / 400);
  return s;
}

/** Noms et surnoms déjà utilisés, pour éviter les doublons dans la ligue. */
export interface NameRegistry {
  names: Set<string>;
  nicknames: Set<string>;
}

export function nameRegistryOf(league: League): NameRegistry {
  const reg: NameRegistry = { names: new Set(), nicknames: new Set() };
  for (const b of Object.values(league.boxers)) {
    reg.names.add(`${b.firstName} ${b.lastName}`);
    if (b.nickname) reg.nicknames.add(b.nickname);
  }
  return reg;
}

function pickNickname(rng: Rng, lang: keyof typeof NICKNAMES, reg: NameRegistry, southpaw: boolean): string | undefined {
  const pool = NICKNAMES[lang].filter((n) => !reg.nicknames.has(n));
  if (southpaw && lang === 'es' && !reg.nicknames.has('El Zurdo')) pool.push('El Zurdo');
  if (pool.length === 0) return undefined;
  const nick = rng.pick(pool);
  reg.nicknames.add(nick);
  return nick;
}

export function generateBoxer(
  rng: Rng, league: League, opts: BoxerOptions, reg: NameRegistry,
): Boxer {
  const wc = opts.weightClass;
  const origin = opts.origin ?? pickOrigin(rng, wc);
  const pool = NAME_POOLS[origin];

  let firstName = '', lastName = '';
  for (let tries = 0; tries < 50; tries++) {
    firstName = rng.pick(pool.first);
    lastName = rng.pick(pool.last);
    if (!reg.names.has(`${firstName} ${lastName}`)) break;
  }
  reg.names.add(`${firstName} ${lastName}`);

  const style = opts.style ?? pickStyle(rng, origin);
  const stance = rng.chance(style === 'counterPuncher' ? 0.3 : 0.18) ? 'southpaw' : 'orthodox';
  const rating = clamp(Math.round(opts.rating), 40, 95);
  const attributes = generateAttributes(rng, style, wc, rating);

  // Âge : les meilleurs sont en général dans la force de l'âge ; les plus
  // faibles sont soit de jeunes espoirs, soit des vétérans en fin de parcours.
  const age = opts.age ?? Math.round(clamp(
    rating >= 75 ? rng.gaussian(29, 3) : rng.chance(0.55) ? rng.gaussian(23.5, 2) : rng.gaussian(32, 3),
    19, 39,
  ));
  const birthDate = addDays(league.currentDate, -Math.round((age + rng.float(0, 0.99)) * 365.25));
  const debutAge = Math.min(age - 1, rng.int(18, 23));

  const peakAge = rng.int(26, 31);
  const potential = age < peakAge
    ? clamp(Math.round(rating + (peakAge - age) * rng.float(0.6, 2.4)), rating, 97)
    : rating;

  const stats = generateRecord(rng, attributes, style, rating, age, debutAge);
  const heightCm = Math.round(HEIGHT_BY_CLASS[wc] + rng.gaussian(0, 4.5) + (style === 'outBoxer' ? 2 : 0) - (style === 'swarmer' ? 2 : 0));
  const reachCm = Math.round(heightCm + rng.gaussian(3, 4) + (style === 'outBoxer' ? 2 : 0));

  const bigMarket = ['MX', 'US', 'GB', 'QC', 'CA'].includes(origin) ? 8 : 0;
  const popularity = Math.round(clamp(
    (rating - 55) * 1.6 + stats.wins * 0.6 + (stats.koWins / Math.max(1, stats.wins)) * 15 + bigMarket + rng.gaussian(0, 7),
    3, 95,
  ));

  return {
    id: nextBoxerId(league),
    firstName,
    lastName,
    nickname: rng.chance(0.4) ? pickNickname(rng, pool.nickLang, reg, stance === 'southpaw') : undefined,
    nationality: nationalityOf(origin),
    hometown: rng.pick(pool.cities),
    birthDate,
    heightCm,
    reachCm,
    weightClass: wc,
    stance,
    style,
    attributes,
    development: {
      potential,
      peakAge,
      wear: Math.round(clamp(stats.fights * 0.8 + stats.koLosses * 6 + Math.max(0, age - 30) * 2, 0, 80)),
    },
    appearance: generateAppearance(rng, origin, wc, style),
    popularity,
    status: 'active',
    debutDate: addDays(birthDate, Math.round(debutAge * 365.25) + rng.int(0, 300)),
    stats,
    fightIds: [],
  };
}

// ---------------------------------------------------------------------------
// Génération de la ligue complète
// ---------------------------------------------------------------------------

export interface LeagueOptions {
  seed: number;
  name?: string;
  startDate?: IsoDate;
  boxersPerDivision?: number;
}

/** Score de classement initial : niveau + qualité du palmarès. */
function initialRankScore(b: Boxer, rng: Rng): number {
  const s = b.stats;
  return overallRating(b) * 1.0 + (s.wins - s.losses * 2.5) * 0.25 + rng.gaussian(0, 1.5);
}

export function generateLeague(opts: LeagueOptions): League {
  const rng = new Rng(opts.seed);
  const league = createEmptyLeague(opts.name ?? 'Ligue RingKings', opts.startDate ?? '2026-01-01', opts.seed);
  const perDivision = opts.boxersPerDivision ?? 15;
  const reg = nameRegistryOf(league);

  for (const wc of WEIGHT_CLASSES) {
    const boxers: Boxer[] = [];
    for (let slot = 0; slot < perDivision; slot++) {
      const b = generateBoxer(rng, league, { weightClass: wc, rating: targetRating(slot, rng) }, reg);
      league.boxers[b.id] = b;
      boxers.push(b);
    }

    // Classement initial : le meilleur score devient champion.
    const scored = boxers.map((b) => ({ b, score: initialRankScore(b, rng) }))
      .sort((x, y) => y.score - x.score);
    const champion = scored[0]!.b;
    const division = league.divisions[wc];
    division.championId = champion.id;
    division.rankings = scored.slice(1).map((x) => x.b.id);

    const defenses = rng.int(0, 4);
    division.titleHistory.push({
      boxerId: champion.id,
      wonOn: addDays(league.currentDate, -rng.int(90 + defenses * 120, 200 + defenses * 180)),
      defenses,
    });
    champion.stats.titleFights += defenses + 1;
    champion.stats.titleWins += 1;
    champion.stats.titleDefenses += defenses;
    champion.popularity = clamp(champion.popularity + 12, 0, 99);
  }

  return league;
}

/** Tous les boxeurs d'une division, dans l'ordre : champion, puis n°1, n°2… */
export function divisionOrder(league: League, wc: WeightClass): Boxer[] {
  const d = league.divisions[wc];
  const ids = d.championId ? [d.championId, ...d.rankings] : d.rankings;
  return ids.map((id) => league.boxers[id]!);
}

