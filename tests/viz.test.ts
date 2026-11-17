import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { divisionOrder, generateLeague } from '../src/gen/generator';
import { simulateFight } from '../src/sim/engine';
import { fighterFromBoxer } from '../src/sim/fighter';
import { frameAt } from '../src/viz/frame';
import { POSES } from '../src/viz/poses';
import { addResult, buildTimeline, TIMING } from '../src/viz/timeline';

const league = generateLeague({ seed: 8 });
const names = { red: 'Rouge', blue: 'Bleu' };
const fights = (() => {
  const rng = new Rng(3);
  const order = divisionOrder(league, 'heavyweight');
  return Array.from({ length: 30 }, () => {
    const i = rng.int(0, 13);
    return simulateFight({ red: fighterFromBoxer(order[i]!), blue: fighterFromBoxer(order[i + 1]!), rounds: 12, weightClass: 'heavyweight', seed: rng.seed() });
  });
})();

describe('timeline', () => {
  it('mode résumé : 15 à 40 s par round, temps forts conservés', () => {
    for (const { events, result } of fights) {
      const tl = buildTimeline(events, names, 'summary');
      const perRound = tl.duration / result.endRound;
      expect(perRound).toBeGreaterThan(12);
      expect(perRound).toBeLessThan(40);
      const kds = events.filter((e) => e.type === 'knockdown').length;
      expect(tl.beats.filter((b) => b.kind === 'knockdown').length).toBe(kds);
      expect(tl.beats.some((b) => b.kind === 'stoppage')).toBe(events.some((e) => e.type === 'stoppage'));
      expect(tl.roundStarts).toHaveLength(result.endRound);
    }
  });

  it('mode complet : au moins 3 minutes par round disputé', () => {
    const { events, result } = fights.find((f) => f.result.endRound === 12)!;
    const tl = buildTimeline(events, names, 'full');
    expect(tl.duration).toBeGreaterThanOrEqual(12 * 180);
    expect(tl.beats.filter((b) => b.kind === 'punch').length).toBe(result.stats.red.punchesThrown + result.stats.blue.punchesThrown);
  });

  it('les beats sont triés dans le temps et le résultat est à la fin', () => {
    for (const { events, result } of fights.slice(0, 10)) {
      for (const mode of ['summary', 'full'] as const) {
        const tl = addResult(buildTimeline(events, names, mode), result.winner, result.summary, 'X');
        for (let i = 1; i < tl.beats.length; i++) expect(tl.beats[i]!.at).toBeGreaterThanOrEqual(tl.beats[i - 1]!.at);
        expect(tl.beats.at(-1)!.kind).toBe('result');
        expect(tl.duration).toBeCloseTo(tl.beats.at(-1)!.at + TIMING.result, 5);
      }
    }
  });

  it('n’annonce pas la fin du compte avant la fin du compte', () => {
    const f = fights.find((x) => x.events.some((e) => e.type === 'knockdown'))!;
    const tl = buildTimeline(f.events, names, 'summary');
    const kd = tl.beats.find((b) => b.kind === 'knockdown')!;
    expect(kd.text).toMatch(/au tapis/);
    const note = tl.beats.find((b) => b.kind === 'note')!;
    expect(note.at).toBeGreaterThan(kd.at + TIMING.fall);
  });
});

describe('frameAt', () => {
  it('produit un état valide à tout instant', () => {
    for (const { events, result } of fights.slice(0, 8)) {
      const tl = addResult(buildTimeline(events, names, 'summary'), result.winner, result.summary, 'X');
      for (let t = 0; t <= tl.duration; t += 0.37) {
        const fr = frameAt(tl, t, names);
        for (const c of ['red', 'blue'] as const) {
          expect(fr.hp[c]).toBeGreaterThanOrEqual(0);
          expect(fr.hp[c]).toBeLessThanOrEqual(100);
          expect(fr[c].x).toBeGreaterThan(0);
          expect(fr[c].x).toBeLessThan(256);
        }
        expect(fr.round).toBeGreaterThanOrEqual(1);
        expect(fr.clock).toBeGreaterThanOrEqual(0);
        expect(fr.clock).toBeLessThanOrEqual(180);
      }
      const end = frameAt(tl, tl.duration, names);
      expect(end.finished).toBe(true);
      if (result.winner) expect(end[result.winner].pose).toEqual(POSES.victory);
    }
  });

  it('le boxeur mis KO finit au sol avec une barre vide', () => {
    const ko = fights.find((f) => f.result.method === 'KO');
    if (!ko) return;
    const tl = addResult(buildTimeline(ko.events, names, 'summary'), ko.result.winner, ko.result.summary, 'X');
    const loser = ko.result.winner === 'red' ? 'blue' : 'red';
    const end = frameAt(tl, tl.duration, names);
    expect(end[loser].pose).toBe(POSES.down);
    expect(end.hp[loser]).toBe(0);
  });
});
