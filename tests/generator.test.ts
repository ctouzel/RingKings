import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { divisionOrder, generateLeague } from '../src/gen/generator';
import { overallRating } from '../src/model/boxer';
import { ATTRIBUTE_KEYS, WEIGHT_CLASSES } from '../src/model/types';

describe('Rng', () => {
  it('est déterministe', () => {
    const a = new Rng(7), b = new Rng(7);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('int reste dans les bornes', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
    }
  });
});

describe('generateLeague', () => {
  const league = generateLeague({ seed: 2026 });
  const boxers = Object.values(league.boxers);

  it('génère 5 divisions de 15 boxeurs', () => {
    expect(boxers).toHaveLength(75);
    for (const wc of WEIGHT_CLASSES) {
      const d = league.divisions[wc];
      expect(d.championId).not.toBeNull();
      expect(d.rankings).toHaveLength(14);
      expect(divisionOrder(league, wc).every((b) => b.weightClass === wc)).toBe(true);
    }
  });

  it('est reproductible avec le même seed', () => {
    expect(generateLeague({ seed: 2026 })).toEqual(league);
    expect(generateLeague({ seed: 2027 })).not.toEqual(league);
  });

  it('produit des noms et surnoms uniques', () => {
    const names = boxers.map((b) => `${b.firstName} ${b.lastName}`);
    expect(new Set(names).size).toBe(names.length);
    const nicks = boxers.flatMap((b) => (b.nickname ? [b.nickname] : []));
    expect(new Set(nicks).size).toBe(nicks.length);
  });

  it('produit des attributs et palmarès cohérents', () => {
    for (const b of boxers) {
      for (const k of ATTRIBUTE_KEYS) {
        expect(b.attributes[k]).toBeGreaterThanOrEqual(20);
        expect(b.attributes[k]).toBeLessThanOrEqual(99);
      }
      const s = b.stats;
      expect(s.wins + s.losses + s.draws).toBe(s.fights);
      expect(s.koWins).toBeLessThanOrEqual(s.wins);
      expect(s.koLosses).toBeLessThanOrEqual(s.losses);
      expect(s.punchesLanded).toBeLessThanOrEqual(s.punchesThrown);
      expect(b.development.potential).toBeGreaterThanOrEqual(overallRating(b));
    }
  });

  it('favorise MX, US, GB et CA (≈ 55-65 %) tout en restant international', () => {
    // Moyenne sur plusieurs seeds pour lisser le hasard.
    let big = 0, total = 0;
    const countries = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const b of Object.values(generateLeague({ seed }).boxers)) {
        total++;
        countries.add(b.nationality);
        if (['MX', 'US', 'GB', 'CA'].includes(b.nationality)) big++;
      }
    }
    expect(big / total).toBeGreaterThan(0.5);
    expect(big / total).toBeLessThan(0.7);
    expect(countries.size).toBeGreaterThan(20);
  });

  it('le champion est parmi les meilleurs de sa division', () => {
    for (const wc of WEIGHT_CLASSES) {
      const order = divisionOrder(league, wc).map(overallRating);
      const sorted = [...order].sort((a, b) => b - a);
      expect(order[0]).toBeGreaterThanOrEqual(sorted[3]!);
    }
  });
});
