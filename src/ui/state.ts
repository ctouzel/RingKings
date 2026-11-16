/**
 * État de l'interface : la ligue + ce que l'utilisateur regarde.
 * Chaque écran a son propre sous-état. Après chaque action, main.ts ré-affiche tout.
 */
import { generateLeague } from '../gen/generator';
import type { BoxerId, EventId, FightId, League, WeightClass } from '../model/types';
import { defaultLab, type LabState } from './fightLab';
import type { EditorState } from './editorView';
import { activeSlot, saveSlot, type Slot, type SlotMeta } from './storage';

export type Screen = 'home' | 'rankings' | 'boxers' | 'events' | 'season' | 'stats' | 'lab';

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
  boxers: { search: string; division: WeightClass | ''; style: string; nationality: string; availableOnly: boolean; retired: boolean; sort: string; desc: boolean };
  season: { year: number | null; selected: BoxerId[] };
  events: { fightId: FightId | null; openEvent: EventId | null; builder: Builder; newForm: boolean };
  lab: LabState;
  /** Fiche boxeur ouverte en fenêtre (écrans Boxeurs et Statistiques). */
  modalBoxer: BoxerId | null;
  /** Message temporaire (succès / erreur). */
  flash: { kind: 'ok' | 'err'; text: string } | null;
  /** Emplacement de sauvegarde de la partie en cours. */
  slot: Slot;
  /** Éditeur d'apparence ouvert. */
  editor: EditorState | null;
  /** Fenêtre « Partie » (sauvegardes) : null = fermée. */
  saves: { metas: (SlotMeta | null)[] } | null;
}

export function newLeague(name?: string, seed?: number): League {
  return generateLeague({ seed: seed ?? Math.floor(Math.random() * 1_000_000), name: name || undefined });
}

/** Sauvegarde automatique dans l'emplacement actif (après chaque action). */
let pending: Promise<void> = Promise.resolve();
export function save(app: App): void {
  const league = app.league, slot = app.slot;
  // Les écritures s'enchaînent pour ne jamais se croiser.
  pending = pending.then(() => saveSlot(slot, league)).catch((e) => {
    console.error('Sauvegarde impossible', e);
  });
}

export function emptyBuilder(division: WeightClass = 'heavyweight'): Builder {
  return { division, a: null, b: null, rounds: 10, title: false };
}

export function createApp(league: League, slot: Slot = activeSlot()): App {
  return {
    slot,
    saves: null,
    editor: null,
    league,
    screen: 'home',
    rankings: { division: 'heavyweight', selected: null },
    boxers: { search: '', division: '', style: '', nationality: '', availableOnly: false, retired: false, sort: 'rating', desc: true },
    season: { year: null, selected: [] },
    events: { fightId: null, openEvent: null, builder: emptyBuilder(), newForm: false },
    lab: defaultLab(league),
    modalBoxer: null,
    flash: null,
  };
}
