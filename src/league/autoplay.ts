/**
 * Simulation automatique de plusieurs saisons (galas automatiques toutes les
 * 4 semaines + repêchage automatique). Sert à l'équilibrage et aux tests.
 */
import { addDays } from '../core/date';
import { Rng } from '../core/rng';
import { generateLeague } from '../gen/generator';
import { ageOn, overallRating } from '../model/boxer';
import type { League } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { autoDraft } from './draft';
import { runEvent } from './events';
import { autoCard } from './matchmaking';

export function simulateSeasons(seed: number, seasons: number): { league: League; rows: string[] } {
  const l = generateLeague({ seed });
  const rng = new Rng(seed + 1);
  const rows: string[] = [];
  const snapshot = (label: string) => {
    const active = Object.values(l.boxers).filter((b) => b.status !== 'retired');
    const ovr = active.map((b) => overallRating(b));
    const avg = ovr.reduce((a, b) => a + b, 0) / ovr.length;
    const top = WEIGHT_CLASSES.map((wc) => {
      const d = l.divisions[wc];
      return d.championId ? overallRating(l.boxers[d.championId]!) : 0;
    });
    const big = active.filter((b) => ['MX', 'US', 'GB', 'CA'].includes(b.nationality)).length / active.length;
    const ages = active.map((b) => ageOn(b.birthDate, l.currentDate));
    const nats = new Set(active.map((b) => b.nationality)).size;
    const perDiv = WEIGHT_CLASSES.map((wc) => active.filter((b) => b.weightClass === wc).length).join('/');
    rows.push(`${label.padEnd(6)} actifs ${String(active.length).padStart(3)} (${perDiv}) note moy ${avg.toFixed(1)} min ${Math.min(...ovr)} max ${Math.max(...ovr)} champions ${top.join(',')} âge moy ${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)} 4 grands ${Math.round(big * 100)}% pays ${nats}`);
  };
  snapshot('début');
  const endYear = l.seasonYear + seasons;
  while (l.seasonYear < endYear || l.draft) {
    const ev = autoCard(l, rng, addDays(l.currentDate, 28));
    const before = l.seasons.length;
    try { runEvent(l, ev.id); } catch (e) {
      if (!l.draft) throw e;
      autoDraft(l);
      if (l.events[ev.id]!.fightIds.length) runEvent(l, ev.id);
    }
    if (l.seasons.length > before) snapshot(String(l.seasons[l.seasons.length - 1]!.year));
  }
  return { league: l, rows };
}
