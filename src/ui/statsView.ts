/**
 * Écran Statistiques : classements de records (carrière et ligue).
 */
import { formatDate } from '../core/date';
import { accuracyPct, ageOn, displayName, fullName, koPct, overallRating, recordString } from '../model/boxer';
import { NATIONALITY_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Boxer, Fight, League } from '../model/types';
import { esc } from './dom';
import type { App } from './state';

interface Board {
  title: string;
  hint: string;
  rows: { b: Boxer; value: string }[];
}

function top(league: League, filter: (b: Boxer) => boolean, score: (b: Boxer) => number, fmt: (b: Boxer) => string, n = 5) {
  return Object.values(league.boxers).filter((b) => b.status !== 'retired' && filter(b))
    .sort((x, y) => score(y) - score(x)).slice(0, n).map((b) => ({ b, value: fmt(b) }));
}

function boards(league: League): Board[] {
  const all = () => true;
  const s = (b: Boxer) => b.stats;
  return [
    { title: 'Plus de victoires', hint: 'carrière', rows: top(league, all, (b) => s(b).wins, (b) => recordString(s(b))) },
    { title: 'Plus de KO', hint: 'carrière', rows: top(league, all, (b) => s(b).koWins, (b) => `${s(b).koWins} KO`) },
    { title: 'Meilleur taux de KO', hint: 'min. 10 victoires', rows: top(league, (b) => s(b).wins >= 10, (b) => koPct(s(b)), (b) => `${koPct(s(b))} %`) },
    { title: 'Invaincus', hint: 'aucune défaite', rows: top(league, (b) => s(b).losses === 0 && s(b).wins > 0, (b) => s(b).wins, (b) => recordString(s(b))) },
    { title: 'Plus précis', hint: 'min. 50 rounds', rows: top(league, (b) => s(b).roundsFought >= 50, (b) => accuracyPct(s(b)), (b) => `${accuracyPct(s(b))} %`) },
    { title: 'Défenses de titre', hint: 'carrière', rows: top(league, (b) => s(b).titleDefenses > 0, (b) => s(b).titleDefenses, (b) => `${s(b).titleDefenses}`) },
    { title: 'Plus populaires', hint: 'attirent le public', rows: top(league, all, (b) => b.popularity, (b) => `${b.popularity}`) },
    { title: 'Meilleurs espoirs', hint: '24 ans et moins, par potentiel', rows: top(league, (b) => ageOn(b.birthDate, league.currentDate) <= 24, (b) => b.development.potential * 10 + overallRating(b) / 10, (b) => `pot. ${b.development.potential}`) },
    { title: 'Plus de knockdowns infligés', hint: 'carrière', rows: top(league, all, (b) => s(b).knockdownsScored, (b) => `${s(b).knockdownsScored}`) },
  ];
}

function leagueRecords(league: League): string {
  const fights = Object.values(league.fights).filter((f): f is Fight & { result: NonNullable<Fight['result']> } => !!f.result);
  if (fights.length === 0) return '<p class="muted small">Les records de la ligue apparaîtront après les premiers galas.</p>';
  const names = (f: Fight) => `${fullName(league.boxers[f.red]!)} vs ${fullName(league.boxers[f.blue]!)}`;
  const stopped = fights.filter((f) => f.result.method === 'KO' || f.result.method === 'TKO');
  const quickest = stopped.sort((a, b) => (a.result.endRound - 1) * 180 + a.result.endTimeSec - ((b.result.endRound - 1) * 180 + b.result.endTimeSec))[0];
  const busiest = [...fights].sort((a, b) => (b.result.stats.red.punchesThrown + b.result.stats.blue.punchesThrown) - (a.result.stats.red.punchesThrown + a.result.stats.blue.punchesThrown))[0]!;
  const mostKd = [...fights].sort((a, b) => (b.result.stats.red.knockdowns + b.result.stats.blue.knockdowns) - (a.result.stats.red.knockdowns + a.result.stats.blue.knockdowns))[0]!;
  const titleChanges = fights.filter((f) => f.result.titleChange).length;
  const decisions = fights.length - stopped.length;
  const item = (label: string, f: Fight | undefined, detail: string) => f ? `
    <li data-fight="${f.id}"><b>${label}</b><span>${esc(names(f))}</span><span class="muted small">${esc(detail)} · ${formatDate(f.date)}</span></li>` : '';
  return `
    <div class="facts wide">
      <div><b>${fights.length}</b><span>Combats</span></div>
      <div><b>${Math.round((stopped.length / fights.length) * 100)} %</b><span>Avant la limite</span></div>
      <div><b>${decisions}</b><span>Décisions</span></div>
      <div><b>${titleChanges}</b><span>Changements de titre</span></div>
    </div>
    <ul class="records">
      ${item('KO le plus rapide', quickest, quickest?.result.summary ?? '')}
      ${item('Plus gros volume', busiest, `${busiest.result.stats.red.punchesThrown + busiest.result.stats.blue.punchesThrown} coups lancés`)}
      ${item('Plus de knockdowns', mostKd, `${mostKd.result.stats.red.knockdowns + mostKd.result.stats.blue.knockdowns} knockdowns`)}
    </ul>`;
}

export function renderStats(app: App): string {
  const l = app.league;
  const cards = boards(l).map((bd) => `
    <section class="panel pad board">
      <h3>${bd.title} <span class="hint">${bd.hint}</span></h3>
      <ol>${bd.rows.map((r) => `<li data-boxer-modal="${r.b.id}">
        <span class="flag">${NATIONALITY_INFO[r.b.nationality].flag}</span>
        <span class="bn">${esc(displayName(r.b))}<span class="muted small"> · ${WEIGHT_CLASS_INFO[r.b.weightClass].label}</span></span>
        <span class="bv">${esc(r.value)}</span></li>`).join('') || '<li class="muted">—</li>'}</ol>
    </section>`).join('');
  return `
    <section class="panel pad"><h3>Records de la ligue</h3>${leagueRecords(l)}</section>
    <div class="boards">${cards}</div>`;
}
