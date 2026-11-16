import { describe, expect, it } from 'vitest';
import { simulateSeasons } from '../src/league/autoplay';
import { ageOn, overallRating } from '../src/model/boxer';
import { WEIGHT_CLASSES } from '../src/model/types';

// Garde-fou d'équilibrage : 4 saisons automatiques ne doivent pas dérégler la ligue.
describe('équilibre sur plusieurs saisons', () => {
  const { league: l } = simulateSeasons(2024, 4);
  const active = Object.values(l.boxers).filter((b) => b.status !== 'retired');

  it('garde des divisions pleines', () => {
    for (const wc of WEIGHT_CLASSES) {
      const n = active.filter((b) => b.weightClass === wc).length;
      expect(n).toBeGreaterThanOrEqual(15);
      expect(n).toBeLessThanOrEqual(18);
    }
  });

  it('garde un niveau et un âge moyens stables', () => {
    const avg = active.reduce((s, b) => s + overallRating(b), 0) / active.length;
    const age = active.reduce((s, b) => s + ageOn(b.birthDate, l.currentDate), 0) / active.length;
    expect(avg).toBeGreaterThan(64);
    expect(avg).toBeLessThan(75);
    expect(age).toBeGreaterThan(25);
    expect(age).toBeLessThan(31);
    expect(Math.max(...active.map(overallRating))).toBeLessThanOrEqual(93);
  });

  it('reste internationale', () => {
    expect(new Set(active.map((b) => b.nationality)).size).toBeGreaterThanOrEqual(14);
    const big = active.filter((b) => ['MX', 'US', 'GB', 'CA'].includes(b.nationality)).length / active.length;
    expect(big).toBeGreaterThan(0.45);
    expect(big).toBeLessThan(0.8);
  });
});
