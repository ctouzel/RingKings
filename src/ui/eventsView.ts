import { formatDate } from '../core/date';
import { replayFight } from '../league/events';
import { fullName } from '../model/boxer';
import { NATIONALITY_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Corner, Fight, FightId, League } from '../model/types';
import { commentary } from '../sim/commentary';
import { esc } from './dom';
import { renderResult } from './fightLab';

export interface EventsState {
  fightId: FightId | null;
}

function rankTag(r: number | null): string {
  return r === 0 ? '<span class="belt sm">C</span>' : r ? `<span class="muted">n°${r}</span>` : '';
}

function fightRow(league: League, f: Fight): string {
  const r = f.result;
  const side = (c: Corner) => {
    const b = league.boxers[f[c]]!;
    const win = r?.winner === c;
    return `<span class="${win ? 'winner' : r?.winner ? 'loser' : ''}">${NATIONALITY_INFO[b.nationality].flag} ${esc(fullName(b))} ${rankTag(f.rankAtFight[c])}</span>`;
  };
  return `<li class="fight-row ${f.isMainEvent ? 'main' : ''}" data-fight="${f.id}">
    <div class="fr-top">
      <span class="muted small">${WEIGHT_CLASS_INFO[f.weightClass].label} · ${f.scheduledRounds} rounds</span>
      ${f.isTitleFight ? '<span class="belt sm">TITRE</span>' : ''}${f.result?.titleChange ? '<span class="belt sm new">NOUVEAU CHAMPION</span>' : ''}
      ${f.isMainEvent ? '<span class="tag sm">COMBAT PRINCIPAL</span>' : ''}
    </div>
    <div class="fr-body">${side('red')} <span class="vs">vs</span> ${side('blue')}</div>
    ${r ? `<div class="fr-res">${esc(r.summary)}</div>` : ''}
  </li>`;
}

export function renderEvents(league: League, state: EventsState): string {
  if (state.fightId) {
    const f = league.fights[state.fightId]!;
    const red = league.boxers[f.red]!, blue = league.boxers[f.blue]!;
    const { events } = replayFight(league, f);
    const ev = league.events[f.eventId]!;
    return `
      <button class="btn ghost back" data-back>← Retour aux galas</button>
      <p class="muted">${esc(ev.name)} · ${esc(ev.venue)}, ${esc(ev.city)} · ${formatDate(ev.date)}</p>
      ${renderResult(f.result!, commentary(events, { red: fullName(red), blue: fullName(blue) }), red, blue)}`;
  }

  const done = Object.values(league.events).filter((e) => e.status === 'completed').reverse();
  const evHtml = done.length === 0
    ? '<p class="muted">Aucun gala disputé. Lance un gala rapide pour faire vivre la ligue.</p>'
    : done.slice(0, 12).map((e) => `
      <section class="panel pad event">
        <div class="ev-head"><div><div class="ev-name">${esc(e.name)}</div>
          <div class="muted small">${esc(e.venue)}, ${esc(e.city)} · ${formatDate(e.date)}</div></div></div>
        <ul class="fights">${[...e.fightIds].reverse().map((id) => fightRow(league, league.fights[id]!)).join('')}</ul>
      </section>`).join('');

  const news = [...league.news].reverse().slice(0, 30).map((n) => `
    <li class="news-${n.kind}"><span class="muted small">${formatDate(n.date)}</span>${esc(n.text)}</li>`).join('');

  return `
    <div class="events-bar">
      <button class="btn" id="quick-gala">Organiser un gala rapide</button>
      <span class="muted small">Le matchmaking automatique compose une carte cohérente (défenses obligatoires, titres vacants, aspirants), puis le gala est disputé.</span>
    </div>
    <div class="lab-grid">
      <div>${evHtml}</div>
      <section class="panel pad"><h3>Actualités</h3><ul class="news">${news || '<li class="muted">Rien pour l’instant.</li>'}</ul></section>
    </div>`;
}
