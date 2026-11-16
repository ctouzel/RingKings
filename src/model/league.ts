import type { BoxerId, Division, EventId, FightId, IsoDate, League, WeightClass } from './types';
import { WEIGHT_CLASSES } from './types';

export const SAVE_VERSION = 3;

/** Crée une ligue vide (le générateur de l'étape 2 la remplira). */
export function createEmptyLeague(name: string, startDate: IsoDate, seed: number): League {
  const divisions = {} as Record<WeightClass, Division>;
  for (const wc of WEIGHT_CLASSES) {
    divisions[wc] = { weightClass: wc, championId: null, rankings: [], titleHistory: [], mandatoryDue: null };
  }
  return {
    saveVersion: SAVE_VERSION,
    name,
    currentDate: startDate,
    startDate,
    seed,
    nextIds: { boxer: 1, fight: 1, event: 1 },
    boxers: {},
    fights: {},
    events: {},
    divisions,
    money: 250_000,
    news: [],
    seasonYear: Number(startDate.slice(0, 4)),
    seasons: [],
    draft: null,
  };
}

const pad = (n: number) => String(n).padStart(4, '0');

/** Génère les identifiants uniques en incrémentant les compteurs de la ligue. */
export function nextBoxerId(l: League): BoxerId { return `bx_${pad(l.nextIds.boxer++)}`; }
export function nextFightId(l: League): FightId { return `ft_${pad(l.nextIds.fight++)}`; }
export function nextEventId(l: League): EventId { return `ev_${pad(l.nextIds.event++)}`; }

/** Sérialisation pour sauvegarde (localStorage / fichier). */
export function serializeLeague(l: League): string {
  return JSON.stringify(l);
}

export function deserializeLeague(json: string): League {
  const data = JSON.parse(json) as League;
  // Migrations : chaque étape fait passer une sauvegarde à la version suivante.
  if (data.saveVersion === 2) {
    data.seasonYear = Number(data.currentDate.slice(0, 4));
    data.seasons = [];
    data.draft = null;
    data.saveVersion = 3;
  }
  if (data.saveVersion !== SAVE_VERSION) {
    throw new Error(`Version de sauvegarde non supportée : ${data.saveVersion}`);
  }
  return data;
}
