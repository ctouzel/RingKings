import { describe, expect, it } from 'vitest';
import { ageOn, displayName, emptyCareerStats, koPct, overallRating, recordString } from '../src/model/boxer';
import { createEmptyLeague, deserializeLeague, nextBoxerId, serializeLeague } from '../src/model/league';
import { WEIGHT_CLASSES } from '../src/model/types';

describe('boxer helpers', () => {
  it('calcule l’âge en tenant compte de l’anniversaire', () => {
    expect(ageOn('2000-06-15', '2026-06-14')).toBe(25);
    expect(ageOn('2000-06-15', '2026-06-15')).toBe(26);
  });

  it('formate le palmarès', () => {
    const s = { ...emptyCareerStats(), wins: 24, losses: 3, draws: 1, koWins: 18 };
    expect(recordString(s)).toBe('24-3-1 (18 KO)');
    expect(koPct(s)).toBe(75);
  });

  it('affiche le surnom', () => {
    expect(displayName({ firstName: 'A', lastName: 'B', nickname: 'C' })).toBe('A "C" B');
    expect(displayName({ firstName: 'A', lastName: 'B' })).toBe('A B');
  });

  it('note globale = moyenne quand tous les attributs sont égaux', () => {
    const attributes = { power: 70, handSpeed: 70, accuracy: 70, defense: 70, footwork: 70, chin: 70, stamina: 70, recovery: 70, ringIQ: 70 };
    for (const style of ['slugger', 'outBoxer', 'counterPuncher', 'swarmer', 'boxerPuncher'] as const) {
      expect(overallRating({ attributes, style })).toBe(70);
    }
  });
});

describe('league', () => {
  it('crée une division par catégorie et des ids uniques', () => {
    const l = createEmptyLeague('Test', '2026-01-01', 42);
    expect(Object.keys(l.divisions)).toEqual([...WEIGHT_CLASSES]);
    expect(nextBoxerId(l)).toBe('bx_0001');
    expect(nextBoxerId(l)).toBe('bx_0002');
  });

  it('sauvegarde et recharge sans perte', () => {
    const l = createEmptyLeague('Test', '2026-01-01', 42);
    expect(deserializeLeague(serializeLeague(l))).toEqual(l);
  });
});
