import './ui/style.css';
import { formatDate } from './core/date';
import { generateLeague } from './gen/generator';
import { deserializeLeague, serializeLeague } from './model/league';
import type { BoxerId, League, WeightClass } from './model/types';
import { esc } from './ui/dom';
import { defaultLab, renderFightLab, setLabDivision, type LabState } from './ui/fightLab';
import { renderLeague, type ViewState } from './ui/leagueView';
import { renderEvents, type EventsState } from './ui/eventsView';
import { Rng } from './core/rng';
import { runEvent } from './league/events';
import { autoCard } from './league/matchmaking';

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

type Screen = 'rankings' | 'events' | 'lab';

let league = loadLeague();
save(league);
let screen: Screen = 'rankings';
const view: ViewState = { division: 'heavyweight', selected: null };
let lab: LabState = defaultLab(league);
const evState: EventsState = { fightId: null };
const app = document.querySelector<HTMLDivElement>('#app')!;

function render(): void {
  const nav = (id: Screen, label: string) =>
    `<button class="nav ${screen === id ? 'active' : ''}" data-screen="${id}">${label}</button>`;
  app.innerHTML = `
    <header>
      <h1>RINGKINGS</h1>
      <nav class="main-nav">${nav('rankings', 'Classements')}${nav('events', 'Galas')}${nav('lab', 'Labo de combat')}</nav>
      <div class="header-info">
        <span>${esc(league.name)} · ${formatDate(league.currentDate)}</span>
        <button id="new-league" class="btn ghost">Nouvelle ligue</button>
      </div>
    </header>
    <main>${screen === 'rankings' ? renderLeague(league, view) : screen === 'events' ? renderEvents(league, evState) : renderFightLab(league, lab)}</main>`;
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const nav = target.closest<HTMLElement>('[data-screen]');
  if (nav) {
    screen = nav.dataset.screen as Screen;
    evState.fightId = null;
    return render();
  }
  const fightEl = target.closest<HTMLElement>('[data-fight]');
  if (fightEl) {
    screen = 'events';
    evState.fightId = fightEl.dataset.fight!;
    window.scrollTo(0, 0);
    return render();
  }
  if (target.closest('[data-back]')) {
    evState.fightId = null;
    return render();
  }
  if (target.id === 'quick-gala') {
    const ev = autoCard(league, new Rng(Math.floor(Math.random() * 2 ** 32)));
    runEvent(league, ev.id);
    save(league);
    return render();
  }
  const tab = target.closest<HTMLElement>('[data-division]');
  if (tab) {
    view.division = tab.dataset.division as WeightClass;
    view.selected = null;
    return render();
  }
  const row = target.closest<HTMLElement>('[data-boxer]');
  if (row) {
    view.selected = row.dataset.boxer as BoxerId;
    return render();
  }
  if (target.id === 'lab-run') {
    lab.seed = Math.floor(Math.random() * 2 ** 32);
    return render();
  }
  if (target.id === 'new-league' && confirm('Générer une nouvelle ligue ? La ligue actuelle sera remplacée.')) {
    league = newLeague();
    save(league);
    view.selected = null;
    evState.fightId = null;
    lab = defaultLab(league);
    render();
  }
});

app.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.id === 'lab-division') setLabDivision(league, lab, el.value as WeightClass);
  else if (el.id === 'lab-red') lab.red = el.value;
  else if (el.id === 'lab-blue') lab.blue = el.value;
  else if (el.id === 'lab-rounds') lab.rounds = Number(el.value);
  else return;
  lab.seed = null; // nouveau choix : on efface l'ancien résultat
  render();
});

render();
