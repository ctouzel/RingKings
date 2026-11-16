import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { divisionOrder, generateLeague } from '../src/gen/generator';
import { advanceTo } from '../src/league/calendar';
import { autoPicks, completeDraft, validateDraft, ROSTER_SIZE } from '../src/league/draft';
import { ageOneYear } from '../src/league/season';
import { createEvent, bookFight, runEvent } from '../src/league/events';
import { deserializeLeague, serializeLeague } from '../src/model/league';
import { overallRating } from '../src/model/boxer';
import { WEIGHT_CLASSES } from '../src/model/types';

describe('vieillissement', () => {
  it('les jeunes progressent, les vétérans déclinent', () => {
    const l = generateLeague({ seed: 1 });
    const rng = new Rng(5);
    let young = 0, youngN = 0, old = 0, oldN = 0;
    for (const b of Object.values(l.boxers)) {
      const age = Number(l.currentDate.slice(0, 4)) - Number(b.birthDate.slice(0, 4));
      const copy = structuredClone(b);
      const { before, after } = ageOneYear(copy, '2026-12-31', rng);
      expect(after).toBeLessThanOrEqual(Math.max(copy.development.potential, before));
      if (age <= 23) { young += after - before; youngN++; }
      if (age >= 34) { old += after - before; oldN++; }
    }
    expect(young / youngN).toBeGreaterThan(0.5);
    expect(old / oldN).toBeLessThan(-0.5);
  });
});

describe('fin de saison et repêchage', () => {
  const l = generateLeague({ seed: 21 });
  advanceTo(l, '2027-01-15');
  const review = l.seasons[0]!;

  it('clôt la saison au passage du 31 décembre', () => {
    expect(l.seasonYear).toBe(2027);
    expect(review.year).toBe(2026);
    expect(review.progress.length + review.retirements.length).toBe(75);
    expect(l.currentDate).toBe('2027-01-15');
  });

  it('ouvre un repêchage qui comble les places libérées', () => {
    const d = l.draft!;
    expect(d.year).toBe(2027);
    for (const wc of WEIGHT_CLASSES) {
      const active = Object.values(l.boxers).filter((b) => b.weightClass === wc && b.status !== 'retired').length;
      expect(d.picks[wc]).toBe(Math.max(1, ROSTER_SIZE - active));
      expect(d.pool[wc].length).toBe(d.picks[wc] + 3);
      for (const p of d.pool[wc]) {
        expect(p.scoutLow).toBeLessThanOrEqual(p.scoutHigh);
        expect(l.boxers[p.boxer.id]).toBeUndefined(); // pas encore dans la ligue
      }
    }
  });

  it('bloque les galas tant que le repêchage n’est pas fait', () => {
    const ev = createEvent(l, { name: 'G', date: '2027-02-01', venue: 'V', city: 'C' });
    const h = divisionOrder(l, 'heavyweight');
    bookFight(l, ev.id, h[5]!.id, h[6]!.id);
    expect(() => runEvent(l, ev.id)).toThrow(/repêchage/);
  });

  it('valide la sélection et ajoute les espoirs à la ligue', () => {
    expect(validateDraft(l, [])).toMatch(/choisis/);
    const picks = autoPicks(l);
    const before = Object.keys(l.boxers).length;
    completeDraft(l, picks);
    expect(l.draft).toBeNull();
    expect(Object.keys(l.boxers).length).toBe(before + picks.length);
    for (const id of picks) {
      const b = l.boxers[id]!;
      expect(b.draftYear).toBe(2027);
      expect(b.development.potential).toBeGreaterThan(overallRating(b));
    }
    for (const wc of WEIGHT_CLASSES) {
      const active = Object.values(l.boxers).filter((b) => b.weightClass === wc && b.status !== 'retired').length;
      expect(active).toBeGreaterThanOrEqual(ROSTER_SIZE);
    }
    expect(review.drafted).toEqual(picks);
  });

  it('les retraités quittent le classement et perdent leur titre', () => {
    for (const r of review.retirements) {
      const b = l.boxers[r.boxerId]!;
      expect(b.status).toBe('retired');
      expect(l.divisions[b.weightClass].rankings).not.toContain(b.id);
      expect(l.divisions[b.weightClass].championId).not.toBe(b.id);
    }
  });
});

describe('migration de sauvegarde', () => {
  it('convertit une sauvegarde version 2', () => {
    const l = generateLeague({ seed: 3 });
    const v2 = JSON.parse(serializeLeague(l));
    v2.saveVersion = 2;
    delete v2.seasonYear; delete v2.seasons; delete v2.draft;
    const migrated = deserializeLeague(JSON.stringify(v2));
    expect(migrated.saveVersion).toBe(3);
    expect(migrated.seasonYear).toBe(2026);
    expect(migrated.seasons).toEqual([]);
    expect(migrated.draft).toBeNull();
  });
});
