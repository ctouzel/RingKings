/**
 * Éditeur d'apparence (sprite) d'un boxeur, avec aperçu animé.
 * L'apparence est purement visuelle : aucun effet sur les combats.
 */
import { Rng } from '../core/rng';
import { GLOVES_COLORS, TRUNKS_COLORS } from '../gen/generator';
import { fullName } from '../model/boxer';
import type { Appearance, BoxerId } from '../model/types';
import { drawFighter } from '../viz/fighterSprite';
import { HAIR, SKIN } from '../viz/palette';
import { POSES, lerpPose, punchCurve, type PoseName } from '../viz/poses';
import { drawBackground, drawRingFront, GROUND_Y } from '../viz/scene';
import { esc } from './dom';
import type { App } from './state';

export interface EditorState {
  boxerId: BoxerId;
  draft: Appearance;
}

const HAIR_STYLE_LABEL = ['Chauve', 'Ras', 'Court', 'Afro', 'Queue', 'Mohawk'];
const HAIR_COLOR_LABEL = ['Noir', 'Brun foncé', 'Brun', 'Blond', 'Roux'];
const FACIAL_LABEL = ['Aucune', 'Moustache', 'Barbe'];
const BUILD_LABEL: Record<Appearance['build'], string> = { slim: 'Mince', medium: 'Moyenne', bulky: 'Massive' };

export function openEditor(app: App, boxerId: BoxerId): void {
  const b = app.league.boxers[boxerId]!;
  app.editor = { boxerId, draft: { ...b.appearance } };
}

export function renderEditor(app: App): string {
  const ed = app.editor;
  if (!ed) return '';
  const b = app.league.boxers[ed.boxerId]!;
  const d = ed.draft;
  const swatch = (field: keyof Appearance, value: string | number, color: string, label: string) =>
    `<button class="swatch ${d[field] === value ? 'on' : ''}" data-ed="${field}" data-v="${value}" style="background:${color}" title="${esc(label)}" aria-label="${esc(label)}"></button>`;
  const choice = (field: keyof Appearance, value: string | number, label: string) =>
    `<button class="chip ${d[field] === value ? 'on' : ''}" data-ed="${field}" data-v="${value}">${esc(label)}</button>`;
  return `<div class="modal" data-close-editor>
    <div class="modal-box wide panel pad editor" role="dialog" aria-modal="true" aria-label="Apparence">
      <button class="icon-btn modal-x" data-close-editor title="Fermer">✕</button>
      <h3>Apparence de ${esc(fullName(b))}</h3>
      <div class="editor-grid">
        <canvas id="editor-preview" width="120" height="90" aria-label="Aperçu animé"></canvas>
        <div class="editor-controls">
          <div class="ed-row"><span>Peau</span><div>${SKIN.map(([c], i) => swatch('skinTone', i, c, `Teinte ${i + 1}`)).join('')}</div></div>
          <div class="ed-row"><span>Coiffure</span><div>${HAIR_STYLE_LABEL.map((l, i) => choice('hairStyle', i, l)).join('')}</div></div>
          <div class="ed-row"><span>Cheveux</span><div>${HAIR.map((c, i) => swatch('hairColor', i, c, HAIR_COLOR_LABEL[i]!)).join('')}</div></div>
          <div class="ed-row"><span>Barbe</span><div>${FACIAL_LABEL.map((l, i) => choice('facialHair', i, l)).join('')}</div></div>
          <div class="ed-row"><span>Carrure</span><div>${(Object.keys(BUILD_LABEL) as Appearance['build'][]).map((k) => choice('build', k, BUILD_LABEL[k])).join('')}</div></div>
          <div class="ed-row"><span>Short</span><div>${TRUNKS_COLORS.map((c) => swatch('trunksColor', c, c, c)).join('')}
            <input type="color" data-ed-color="trunksColor" value="${d.trunksColor}" title="Couleur libre"></div></div>
          <div class="ed-row"><span>Gants</span><div>${GLOVES_COLORS.map((c) => swatch('glovesColor', c, c, c)).join('')}
            <input type="color" data-ed-color="glovesColor" value="${d.glovesColor}" title="Couleur libre"></div></div>
        </div>
      </div>
      <div class="row-btns ev-foot">
        <button class="btn ghost" data-ed-act="random">Aléatoire</button>
        <button class="btn ghost" data-ed-act="reset">Annuler les changements</button>
        <button class="btn" data-ed-act="save">Enregistrer</button>
      </div>
    </div></div>`;
}

export function onEditorClick(app: App, target: HTMLElement): boolean {
  const ed = app.editor;
  if (!ed) return false;
  if (target.matches('[data-close-editor]')) { app.editor = null; return true; }
  const opt = target.closest<HTMLElement>('[data-ed]');
  if (opt) {
    const field = opt.dataset.ed as keyof Appearance;
    const raw = opt.dataset.v!;
    (ed.draft as unknown as Record<string, string | number>)[field] = /^\d+$/.test(raw) ? Number(raw) : raw;
    return true;
  }
  switch (target.closest<HTMLElement>('[data-ed-act]')?.dataset.edAct) {
    case 'random': {
      const r = new Rng(Math.floor(Math.random() * 2 ** 32));
      ed.draft = {
        skinTone: r.int(0, SKIN.length - 1), hairStyle: r.int(0, 5), hairColor: r.int(0, HAIR.length - 1),
        facialHair: r.int(0, 2), build: r.pick(['slim', 'medium', 'bulky'] as const),
        trunksColor: r.pick(TRUNKS_COLORS), glovesColor: r.pick(GLOVES_COLORS),
      };
      return true;
    }
    case 'reset': ed.draft = { ...app.league.boxers[ed.boxerId]!.appearance }; return true;
    case 'save': {
      const b = app.league.boxers[ed.boxerId]!;
      b.appearance = { ...ed.draft };
      app.editor = null;
      app.flash = { kind: 'ok', text: `Apparence de ${fullName(b)} enregistrée.` };
      return true;
    }
  }
  return false;
}

export function onEditorInput(app: App, el: HTMLInputElement): boolean {
  const field = el.dataset.edColor as 'trunksColor' | 'glovesColor' | undefined;
  if (!app.editor || !field) return false;
  app.editor.draft[field] = el.value;
  return true;
}

// ---------------------------------------------------------------------------
// Aperçu animé : un petit combat d'ombre en boucle.
// ---------------------------------------------------------------------------

const SEQUENCE: [PoseName, number][] = [
  ['guard', 0.8], ['jab', 0.45], ['guard', 0.3], ['cross', 0.45], ['hook', 0.5], ['guard', 0.4],
  ['uppercut', 0.55], ['body', 0.5], ['guard', 0.4], ['hit', 0.5], ['slip', 0.5], ['victory', 1.2],
];
const TOTAL = SEQUENCE.reduce((s, [, d]) => s + d, 0);
let raf = 0;

export function syncEditorPreview(app: App, height: number): void {
  cancelAnimationFrame(raf);
  if (!app.editor) return;
  const start = performance.now();
  const tick = (now: number) => {
    const cv = document.getElementById('editor-preview') as HTMLCanvasElement | null;
    if (!cv || !app.editor) return;
    const g = cv.getContext('2d')!;
    const t = ((now - start) / 1000) % TOTAL;
    let acc = 0, pose = POSES.guard;
    for (const [name, d] of SEQUENCE) {
      if (t < acc + d) {
        const p = (t - acc) / d;
        pose = name === 'guard' || name === 'victory' ? POSES[name] : lerpPose(POSES.guard, POSES[name], punchCurve(p));
        break;
      }
      acc += d;
    }
    // Décor du ring (recadré) puis le boxeur, agrandi.
    g.save();
    g.clearRect(0, 0, cv.width, cv.height);
    g.translate(-68, -82);
    drawBackground(g, now / 1000, 0);
    drawRingFront(g);
    g.restore();
    drawFighter(g, pose, { appearance: app.editor.draft, heightCm: height }, 46, GROUND_Y - 82, 1);
    drawFighter(g, POSES.guard, { appearance: { ...app.editor.draft, trunksColor: '#555', glovesColor: '#777' }, heightCm: height }, 80, GROUND_Y - 82, -1);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
