/**
 * Pronostic d'un combat : on simule le combat un grand nombre de fois
 * (avec des seeds différents) et on compte les issues.
 * Le résultat réel reste incertain : c'est la "forme du soir" et le hasard du moteur.
 */
import type { BoxerId, League } from '../model/types';
import { simulateFight } from '../sim/engine';
import { fighterFromBoxer } from '../sim/fighter';

export interface Forecast {
  winA: number; // probabilité de victoire de A (0–1)
  winB: number;
  draw: number;
  koA: number; // probabilité que A gagne avant la limite
  koB: number;
}

const cache = new Map<string, Forecast>();

export function forecast(league: League, a: BoxerId, b: BoxerId, rounds: number, n = 300): Forecast {
  const A = league.boxers[a]!, B = league.boxers[b]!;
  // Clé de cache : les attributs peuvent évoluer (étape 7), on les inclut.
  const key = `${a}|${b}|${rounds}|${JSON.stringify(A.attributes)}|${JSON.stringify(B.attributes)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const fa = fighterFromBoxer(A), fb = fighterFromBoxer(B);
  const out = { winA: 0, winB: 0, draw: 0, koA: 0, koB: 0 };
  for (let i = 0; i < n; i++) {
    // On alterne les coins pour neutraliser tout biais rouge/bleu.
    const aRed = i % 2 === 0;
    const { result } = simulateFight({
      red: aRed ? fa : fb, blue: aRed ? fb : fa,
      rounds, weightClass: A.weightClass, seed: 0x9e3779b1 * (i + 1) >>> 0,
    });
    const ko = result.method === 'KO' || result.method === 'TKO';
    if (result.winner === null) out.draw++;
    else if ((result.winner === 'red') === aRed) { out.winA++; if (ko) out.koA++; }
    else { out.winB++; if (ko) out.koB++; }
  }
  const f: Forecast = { winA: out.winA / n, winB: out.winB / n, draw: out.draw / n, koA: out.koA / n, koB: out.koB / n };
  cache.set(key, f);
  return f;
}
