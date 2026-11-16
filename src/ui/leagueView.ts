import { daysBetween, formatDate } from '../core/date';
import { divisionOrder } from '../gen/generator';
import { mandatoryBooked } from '../league/calendar';
import { RANKED_SPOTS, rankingPoints } from '../league/ranking';
import { ageOn, displayName, fullName, isAvailable, overallRating, recordString } from '../model/boxer';
import { NATIONALITY_INFO, STYLE_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { BoxerId, League, WeightClass } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { boxerCard } from './boxerCard';
import { esc } from './dom';

export interface ViewState {
  division: WeightClass;
  selected: BoxerId | null;
}

function divisionPanel(league: League, wc: WeightClass): string {
  const d = league.divisions[wc];
  const champ = d.championId ? league.boxers[d.championId]! : null;
  const reign = d.titleHistory[d.titleHistory.length - 1];
  let mandatory = '';
  if (champ && d.mandatoryDue) {
    const n1 = d.rankings[0] ? league.boxers[d.rankings[0]]! : null;
    const days = daysBetween(league.currentDate, d.mandatoryDue);
    const booked = mandatoryBooked(league, wc);
    const cls = booked ? 'ok' : days < 90 ? 'warn' : '';
    mandatory = `<div class="mandatory ${cls}">Défense obligatoire contre ${n1 ? esc(fullName(n1)) : 'le n°1'}
      avant le <b>${formatDate(d.mandatoryDue)}</b> ${booked ? '· programmée ✓' : `· dans ${days} jours`}</div>`;
  }
  const past = d.titleHistory.slice(0, -1).reverse().slice(0, 4).map((r) => {
    const b = league.boxers[r.boxerId]!;
    const end = r.endedBy === 'vacated' ? 'vacant' : r.endedBy === 'defeat' ? 'battu' : '';
    return `<li>${esc(fullName(b))} <span class="muted">${formatDate(r.wonOn)} → ${r.lostOn ? formatDate(r.lostOn) : ''} · ${r.defenses} déf. ${end ? `· ${end}` : ''}</span></li>`;
  }).join('');
  return `
    <section class="panel pad division-panel">
      <div class="belt-title pixel">${champ ? 'CHAMPION' : 'TITRE VACANT'}</div>
      ${champ ? `<div class="champ-name">${NATIONALITY_INFO[champ.nationality].flag} ${esc(displayName(champ))}</div>
        <div class="muted small">Champion depuis le ${formatDate(reign!.wonOn)} · ${reign!.defenses} défense${reign!.defenses > 1 ? 's' : ''}</div>`
        : '<div class="muted small">Le titre se dispute entre deux boxeurs du top 5.</div>'}
      ${mandatory}
      ${past ? `<details><summary>Anciens champions</summary><ul class="reigns">${past}</ul></details>` : ''}
    </section>`;
}

export function renderLeague(league: League, state: ViewState): string {
  const tabs = WEIGHT_CLASSES.map((wc) => `
    <button class="tab ${wc === state.division ? 'active' : ''}" data-division="${wc}">
      ${WEIGHT_CLASS_INFO[wc].label}</button>`).join('');

  const order = divisionOrder(league, state.division);
  const hasChamp = !!league.divisions[state.division].championId;
  const selectedId = state.selected ?? order[0]?.id ?? null;

  const rows = order.map((b, i) => {
    const nat = NATIONALITY_INFO[b.nationality];
    const rank = hasChamp ? i : i + 1;
    const out = rank > RANKED_SPOTS;
    const unavailable = !isAvailable(b, league.currentDate);
    return `
      <tr data-boxer="${b.id}" class="${b.id === selectedId ? 'selected' : ''} ${out ? 'unranked' : ''}">
        <td class="rank">${rank === 0 ? '<span class="belt">C</span>' : out ? '—' : rank}</td>
        <td class="name"><span class="flag" title="${esc(nat.country)}">${nat.flag}</span>${esc(displayName(b))}${unavailable ? ' <span class="inj" title="Indisponible">✚</span>' : ''}</td>
        <td class="hide-sm">${ageOn(b.birthDate, league.currentDate)}</td>
        <td class="hide-sm">${STYLE_INFO[b.style].label}</td>
        <td class="rec">${recordString(b.stats)}</td>
        <td class="num">${rankingPoints(league, b)}</td>
        <td class="num ovr-cell">${overallRating(b)}</td>
      </tr>`;
  }).join('');

  const selected = selectedId ? league.boxers[selectedId] : undefined;

  return `
    <nav class="tabs">${tabs}</nav>
    <div class="league-grid">
      <div>
        ${divisionPanel(league, state.division)}
        <section class="panel">
          <table class="rankings">
            <thead><tr><th>#</th><th>Boxeur</th><th class="hide-sm">Âge</th><th class="hide-sm">Style</th><th>Palmarès</th><th class="num">Pts</th><th class="num">Note</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      </div>
      <section>${selected ? boxerCard(league, selected, `<button class="btn" data-schedule="${selected.id}">Programmer un combat</button>`) : ''}</section>
    </div>`;
}
