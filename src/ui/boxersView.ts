/**
 * Écran Boxeurs : tout l'effectif, avec recherche, filtres et tri.
 */
import { rankOf, rankingPoints } from '../league/ranking';
import { ageOn, displayName, isAvailable, koPct, overallRating, recordString } from '../model/boxer';
import { NATIONALITY_INFO, STYLE_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Boxer, League } from '../model/types';
import { FIGHTING_STYLES, WEIGHT_CLASSES } from '../model/types';
import { esc } from './dom';
import type { App } from './state';

interface Column {
  key: string;
  label: string;
  value: (b: Boxer, l: League) => number | string;
  cell: (b: Boxer, l: League) => string;
  cls?: string;
}

const rankSort = (b: Boxer, l: League) => { const r = rankOf(l, b.id); return r === null ? 99 : r; };

const COLUMNS: Column[] = [
  { key: 'name', label: 'Boxeur', value: (b) => `${b.lastName} ${b.firstName}`, cell: (b) => `<span class="flag">${NATIONALITY_INFO[b.nationality].flag}</span>${esc(displayName(b))}`, cls: 'name' },
  { key: 'division', label: 'Catégorie', value: (b) => WEIGHT_CLASSES.indexOf(b.weightClass), cell: (b) => WEIGHT_CLASS_INFO[b.weightClass].label, cls: 'hide-sm' },
  { key: 'rank', label: 'Rang', value: rankSort, cell: (b, l) => { const r = rankOf(l, b.id); return r === 0 ? '<span class="belt sm">C</span>' : r === null ? '—' : String(r); } },
  { key: 'age', label: 'Âge', value: (b, l) => ageOn(b.birthDate, l.currentDate), cell: (b, l) => String(ageOn(b.birthDate, l.currentDate)), cls: 'hide-sm' },
  { key: 'style', label: 'Style', value: (b) => b.style, cell: (b) => STYLE_INFO[b.style].label, cls: 'hide-sm' },
  { key: 'record', label: 'Palmarès', value: (b) => b.stats.wins - b.stats.losses, cell: (b) => recordString(b.stats), cls: 'rec' },
  { key: 'ko', label: 'KO %', value: (b) => koPct(b.stats), cell: (b) => `${koPct(b.stats)}`, cls: 'num hide-sm' },
  { key: 'pop', label: 'Pop.', value: (b) => b.popularity, cell: (b) => String(b.popularity), cls: 'num hide-sm' },
  { key: 'points', label: 'Pts', value: (b, l) => rankingPoints(l, b), cell: (b, l) => String(rankingPoints(l, b)), cls: 'num' },
  { key: 'rating', label: 'Note', value: (b) => overallRating(b), cell: (b) => String(overallRating(b)), cls: 'num ovr-cell' },
];

function filtered(app: App): Boxer[] {
  const f = app.boxers, l = app.league;
  const q = f.search.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const col = COLUMNS.find((c) => c.key === f.sort) ?? COLUMNS[COLUMNS.length - 1]!;
  return Object.values(l.boxers)
    .filter((b) => b.status !== 'retired')
    .filter((b) => !q || norm(`${b.firstName} ${b.lastName} ${b.nickname ?? ''} ${b.hometown}`).includes(q))
    .filter((b) => !f.division || b.weightClass === f.division)
    .filter((b) => !f.style || b.style === f.style)
    .filter((b) => !f.nationality || b.nationality === f.nationality)
    .filter((b) => !f.availableOnly || isAvailable(b, l.currentDate))
    .sort((x, y) => {
      const a = col.value(x, l), b = col.value(y, l);
      const c = typeof a === 'string' ? a.localeCompare(String(b)) : a - (b as number);
      return f.desc ? -c : c;
    });
}

export function renderBoxers(app: App): string {
  const f = app.boxers, l = app.league;
  const list = filtered(app);
  const nats = [...new Set(Object.values(l.boxers).map((b) => b.nationality))]
    .sort((a, b) => NATIONALITY_INFO[a].country.localeCompare(NATIONALITY_INFO[b].country));
  const opt = (v: string, label: string, cur: string) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;

  const head = COLUMNS.map((c) => `<th class="${c.cls ?? ''} sortable ${f.sort === c.key ? 'sorted' : ''}" data-sort="${c.key}">
    ${c.label}${f.sort === c.key ? (f.desc ? ' ▼' : ' ▲') : ''}</th>`).join('');
  const rows = list.map((b) => `<tr data-boxer-modal="${b.id}">${COLUMNS.map((c) => `<td class="${c.cls ?? ''}">${c.cell(b, l)}</td>`).join('')}</tr>`).join('');

  return `
    <section class="panel lab-form filters">
      <label class="grow">Recherche <input type="search" id="bx-search" data-filter="search" value="${esc(f.search)}" placeholder="Nom, surnom, ville…"></label>
      <label>Catégorie <select data-filter="division">${opt('', 'Toutes', f.division)}${WEIGHT_CLASSES.map((wc) => opt(wc, WEIGHT_CLASS_INFO[wc].label, f.division)).join('')}</select></label>
      <label>Style <select data-filter="style">${opt('', 'Tous', f.style)}${FIGHTING_STYLES.map((s) => opt(s, STYLE_INFO[s].label, f.style)).join('')}</select></label>
      <label>Pays <select data-filter="nationality">${opt('', 'Tous', f.nationality)}${nats.map((n) => opt(n, `${NATIONALITY_INFO[n].flag} ${NATIONALITY_INFO[n].country}`, f.nationality)).join('')}</select></label>
      <label class="check"><input type="checkbox" data-filter="availableOnly" ${f.availableOnly ? 'checked' : ''}> Disponibles</label>
    </section>
    <p class="muted small">${list.length} boxeur${list.length > 1 ? 's' : ''} · clique sur un en-tête pour trier, sur une ligne pour ouvrir la fiche.</p>
    <section class="panel scroll-x">
      <table class="rankings"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    </section>`;
}

export function onBoxersClick(app: App, target: HTMLElement): boolean {
  const th = target.closest<HTMLElement>('[data-sort]');
  if (!th) return false;
  const key = th.dataset.sort!;
  if (app.boxers.sort === key) app.boxers.desc = !app.boxers.desc;
  else { app.boxers.sort = key; app.boxers.desc = !['name', 'rank', 'division', 'style'].includes(key); }
  return true;
}

export function onBoxersInput(app: App, el: HTMLInputElement | HTMLSelectElement): boolean {
  const key = el.dataset.filter as keyof App['boxers'] | undefined;
  if (!key) return false;
  if (key === 'availableOnly') app.boxers.availableOnly = (el as HTMLInputElement).checked;
  else (app.boxers as unknown as Record<string, string>)[key] = el.value;
  return true;
}
