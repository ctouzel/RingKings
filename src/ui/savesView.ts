/**
 * Fenêtre « Partie » : emplacements de sauvegarde, export / import, nouvelle ligue.
 */
import { formatDate } from '../core/date';
import { esc } from './dom';
import { createApp, newLeague, save, type App } from './state';
import {
  SLOTS, deleteSlot, exportFile, importFile, listSlots, loadSlot, saveSlot, setActiveSlot, type Slot,
} from './storage';

export async function openSaves(app: App): Promise<void> {
  app.saves = { metas: await listSlots() };
}

export function renderSaves(app: App): string {
  if (!app.saves) return '';
  const slots = SLOTS.map((slot, i) => {
    const m = app.saves!.metas[i];
    const active = slot === app.slot;
    const info = m
      ? `<div class="slot-name">${esc(m.name)}</div>
         <div class="muted small">Saison ${m.seasonYear} · ${formatDate(m.currentDate)} · ${m.fights} combats</div>
         <div class="muted small">Sauvegardé le ${new Date(m.savedAt).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}</div>`
      : '<div class="muted">Vide</div>';
    return `
      <li class="slot ${active ? 'active' : ''}">
        <div class="slot-num pixel">${slot}</div>
        <div class="slot-info">${info}${active ? '<div class="pos small">● Partie en cours (sauvegarde automatique)</div>' : ''}</div>
        <div class="row-btns">
          ${!active && m ? `<button class="btn" data-save-act="load" data-slot="${slot}">Charger</button>` : ''}
          ${!active ? `<button class="btn ghost" data-save-act="copy" data-slot="${slot}">Copier la partie ici</button>` : ''}
          ${!active && m ? `<button class="btn ghost danger" data-save-act="delete" data-slot="${slot}">Supprimer</button>` : ''}
        </div>
      </li>`;
  }).join('');
  return `<div class="modal" data-close-saves>
    <div class="modal-box wide panel pad" role="dialog" aria-modal="true" aria-label="Partie">
      <button class="icon-btn modal-x" data-close-saves title="Fermer">✕</button>
      <h3>Emplacements de sauvegarde</h3>
      <ul class="slots">${slots}</ul>
      <h3>Fichier</h3>
      <div class="row-btns">
        <button class="btn ghost" data-save-act="export">Exporter la ligue (.json)</button>
        <label class="btn ghost file-btn">Importer un fichier…<input type="file" accept=".json,application/json" id="import-file" hidden></label>
      </div>
      <p class="muted small">L’import remplace la partie de l’emplacement en cours (${app.slot}).</p>
      <h3>Nouvelle ligue</h3>
      <form id="new-league-form" class="lab-form inline">
        <label class="grow">Nom <input name="name" maxlength="40" placeholder="Ligue RingKings"></label>
        <label>Seed (optionnel) <input name="seed" type="number" min="0" max="999999999" placeholder="aléatoire"></label>
        <label>Emplacement <select name="slot">${SLOTS.map((s) => `<option value="${s}" ${s === app.slot ? 'selected' : ''}>${s}${app.saves!.metas[s - 1] ? ' (occupé)' : ''}</option>`).join('')}</select></label>
        <button class="btn" type="submit">Créer</button>
      </form>
      <p class="muted small">Le même seed génère exactement la même ligue de départ : pratique pour rejouer ou comparer.</p>
    </div></div>`;
}

/** Remplace la partie affichée (en gardant l'écran courant). */
function switchTo(app: App, league: App['league'], slot: Slot): void {
  const screen = app.screen;
  Object.assign(app, createApp(league, slot));
  app.screen = screen === 'lab' || screen === 'events' ? 'home' : screen;
  setActiveSlot(slot);
}

export async function onSavesClick(app: App, target: HTMLElement): Promise<boolean> {
  if (target.matches('[data-close-saves]')) { app.saves = null; return true; }
  const btn = target.closest<HTMLElement>('[data-save-act]');
  if (!btn) return false;
  const slot = Number(btn.dataset.slot) as Slot;
  try {
    switch (btn.dataset.saveAct) {
      case 'load': {
        const league = await loadSlot(slot);
        if (!league) throw new Error('Emplacement vide.');
        switchTo(app, league, slot);
        app.flash = { kind: 'ok', text: `Partie « ${league.name} » chargée (emplacement ${slot}).` };
        return true;
      }
      case 'copy':
        if (app.saves?.metas[slot - 1] && !confirm(`Écraser l’emplacement ${slot} ?`)) return false;
        await saveSlot(slot, app.league);
        app.flash = { kind: 'ok', text: `Partie copiée dans l’emplacement ${slot}.` };
        break;
      case 'delete':
        if (!confirm(`Supprimer définitivement la partie de l’emplacement ${slot} ?`)) return false;
        await deleteSlot(slot);
        break;
      case 'export':
        exportFile(app.league);
        return false;
    }
  } catch (e) {
    app.flash = { kind: 'err', text: (e as Error).message };
  }
  if (app.saves) app.saves.metas = await listSlots();
  return true;
}

export async function onSavesChange(app: App, el: HTMLInputElement): Promise<boolean> {
  if (el.id !== 'import-file' || !el.files?.[0]) return false;
  try {
    const league = await importFile(el.files[0]);
    if (!confirm(`Remplacer la partie de l’emplacement ${app.slot} par « ${league.name} » (${formatDate(league.currentDate)}) ?`)) return false;
    const slot = app.slot;
    switchTo(app, league, slot);
    save(app);
    app.flash = { kind: 'ok', text: `Ligue « ${league.name} » importée.` };
  } catch (e) {
    app.flash = { kind: 'err', text: (e as Error).message };
  }
  return true;
}

export function onSavesSubmit(app: App, form: HTMLFormElement): boolean {
  if (form.id !== 'new-league-form') return false;
  const data = new FormData(form);
  const slot = Number(data.get('slot')) as Slot;
  if (app.saves?.metas[slot - 1] && !confirm(`L’emplacement ${slot} contient déjà une partie. La remplacer ?`)) return false;
  const seedRaw = String(data.get('seed') ?? '').trim();
  const league = newLeague(String(data.get('name') ?? '').trim(), seedRaw ? Number(seedRaw) : undefined);
  switchTo(app, league, slot);
  save(app);
  app.flash = { kind: 'ok', text: `Nouvelle ligue « ${league.name} » créée (seed ${league.seed}).` };
  return true;
}
