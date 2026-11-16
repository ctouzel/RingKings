/** Aperçu d'une ligue après N galas automatiques. GALAS=39 npx vitest run scripts/season.test.ts */
import { it } from 'vitest';
import { addDays } from '../src/core/date';
import { Rng } from '../src/core/rng';
import { generateLeague } from '../src/gen/generator';
import { runEvent } from '../src/league/events';
import { autoCard } from '../src/league/matchmaking';
import { autoDraft } from '../src/league/draft';
import { rankingPoints } from '../src/league/ranking';
import { fullName, recordString } from '../src/model/boxer';
import { WEIGHT_CLASSES } from '../src/model/types';

it('saison', () => {
  const l = generateLeague({ seed: 314 });
  const rng = new Rng(2026);
  for (let i = 0; i < Number(process.env.GALAS ?? 39); i++) {
    const id = autoCard(l, rng, addDays(l.currentDate, 28)).id;
    try { runEvent(l, id); } catch (e) {
      if (!l.draft) throw e;
      autoDraft(l);
      if (l.events[id]!.fightIds.length) runEvent(l, id);
    }
  }
  for (const s of l.seasons) {
    console.log(`\n### Saison ${s.year} — ${s.retirements.length} retraites, ${s.drafted.length} repêchés`);
    for (const a of Object.values(s.awards)) console.log('  🏆', a!.text);
    const ups = [...s.progress].sort((a, b) => (b.after - b.before) - (a.after - a.before));
    console.log('  Progression max:', ups.slice(0, 3).map((p) => `${l.boxers[p.boxerId]!.lastName} ${p.before}→${p.after}`).join(', '));
    console.log('  Déclin max:', ups.slice(-3).map((p) => `${l.boxers[p.boxerId]!.lastName} ${p.before}→${p.after}`).join(', '));
    console.log('  Retraites:', s.retirements.map((r) => `${l.boxers[r.boxerId]!.lastName} (${r.age} ans, ${r.reason})`).join(', '));
  }
  console.log('Date:', l.currentDate, '| combats:', Object.values(l.fights).length);
  const kinds: Record<string, number> = {};
  for (const n of l.news) kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
  console.log('Actualités:', kinds);
  for (const wc of WEIGHT_CLASSES) {
    const d = l.divisions[wc];
    console.log(`\n== ${wc} — ${d.titleHistory.length} règnes, échéance ${d.mandatoryDue}`);
    const champ = d.championId ? l.boxers[d.championId]! : null;
    console.log(' C ', champ ? `${fullName(champ)} ${recordString(champ.stats)}` : '(vacant)');
    d.rankings.slice(0, 5).forEach((id, i) => { const b = l.boxers[id]!; console.log(`${String(i + 1).padStart(2)}  ${fullName(b).padEnd(28)} ${recordString(b.stats).padEnd(18)} ${rankingPoints(l, b)} pts, ${b.fightIds.length} combats ligue`); });
  }
  console.log('\nDernières actualités:'); l.news.slice(-8).forEach((n) => console.log(' ', n.date, n.text));
});
