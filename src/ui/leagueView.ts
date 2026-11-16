import { divisionOrder } from '../gen/generator';
import { ageOn, displayName, overallRating, recordString } from '../model/boxer';
import { NATIONALITY_INFO, STYLE_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { BoxerId, League, WeightClass } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { boxerCard } from './boxerCard';
import { esc } from './dom';

export interface ViewState {
  division: WeightClass;
  selected: BoxerId | null;
}

export function renderLeague(league: League, state: ViewState): string {
  const tabs = WEIGHT_CLASSES.map((wc) => `
    <button class="tab ${wc === state.division ? 'active' : ''}" data-division="${wc}">
      ${WEIGHT_CLASS_INFO[wc].label}</button>`).join('');

  const order = divisionOrder(league, state.division);
  const selectedId = state.selected ?? order[0]?.id ?? null;

  const rows = order.map((b, i) => {
    const nat = NATIONALITY_INFO[b.nationality];
    return `
      <tr data-boxer="${b.id}" class="${b.id === selectedId ? 'selected' : ''}">
        <td class="rank">${i === 0 ? '<span class="belt">C</span>' : i}</td>
        <td class="name"><span class="flag" title="${esc(nat.country)}">${nat.flag}</span>${esc(displayName(b))}</td>
        <td class="hide-sm">${ageOn(b.birthDate, league.currentDate)}</td>
        <td class="hide-sm">${STYLE_INFO[b.style].label}</td>
        <td class="rec">${recordString(b.stats)}</td>
        <td class="num ovr-cell">${overallRating(b)}</td>
      </tr>`;
  }).join('');

  const selIndex = order.findIndex((b) => b.id === selectedId);
  const selected = selectedId ? league.boxers[selectedId] : undefined;
  const rankLabel = selIndex === 0 ? `Champion · ${WEIGHT_CLASS_INFO[state.division].label}` : `N° ${selIndex} · ${WEIGHT_CLASS_INFO[state.division].label}`;

  return `
    <nav class="tabs">${tabs}</nav>
    <div class="league-grid">
      <section class="panel">
        <table class="rankings">
          <thead><tr><th>#</th><th>Boxeur</th><th class="hide-sm">Âge</th><th class="hide-sm">Style</th><th>Palmarès</th><th>Note</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      <section>${selected ? boxerCard(selected, league.currentDate, rankLabel) : ''}</section>
    </div>`;
}
