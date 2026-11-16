/**
 * Calibration du moteur : simule des milliers de combats et affiche les
 * statistiques globales. Lancer avec : npm run calibrate
 */
import { it } from 'vitest';
import { Rng } from '../src/core/rng';
import { divisionOrder, generateLeague } from '../src/gen/generator';
import { overallRating } from '../src/model/boxer';
import { WEIGHT_CLASSES, type WeightClass } from '../src/model/types';
import { simulateFight, TUNING } from '../src/sim/engine';
import { fighterFromBoxer } from '../src/sim/fighter';
import { STYLE_INFO } from '../src/model/labels';

it('calibration', () => {
  // Permet de tester des réglages : TUNING_JSON='{"stunScale":1.2}' npm run calibrate
  if (process.env.TUNING_JSON) Object.assign(TUNING, JSON.parse(process.env.TUNING_JSON));
  const rng = new Rng(99);
  const byClass: Record<string, Record<string, number>> = {};
  let dmgSum = 0;
  const reasons: Record<string, number> = {};
  let fights = 0, thrown = 0, landed = 0, rounds = 0, kds = 0, favWins = 0, favFights = 0;
  const gapBuckets: Record<string, [number, number]> = {};
  const styleVs: Record<string, [number, number]> = {};

  for (let seed = 1; seed <= Number(process.env.SEEDS ?? 40); seed++) {
    const league = generateLeague({ seed });
    for (const wc of WEIGHT_CLASSES) {
      const order = divisionOrder(league, wc);
      for (let k = 0; k < 25; k++) {
        // Combats réalistes : boxeurs proches au classement.
        const i = rng.int(0, order.length - 1);
        const j = Math.min(order.length - 1, Math.max(0, i + rng.int(-4, 4)));
        if (i === j) continue;
        const a = order[i]!, b = order[j]!;
        const sched = i < 6 || j < 6 ? 12 : 10;
        const { result, events } = simulateFight({ red: fighterFromBoxer(a), blue: fighterFromBoxer(b), rounds: sched, weightClass: wc as WeightClass, seed: rng.seed() });
        fights++;
        for (const e of events) if (e.type === 'stoppage') reasons[e.reason] = (reasons[e.reason] ?? 0) + 1;
        const cls = (byClass[wc] ??= {});
        cls[result.method] = (cls[result.method] ?? 0) + 1;
        for (const c of ['red', 'blue'] as const) {
          thrown += result.stats[c].punchesThrown; landed += result.stats[c].punchesLanded;
          kds += result.stats[c].knockdowns;
        }
        rounds += result.rounds.length;
        dmgSum += result.damage.red + result.damage.blue;
        const ra = overallRating(a), rb = overallRating(b);
        if (ra !== rb && result.winner) {
          favFights++;
          const favWon = (ra > rb) === (result.winner === 'red');
          if (favWon) favWins++;
          const gap = Math.abs(ra - rb);
          const key = gap <= 2 ? '1-2' : gap <= 5 ? '3-5' : gap <= 10 ? '6-10' : '11+';
          const bk = (gapBuckets[key] ??= [0, 0]); bk[1]++; if (favWon) bk[0]++;
        }
        if (result.winner && a.style !== b.style && Math.abs(ra - rb) <= 3) {
          const w = result.winner === 'red' ? a : b, l = result.winner === 'red' ? b : a;
          const key = [w.style, l.style].sort().join(' vs ');
          const sv = (styleVs[key] ??= [0, 0]);
          sv[1]++; if (w.style === key.split(' vs ')[0]) sv[0]++;
        }
      }
    }
  }
  const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`;
  console.log(`Combats: ${fights}`);
  for (const [wc, m] of Object.entries(byClass)) {
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    const stop = (m.KO ?? 0) + (m.TKO ?? 0);
    console.log(wc.padEnd(18), 'arrêts', pct(stop, tot), '| KO', pct(m.KO ?? 0, tot), 'TKO', pct(m.TKO ?? 0, tot), 'UD', pct(m.UD ?? 0, tot), 'SD', pct(m.SD ?? 0, tot), 'MD', pct(m.MD ?? 0, tot), 'NUL', pct(m.DRAW ?? 0, tot));
  }
  console.log(`Coups lancés / round / boxeur: ${(thrown / rounds / 2).toFixed(1)}  précision: ${pct(landed, thrown)}  knockdowns/combat: ${(kds / fights).toFixed(2)}  dégâts moyens: ${(dmgSum / fights / 2).toFixed(0)}`);
  console.log('Raisons des arrêts:', JSON.stringify(reasons));
  console.log(`Favori gagne: ${pct(favWins, favFights)}`, Object.entries(gapBuckets).map(([k, [w, n]]) => `écart ${k}: ${pct(w, n)} (${n})`).join(' | '));
  for (const [k, [w, n]] of Object.entries(styleVs)) {
    const [s1, s2] = k.split(' vs ') as [keyof typeof STYLE_INFO, keyof typeof STYLE_INFO];
    console.log(`  ${STYLE_INFO[s1].label} bat ${STYLE_INFO[s2].label}: ${pct(w, n)} (${n})`);
  }
});
