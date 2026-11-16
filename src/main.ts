/**
 * Point d'entrée : affiche l'écran actif et distribue les événements aux écrans.
 * Chaque action modifie l'état (App), puis on ré-affiche tout (simple et fiable).
 */
import './ui/style.css';
import { formatDate } from './core/date';
import { boxerCard } from './ui/boxerCard';
import { onBoxersClick, onBoxersInput, renderBoxers } from './ui/boxersView';
import { esc } from './ui/dom';
import { onEventsChange, onEventsClick, onEventsSubmit, openBuilderFor, renderEvents } from './ui/eventsView';
import { renderFightLab, setLabDivision } from './ui/fightLab';
import { renderLeague } from './ui/leagueView';
import { createApp, newLeague, save, type App, type Screen } from './ui/state';
import { onSavesChange, onSavesClick, onSavesSubmit, openSaves, renderSaves } from './ui/savesView';
import { activeSlot, loadSlot, migrateLegacy, setActiveSlot } from './ui/storage';
import { renderStats } from './ui/statsView';
import { onHomeClick, renderHome } from './ui/homeView';
import { onEditorClick, onEditorInput, openEditor, renderEditor, syncEditorPreview } from './ui/editorView';
import { onSeasonClick, renderSeason } from './ui/seasonView';
import { openViewer, paintSprites } from './ui/viewer';
import { simulateFight } from './sim/engine';
import { fighterFromBoxer } from './sim/fighter';
import type { WeightClass } from './model/types';

const root = document.querySelector<HTMLDivElement>('#app')!;
let app: App;

const SCREENS: [Screen, string][] = [
  ['home', 'Accueil'], ['rankings', 'Classements'], ['boxers', 'Boxeurs'], ['events', 'Galas'], ['season', 'Saison'], ['stats', 'Statistiques'], ['lab', 'Labo'],
];

function screenHtml(): string {
  switch (app.screen) {
    case 'home': return renderHome(app);
    case 'rankings': return renderLeague(app.league, app.rankings);
    case 'boxers': return renderBoxers(app);
    case 'events': return renderEvents(app);
    case 'stats': return renderStats(app);
    case 'season': return renderSeason(app);
    case 'lab': return renderFightLab(app.league, app.lab);
  }
}

function modalHtml(): string {
  const b = app.modalBoxer ? app.league.boxers[app.modalBoxer] : null;
  if (!b) return '';
  return `<div class="modal" data-close-modal>
    <div class="modal-box" role="dialog" aria-modal="true">
      <button class="icon-btn modal-x" data-close-modal title="Fermer">✕</button>
      ${boxerCard(app.league, b, `<button class="btn" data-schedule="${b.id}">Programmer un combat</button>
        <button class="btn ghost" data-goto-rank="${b.id}">Voir au classement</button>
        <button class="btn ghost" data-edit-look="${b.id}">Personnaliser</button>`)}
    </div></div>`;
}

function render(): void {
  // On mémorise le champ actif pour lui rendre le focus après le ré-affichage (recherche).
  const active = document.activeElement as HTMLInputElement | null;
  const focusId = active?.id, caret = active?.selectionStart ?? null;

  const badge = (id: Screen) => (id === 'season' && app.league.draft ? ' <span class="badge" title="Repêchage en attente">!</span>' : '');
  const nav = SCREENS.map(([id, label]) =>
    `<button class="nav ${app.screen === id ? 'active' : ''}" data-screen="${id}">${label}${badge(id)}</button>`).join('');
  const flash = app.flash ? `<div class="flash ${app.flash.kind}" data-flash>${esc(app.flash.text)}</div>` : '';
  root.innerHTML = `
    <header>
      <h1>RINGKINGS</h1>
      <nav class="main-nav">${nav}</nav>
      <div class="header-info">
        <span>${esc(app.league.name)} · saison ${app.league.seasonYear} · <b>${formatDate(app.league.currentDate)}</b></span>
        <button id="open-saves" class="btn ghost" title="Sauvegardes, export, nouvelle ligue">Partie</button>
      </div>
    </header>
    <main>${flash}${screenHtml()}</main>
    ${modalHtml()}
    ${renderSaves(app)}
    ${renderEditor(app)}`;
  app.flash = null;
  paintSprites(app.league, root);
  if (app.editor) syncEditorPreview(app, app.league.boxers[app.editor.boxerId]!.heightCm);

  if (focusId) {
    const el = document.getElementById(focusId) as HTMLInputElement | null;
    if (el) { el.focus(); if (caret !== null) el.setSelectionRange(caret, caret); }
  }
}

/** Après une action : sauvegarde et ré-affichage. */
function update(): void {
  save(app);
  render();
}

root.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;

  // Fenêtre « Partie » (asynchrone : lecture/écriture des sauvegardes).
  if (t.closest('#open-saves')) { await openSaves(app); return render(); }
  if (app.saves) {
    if (await onSavesClick(app, t)) render();
    return;
  }
  if (app.editor) {
    if (onEditorClick(app, t)) update();
    return;
  }
  const look = t.closest<HTMLElement>('[data-edit-look]');
  if (look) { app.modalBoxer = null; openEditor(app, look.dataset.editLook!); return render(); }

  // Fenêtre de fiche boxeur.
  if (t.matches('[data-close-modal]')) { app.modalBoxer = null; return render(); }
  const sched = t.closest<HTMLElement>('[data-schedule]');
  if (sched) { app.modalBoxer = null; openBuilderFor(app, sched.dataset.schedule!); window.scrollTo(0, 0); return update(); }
  const goto = t.closest<HTMLElement>('[data-goto-rank]');
  if (goto) {
    const b = app.league.boxers[goto.dataset.gotoRank!]!;
    app.modalBoxer = null;
    app.screen = 'rankings';
    app.rankings = { division: b.weightClass, selected: b.id };
    return render();
  }
  const modalRow = t.closest<HTMLElement>('[data-boxer-modal]');
  if (modalRow) { app.modalBoxer = modalRow.dataset.boxerModal!; return render(); }

  // Navigation.
  const nav = t.closest<HTMLElement>('[data-screen]');
  if (nav) { app.screen = nav.dataset.screen as Screen; app.events.fightId = null; return render(); }

  // Un combat cliqué depuis n'importe quel écran (historique, records) : détail dans Galas.
  const fight = t.closest<HTMLElement>('[data-fight]');
  if (fight && app.screen !== 'events') {
    app.modalBoxer = null;
    app.screen = 'events';
    app.events.fightId = fight.dataset.fight!;
    window.scrollTo(0, 0);
    return render();
  }

  switch (app.screen) {
    case 'home':
      if (onHomeClick(app, t)) return render();
      break;
    case 'rankings': {
      const tab = t.closest<HTMLElement>('[data-division]');
      if (tab) { app.rankings = { division: tab.dataset.division as WeightClass, selected: null }; return render(); }
      const row = t.closest<HTMLElement>('[data-boxer]');
      if (row) { app.rankings.selected = row.dataset.boxer!; return render(); }
      break;
    }
    case 'boxers':
      if (onBoxersClick(app, t)) return render();
      break;
    case 'events':
      if (onEventsClick(app, t)) return update();
      break;
    case 'season':
      if (onSeasonClick(app, t)) return update();
      break;
    case 'lab':
      if (t.id === 'lab-run') { app.lab.seed = Math.floor(Math.random() * 2 ** 32); return render(); }
      if (t.id === 'lab-watch') {
        const { red, blue, rounds, division, seed } = app.lab;
        const R = app.league.boxers[red!]!, B = app.league.boxers[blue!]!;
        const out = simulateFight({ red: fighterFromBoxer(R), blue: fighterFromBoxer(B), rounds, weightClass: division, seed: seed! });
        openViewer({ ...out, red: R, blue: B, title: 'Labo de combat · combat d’exhibition' });
        return;
      }
      break;
  }
});

function onFieldChange(e: Event): void {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (app.saves) {
    if (e.type === 'change') void onSavesChange(app, el as HTMLInputElement).then((changed) => changed && render());
    return;
  }
  if (app.editor) { if (e.type === 'change' && onEditorInput(app, el as HTMLInputElement)) render(); return; }
  if (app.screen === 'boxers' && onBoxersInput(app, el)) return render();
  if (e.type !== 'change') return;
  if (app.screen === 'events' && onEventsChange(app, el)) return render();
  if (app.screen === 'lab') {
    const lab = app.lab;
    if (el.id === 'lab-division') setLabDivision(app.league, lab, el.value as WeightClass);
    else if (el.id === 'lab-red') lab.red = el.value;
    else if (el.id === 'lab-blue') lab.blue = el.value;
    else if (el.id === 'lab-rounds') lab.rounds = Number(el.value);
    else return;
    lab.seed = null;
    render();
  }
}
root.addEventListener('input', onFieldChange);
root.addEventListener('change', onFieldChange);

root.addEventListener('submit', (e) => {
  e.preventDefault();
  if (app.saves) { if (onSavesSubmit(app, e.target as HTMLFormElement)) render(); return; }
  if (app.screen === 'events' && onEventsSubmit(app, e.target as HTMLFormElement)) update();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.saves) { app.saves = null; render(); return; }
  if (e.key === 'Escape' && app.editor) { app.editor = null; render(); return; }
  if (e.key === 'Escape' && app.modalBoxer) { app.modalBoxer = null; render(); }
});

/** Démarrage : ancienne sauvegarde migrée, puis chargement de l'emplacement actif. */
async function start(): Promise<void> {
  await migrateLegacy();
  const slot = activeSlot();
  let league = null;
  try { league = await loadSlot(slot); } catch (e) { console.error('Sauvegarde illisible', e); }
  app = createApp(league ?? newLeague(), slot);
  setActiveSlot(slot);
  if (!league) save(app);
  // Rend l'état accessible pour déboguer dans la console du navigateur.
  (window as unknown as { ringkings: App }).ringkings = app;
  render();
}
void start();
