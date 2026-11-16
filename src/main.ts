import './ui/style.css';
import { formatDate } from './core/date';
import { generateLeague } from './gen/generator';
import { deserializeLeague, serializeLeague } from './model/league';
import type { BoxerId, League, WeightClass } from './model/types';
import { renderLeague, type ViewState } from './ui/leagueView';
import { esc } from './ui/dom';

const SAVE_KEY = 'ringkings.save';

function loadLeague(): League {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) return deserializeLeague(saved);
  } catch {
    // Sauvegarde absente, illisible ou d'une ancienne version : nouvelle ligue.
  }
  return newLeague();
}

function newLeague(): League {
  return generateLeague({ seed: Math.floor(Math.random() * 1_000_000) });
}

function save(league: League): void {
  try { localStorage.setItem(SAVE_KEY, serializeLeague(league)); } catch { /* stockage indisponible */ }
}

let league = loadLeague();
save(league);
const state: ViewState = { division: 'heavyweight', selected: null };
const app = document.querySelector<HTMLDivElement>('#app')!;

function render(): void {
  app.innerHTML = `
    <header>
      <h1>RINGKINGS</h1>
      <div class="header-info">
        <span>${esc(league.name)} · ${formatDate(league.currentDate)} · seed ${league.seed}</span>
        <button id="new-league" class="btn">Nouvelle ligue</button>
      </div>
    </header>
    <main>${renderLeague(league, state)}</main>`;
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const tab = target.closest<HTMLElement>('[data-division]');
  if (tab) {
    state.division = tab.dataset.division as WeightClass;
    state.selected = null;
    return render();
  }
  const row = target.closest<HTMLElement>('[data-boxer]');
  if (row) {
    state.selected = row.dataset.boxer as BoxerId;
    return render();
  }
  if (target.id === 'new-league' && confirm('Générer une nouvelle ligue ? La ligue actuelle sera remplacée.')) {
    league = newLeague();
    save(league);
    state.selected = null;
    render();
  }
});

render();
