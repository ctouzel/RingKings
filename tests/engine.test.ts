import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { divisionOrder, generateLeague } from '../src/gen/generator';
import type { Scorecard } from '../src/model/types';
import { simulateFight, type FightSetup } from '../src/sim/engine';
import { fighterFromBoxer } from '../src/sim/fighter';
import { decide } from '../src/sim/judges';

const league = generateLeague({ seed: 77 });
const heavies = divisionOrder(league, 'heavyweight');
const setup = (seed: number, rounds = 12): FightSetup => ({
  red: fighterFromBoxer(heavies[0]!), blue: fighterFromBoxer(heavies[1]!),
  rounds, weightClass: 'heavyweight', seed,
});

describe('simulateFight', () => {
  it('est déterministe (même seed => même combat)', () => {
    expect(simulateFight(setup(123))).toEqual(simulateFight(setup(123)));
  });

  it('produit un résultat cohérent', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { result, events } = simulateFight(setup(seed));
      expect(result.rounds.length).toBe(result.endRound);
      for (const c of ['red', 'blue'] as const) {
        const s = result.stats[c];
        expect(s.punchesLanded).toBeLessThanOrEqual(s.punchesThrown);
        expect(s.jabsThrown + s.powerPunchesThrown).toBe(s.punchesThrown);
        expect(s.jabsLanded + s.powerPunchesLanded).toBe(s.punchesLanded);
        const kdEvents = events.filter((e) => e.type === 'knockdown' && e.who !== c).length;
        expect(s.knockdowns).toBe(kdEvents);
      }
      if (result.method === 'KO' || result.method === 'TKO') {
        expect(events.some((e) => e.type === 'stoppage')).toBe(true);
        expect(result.winner).not.toBeNull();
      } else {
        expect(result.endRound).toBe(12);
        for (const card of result.scorecards) {
          expect(card.red).toHaveLength(12);
          for (let r = 0; r < 12; r++) {
            expect(Math.max(card.red[r]!, card.blue[r]!)).toBe(10);
            expect(Math.min(card.red[r]!, card.blue[r]!)).toBeGreaterThanOrEqual(6);
          }
        }
      }
    }
  });

  it('les événements sont chronologiques et chaque round commence par roundStart', () => {
    const { events } = simulateFight(setup(5));
    let last = 0;
    for (const e of events) {
      const key = e.round * 1000 + e.t;
      expect(key).toBeGreaterThanOrEqual(last);
      last = key;
    }
    expect(events[0]!.type).toBe('roundStart');
  });

  it('applique la règle des trois knockdowns', () => {
    // On cherche un combat où un boxeur va 3 fois au tapis dans le même round.
    const rng = new Rng(1);
    const weak = { ...fighterFromBoxer(heavies[14]!), attributes: { ...heavies[14]!.attributes, chin: 25, recovery: 99 } };
    const strong = { ...fighterFromBoxer(heavies[0]!), attributes: { ...heavies[0]!.attributes, power: 99 } };
    let found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const { result, events } = simulateFight({ red: strong, blue: weak, rounds: 12, weightClass: 'heavyweight', seed: rng.seed() });
      const stop = events.find((e) => e.type === 'stoppage');
      if (stop?.type === 'stoppage' && stop.reason === 'threeKnockdowns') {
        const kdsInRound = events.filter((e) => e.type === 'knockdown' && e.round === stop.round && e.who === 'blue').length;
        expect(kdsInRound).toBe(3);
        expect(result.method).toBe('TKO');
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('a des taux réalistes sur un échantillon de combats', () => {
    const rng = new Rng(2024);
    let stoppages = 0, favWins = 0, n = 0;
    for (const wc of ['lightweight', 'middleweight', 'heavyweight'] as const) {
      const order = divisionOrder(league, wc);
      for (let i = 0; i < 80; i++) {
        const a = rng.int(0, 13);
        const { result } = simulateFight({
          red: fighterFromBoxer(order[a]!), blue: fighterFromBoxer(order[a + 1]!),
          rounds: 10, weightClass: wc, seed: rng.seed(),
        });
        n++;
        if (result.method === 'KO' || result.method === 'TKO') stoppages++;
        if (result.winner === 'red') favWins++;
      }
    }
    expect(stoppages / n).toBeGreaterThan(0.35);
    expect(stoppages / n).toBeLessThan(0.8);
    expect(favWins / n).toBeGreaterThan(0.45); // le mieux classé gagne plus souvent…
    expect(favWins / n).toBeLessThan(0.85); // … mais les surprises existent
  });
});

describe('decide', () => {
  const card = (red: number, blue: number): Scorecard => ({ judge: 'J', red: [red], blue: [blue] });
  it('distingue unanime, partagée, majoritaire et nul', () => {
    expect(decide([card(10, 9), card(10, 9), card(10, 9)])).toEqual({ winner: 'red', method: 'UD' });
    expect(decide([card(10, 9), card(9, 10), card(10, 9)])).toEqual({ winner: 'red', method: 'SD' });
    expect(decide([card(9, 10), card(10, 10), card(9, 10)])).toEqual({ winner: 'blue', method: 'MD' });
    expect(decide([card(10, 9), card(9, 10), card(10, 10)])).toEqual({ winner: null, method: 'DRAW' });
    expect(decide([card(10, 10), card(10, 10), card(10, 9)])).toEqual({ winner: null, method: 'DRAW' });
  });
});
