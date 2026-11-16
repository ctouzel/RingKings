/**
 * Mesure la valeur réelle de chaque attribut dans le moteur, pour chaque style :
 * un boxeur "tout à 70" avec +10 dans un attribut affronte des boxeurs "tout à 70".
 * Sert à aligner la note globale (overallRating) sur le moteur.
 * Lancer avec : npx vitest run scripts/attr-value.test.ts
 * Options (variables d'environnement) : N=nb de combats par mesure,
 * SKIP_ATTR=1 (matrice seulement), WRITE=1 (enregistre les nouveaux poids).
 */
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import CURRENT from '../src/model/rating-weights.json';
import { Rng } from '../src/core/rng';
import type { Attributes, FightingStyle } from '../src/model/types';
import { ATTRIBUTE_KEYS, FIGHTING_STYLES } from '../src/model/types';
import { simulateFight, type Fighter } from '../src/sim/engine';
import { STYLE_MODS } from '../src/gen/generator';
import { overallRating } from '../src/model/boxer';

/** Profil type du style (attributs moyens d'un boxeur généré de niveau 70). */
const profile = (style: FightingStyle): Attributes => {
  const a = base();
  for (const k of ATTRIBUTE_KEYS) a[k] += STYLE_MODS[style][k] ?? 0;
  // Recentrage sur une note globale de 70, comme le fait le générateur.
  for (let i = 0; i < 3; i++) {
    const diff = 70 - overallRating({ attributes: a, style });
    for (const k of ATTRIBUTE_KEYS) a[k] += diff;
  }
  return a;
};

const N = Number(process.env.N ?? 120);
const base = (): Attributes => ({ power: 70, handSpeed: 70, accuracy: 70, defense: 70, footwork: 70, chin: 70, stamina: 70, recovery: 70, ringIQ: 70 });
const mk = (style: FightingStyle, attributes: Attributes): Fighter => ({ name: style, attributes, style, stance: 'orthodox', reachCm: 183 });

function winRate(a: Fighter, opp: FightingStyle, rng: Rng): number {
  let pts = 0;
  for (let i = 0; i < N; i++) {
    const red = i % 2 === 0;
    const o = mk(opp, process.env.FLAT ? base() : profile(opp));
    const { result } = simulateFight({ red: red ? a : o, blue: red ? o : a, rounds: 10, weightClass: 'middleweight', seed: rng.seed() });
    if (result.winner === null) pts += 0.5;
    else if ((result.winner === 'red') === red) pts += 1;
  }
  return pts / N;
}

it('valeur des attributs et matrice des styles', () => {
  const rng = new Rng(1);
  console.log('Matrice styles (profils types, niveau 70), % victoires ligne vs colonne :');
  for (const s of FIGHTING_STYLES) {
    const row = FIGHTING_STYLES.map((o) => String(Math.round(winRate(mk(s, process.env.FLAT ? base() : profile(s)), o, rng) * 100)).padStart(5));
    console.log(s.padEnd(15), row.join(''));
  }
  if (process.env.SKIP_ATTR) return;
  const measured: Record<string, Record<string, number>> = {};
  console.log('\nGain de % de victoires pour +10 dans un attribut (moyenne contre tous les styles) :');
  console.log(''.padEnd(15), ATTRIBUTE_KEYS.map((k) => k.slice(0, 7).padStart(8)).join(''));
  for (const s of FIGHTING_STYLES) {
    const start = () => (process.env.FLAT ? base() : profile(s));
    const ref = FIGHTING_STYLES.reduce((acc, o) => acc + winRate(mk(s, start()), o, rng), 0) / 5;
    const gains = ATTRIBUTE_KEYS.map((k) => {
      const at = start(); at[k] += 10;
      const wr = FIGHTING_STYLES.reduce((acc, o) => acc + winRate(mk(s, at), o, rng), 0) / 5;
      return wr - ref;
    });
    console.log(s.padEnd(15), gains.map((g) => (g * 100).toFixed(1).padStart(8)).join(''));
    const pos = gains.map((g) => Math.max(0.01, g));
    const tot = pos.reduce((a, b) => a + b, 0);
    measured[s] = Object.fromEntries(ATTRIBUTE_KEYS.map((k, i) => [k, Math.round((pos[i]! / tot) * 1000) / 1000]));
    // Lissage : moyenne avec les poids actuels pour converger sans osciller.
    const prev = (CURRENT as Record<string, Record<string, number>>)[s]!;
    for (const k of ATTRIBUTE_KEYS) measured[s]![k] = Math.round(((measured[s]![k]! + prev[k]!) / 2) * 1000) / 1000;
  }
  console.log('\nPoids mesurés (lissés) :', JSON.stringify(measured));
  if (process.env.WRITE) {
    writeFileSync(new URL('../src/model/rating-weights.json', import.meta.url), JSON.stringify(measured, null, 2) + '\n');
    console.log('→ src/model/rating-weights.json mis à jour');
  }
}, 900_000);
