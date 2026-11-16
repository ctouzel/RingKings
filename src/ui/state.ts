/**
 * État de l'interface : la ligue + ce que l'utilisateur regarde.
 * Chaque écran a son propre sous-état. Après chaque action, main.ts ré-affiche tout.
 */
import { generateLeague } from '../gen/generator';
import { deserializeLeague, serializeLeague } from '../model/league';
import type { BoxerId, EventId, FightId, League, WeightClass } from '../model/types';
import { defaultLab, type LabState } from './fightLab';

export type Screen = 'rankings' | 'boxers' | 'events' | 'stats' | 'lab';

export interface Builder {
  division: WeightClass;
  a: BoxerId | null;
  b: BoxerId | null;
  rounds: 4 | 6 | 8 | 10 | 12;
  title: boolean;
}

export interface App {
  league: League;
  screen: Screen;
  rankings: { division: WeightClass; selected: BoxerId | null };
  boxers: { search: string; division: WeightClass | ''; style: string; nationality: string; availableOnly: boolean; sort: string; desc: boolean };
  events: { fightId: FightId | null; openEvent: EventId | null; builder: Builder; newForm: boolean };
  lab: LabState;
  /** Fiche boxeur ouverte en fenêtre (écrans Boxeurs et Statistiques). */
  modalBoxer: BoxerId | null;
  /** Message temporaire (succès / erreur). */
  flash: { kind: 'ok' | 'err'; text: string } | null;
}

const SAVE_KEY = 'ringkings.save';

export function newLeague(): League {
  return generateLeague({ seed: Math.floor(Math.random() * 1_000_000) });
}

export function loadLeague(): League {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) return deserializeLeague(saved);
  } catch {
    // Sauvegarde absente, illisible ou d'une ancienne version : nouvelle ligue.
  }
  return newLeague();
}

export function save(app: App): void {
  try { localStorage.setItem(SAVE_KEY, serializeLeague(app.league)); } catch { /* stockage indisponible */ }
}

export function emptyBuilder(division: WeightClass = 'heavyweight'): Builder {
  return { division, a: null, b: null, rounds: 10, title: false };
}

export function createApp(league: League): App {
  return {
    league,
    screen: 'rankings',
    rankings: { division: 'heavyweight', selected: null },
    boxers: { search: '', division: '', style: '', nationality: '', availableOnly: false, sort: 'rating', desc: true },
    events: { fightId: null, openEvent: null, builder: emptyBuilder(), newForm: false },
    lab: defaultLab(league),
    modalBoxer: null,
    flash: null,
  };
}
