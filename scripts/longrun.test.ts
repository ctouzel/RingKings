/**
 * Équilibrage à long terme : affiche l'évolution de la ligue saison par saison.
 * SAISONS=10 SEED=314 npx vitest run scripts/longrun.test.ts
 */
import { it } from 'vitest';
import { simulateSeasons } from '../src/league/autoplay';
import { WEIGHT_CLASSES } from '../src/model/types';

if (process.env.SAISONS) it('longue durée', () => {
  const { league: l, rows } = simulateSeasons(Number(process.env.SEED ?? 314), Number(process.env.SAISONS ?? 10));
  rows.forEach((r) => console.log(r));
  for (const wc of WEIGHT_CLASSES) {
    const reigns = l.divisions[wc].titleHistory;
    const champs = new Set(reigns.map((r) => r.boxerId)).size;
    const longest = Math.max(...reigns.map((r) => r.defenses));
    console.log(`${wc.padEnd(17)} ${reigns.length} règnes, ${champs} champions différents, record de défenses ${longest}`);
  }
  const fights = Object.values(l.fights).filter((f) => f.result);
  const perBoxer = fights.length * 2 / Object.keys(l.boxers).length;
  console.log(`Combats: ${fights.length}, ~${perBoxer.toFixed(1)} par boxeur sur sa carrière dans la ligue`);
}, 600_000);
