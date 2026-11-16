/**
 * Ajuste automatiquement l'efficacité (rangeSkill) de chaque style pour que
 * chaque style gagne ≈ 50 % en moyenne contre les autres, à note égale.
 * Affiche les valeurs à reporter dans STYLE_PROFILES (src/sim/engine.ts).
 * Lancer avec : npx vitest run scripts/style-tuner.test.ts
 */
import { it } from 'vitest';
import { Rng } from '../src/core/rng';
import { STYLE_MODS } from '../src/gen/generator';
import { overallRating } from '../src/model/boxer';
import { ATTRIBUTE_KEYS, FIGHTING_STYLES, type Attributes, type FightingStyle } from '../src/model/types';
import { STYLE_PROFILES, simulateFight, type Fighter } from '../src/sim/engine';

const profile = (style: FightingStyle): Attributes => {
  const a = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 70 + (STYLE_MODS[style][k] ?? 0)])) as unknown as Attributes;
  for (let i = 0; i < 3; i++) { const d = 70 - overallRating({ attributes: a, style }); for (const k of ATTRIBUTE_KEYS) a[k] += d; }
  return a;
};
const mk = (s: FightingStyle): Fighter => ({ name: s, attributes: profile(s), style: s, stance: 'orthodox', reachCm: 183 });

function matrix(rng: Rng, n: number): number[][] {
  return FIGHTING_STYLES.map((s) => FIGHTING_STYLES.map((o) => {
    let pts = 0;
    for (let i = 0; i < n; i++) {
      const red = i % 2 === 0;
      const { result } = simulateFight({ red: red ? mk(s) : mk(o), blue: red ? mk(o) : mk(s), rounds: 10, weightClass: 'middleweight', seed: rng.seed() });
      pts += result.winner === null ? 0.5 : (result.winner === 'red') === red ? 1 : 0;
    }
    return pts / n;
  }));
}

it('style tuner', () => {
  const rng = new Rng(11);
  const iters = Number(process.env.ITERS ?? 6), n = Number(process.env.N ?? 150);
  for (let it = 0; it < iters; it++) {
    const m = matrix(rng, n);
    const avgs = m.map((row, i) => row.filter((_, j) => j !== i).reduce((a, b) => a + b, 0) / 4);
    console.log(`iter ${it}:`, FIGHTING_STYLES.map((s, i) => `${s} ${Math.round(avgs[i]! * 100)}%`).join(' | '));
    const step = Number(process.env.STEP ?? 0.05);
    const fs = FIGHTING_STYLES.map((_, i) => Math.pow(0.5 / avgs[i]!, step));
    const mean = fs.reduce((a, b) => a + b, 0) / fs.length;
    FIGHTING_STYLES.forEach((s, i) => {
      const f = fs[i]! / mean; // renormalisé : le niveau moyen ne dérive pas
      const rs = STYLE_PROFILES[s].rangeSkill;
      rs.long = Math.round(rs.long * f * 1000) / 1000;
      rs.inside = Math.round(rs.inside * f * 1000) / 1000;
    });
  }
  const m = matrix(rng, n * 2);
  console.log('Matrice finale (ligne bat colonne) :');
  FIGHTING_STYLES.forEach((s, i) => console.log(s.padEnd(15), m[i]!.map((v) => String(Math.round(v * 100)).padStart(5)).join('')));
  console.log('rangeSkill à reporter :');
  for (const s of FIGHTING_STYLES) console.log(`  ${s}: { long: ${STYLE_PROFILES[s].rangeSkill.long}, inside: ${STYLE_PROFILES[s].rangeSkill.inside} }`);
}, 900_000);
