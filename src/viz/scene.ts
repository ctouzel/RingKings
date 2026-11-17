/**
 * Décor : salle, foule, ring, cordes. Résolution 512×448 (deux fois la
 * résolution d'une console 8-bit, pour des sprites plus fins), agrandie sans flou.
 *
 * La logique d'animation (frame.ts) travaille en "unités" de 256 de large ;
 * le lecteur les convertit en pixels à l'échelle des sprites (U, fighterSprite.ts).
 */
import { CROWD, OUTLINE, RING, SKIN } from './palette';

export const W = 512;
export const H = 448;
export const GROUND_Y = 320; // ligne des pieds des boxeurs
export const REF_Y = 258; // l'arbitre se tient en retrait, au fond du ring

const FLOOR_TOP = 196, FLOOR_BOTTOM = 392;

/** Petite fonction pseudo-aléatoire stable (le décor ne scintille pas d'une image à l'autre). */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
}

interface Fan { x: number; y: number; skin: string; shirt: string; hair: string; depth: number }
const fans: Fan[] = [];
{
  const rnd = prng(2024);
  const shirts = [...CROWD, '#7a3a3a', '#3a5a7a', '#6a6a2a', '#2a6a5a', '#7a5a8a', '#8a8a8a'];
  for (let row = 0; row < 9; row++) {
    const y = 74 + row * 14;
    const depth = row / 8; // 0 = au fond, 1 = près du ring
    const step = 13 - Math.round(depth * 2);
    for (let x = (row % 2) * 6 - 4; x < W + 8; x += step) {
      fans.push({
        x: x + Math.floor(rnd() * 3), y, depth,
        skin: SKIN[Math.floor(rnd() * SKIN.length)]![rnd() < 0.5 ? 0 : 1],
        shirt: shirts[Math.floor(rnd() * shirts.length)]!,
        hair: ['#201818', '#4a2c18', '#7a4a20', '#c8a040', '#888'][Math.floor(rnd() * 5)]!,
      });
    }
  }
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Assombrit une couleur #rrggbb (k entre 0 et 1). */
function dim(c: string, k: number): string {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) => Math.round(v * (1 - k)).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

export function drawBackground(g: CanvasRenderingContext2D, time: number, excitement: number): void {
  // Salle : dégradé tramé du bleu nuit au noir.
  for (let y = 0; y < FLOOR_TOP; y += 2) {
    const t = y / FLOOR_TOP;
    rect(g, 0, y, W, 2, t < 0.35 ? '#08070e' : t < 0.7 ? '#0d0b18' : '#131124');
  }
  // Rampe d'éclairage et projecteurs avec cônes de lumière tramés.
  rect(g, 0, 18, W, 6, '#26263a');
  rect(g, 0, 18, W, 1, '#3c3c58');
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 86;
    rect(g, x - 7, 24, 14, 8, '#1a1a28');
    rect(g, x - 5, 30, 10, 3, RING.lights);
    rect(g, x - 3, 33, 6, 1, '#ffffff');
    g.fillStyle = '#fff6c010';
    for (let y = 36; y < FLOOR_TOP; y += 2) {
      const half = 6 + (y - 36) * 0.22;
      for (let xx = Math.round(x - half); xx < x + half; xx += 2) if (((xx >> 1) + (y >> 1)) % 2 === 0) g.fillRect(xx, y, 1, 1);
    }
  }
  // Foule : des rangées de spectateurs (tête, cheveux, épaules), plus sombres au fond.
  for (const [i, f] of fans.entries()) {
    const shade = 0.55 - f.depth * 0.4;
    const cheer = excitement > 0 && (i * 7 + Math.floor(time * 6)) % 4 === 0;
    const bob = cheer ? -2 : 0;
    const y = f.y + bob;
    rect(g, f.x - 1, y + 6, 10, 8, dim(f.shirt, shade));
    rect(g, f.x + 1, y, 6, 6, dim(f.skin, shade));
    rect(g, f.x + 1, y - 1, 6, 2, dim(f.hair, shade));
    if (cheer) { rect(g, f.x - 2, y - 4, 2, 9, dim(f.skin, shade)); rect(g, f.x + 8, y - 4, 2, 9, dim(f.skin, shade)); }
  }
  // Flashs des photographes quand l'action est intense.
  if (excitement > 0) {
    const n = Math.floor(excitement * 10);
    for (let k = 0; k < n; k++) {
      const f = fans[(k * 131 + Math.floor(time * 20) * 17) % fans.length]!;
      rect(g, f.x + 2, f.y + 1, 4, 4, '#ffffff');
      rect(g, f.x, f.y + 3, 8, 1, '#fffbe0');
    }
  }
  drawRingBack(g);
}

function drawRingBack(g: CanvasRenderingContext2D): void {
  // Barrière devant le public.
  rect(g, 0, 186, W, 10, '#1c1a2a');
  rect(g, 0, 186, W, 1, '#34304a');
  // Plancher en perspective, toile bleue avec trame légère.
  for (let y = FLOOR_TOP; y < FLOOR_BOTTOM; y++) {
    const t = (y - FLOOR_TOP) / (FLOOR_BOTTOM - FLOOR_TOP);
    const half = 212 + t * 42;
    const band = Math.floor((y - FLOOR_TOP) / 14) % 2 === 0;
    rect(g, 256 - half, y, half * 2, 1, band ? RING.floor : RING.floorLight);
  }
  // Ombre au fond du ring, lumière au centre (tramages).
  g.fillStyle = '#00000040';
  for (let y = FLOOR_TOP; y < FLOOR_TOP + 14; y += 1) for (let x = 48 + (y % 2); x < W - 48; x += 2) g.fillRect(x, y, 1, 1);
  // Emblème au centre : une couronne stylisée.
  const cx = 256, cy = 290;
  g.fillStyle = '#ffffff1c';
  g.beginPath(); g.ellipse(cx, cy, 70, 20, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f8c81830';
  const crown = [[-16, 4], [-16, -6], [-9, 0], [0, -9], [9, 0], [16, -6], [16, 4]];
  g.beginPath(); crown.forEach(([x, y], i) => (i ? g.lineTo(cx + x!, cy + y!) : g.moveTo(cx + x!, cy + y!))); g.closePath(); g.fill();
  // Tablier sous le ring.
  rect(g, 0, FLOOR_BOTTOM, W, H - FLOOR_BOTTOM, RING.apron);
  rect(g, 0, FLOOR_BOTTOM, W, 2, '#3a4660');
  for (let x = 12; x < W; x += 32) { rect(g, x, 416, 18, 3, RING.apronText); rect(g, x, 416, 18, 1, '#fff0a0'); }
  // Poteaux du fond et cordes arrière.
  post(g, 44, 116, 200, 'white');
  post(g, 462, 116, 200, 'white');
  for (const [i, y] of [134, 152, 170].entries()) rope(g, 50, 462, y, i);
}

function post(g: CanvasRenderingContext2D, x: number, top: number, bottom: number, pad: 'red' | 'blue' | 'white'): void {
  rect(g, x - 1, top - 1, 8, bottom - top + 2, OUTLINE);
  rect(g, x, top, 6, bottom - top, RING.post);
  rect(g, x, top, 2, bottom - top, '#f4f4f4');
  rect(g, x + 4, top, 2, bottom - top, '#9a9aa6');
  // Coussins de coin.
  const c = pad === 'red' ? ['#e04848', '#a02828', '#ff8a8a'] : pad === 'blue' ? ['#4870e0', '#2848a0', '#90b0ff'] : ['#e8e8e8', '#a8a8b0', '#ffffff'];
  for (const k of [0.18, 0.4, 0.62]) {
    const y = top + (bottom - top) * k;
    rect(g, x - 3, y - 1, 12, 12, OUTLINE);
    rect(g, x - 2, y, 10, 10, c[0]!);
    rect(g, x - 2, y + 7, 10, 3, c[1]!);
    rect(g, x - 1, y + 1, 3, 2, c[2]!);
  }
}

/** Corde ombrée : contour, couleur, reflet. */
function rope(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, i: number): void {
  const [base, dark, light] = i === 0 ? [RING.ropeRed, '#a02828', '#ff9a9a'] : i === 1 ? ['#e8e8ee', '#a0a0b0', '#ffffff'] : [RING.ropeBlue, '#2848a0', '#9ab4ff'];
  rect(g, x0, y - 1, x1 - x0, 6, OUTLINE);
  rect(g, x0, y, x1 - x0, 4, base);
  rect(g, x0, y + 3, x1 - x0, 1, dark);
  rect(g, x0, y, x1 - x0, 1, light);
}

/** Ombre portée sous un boxeur (tramée, à la manière des vieux jeux). */
export function drawShadow(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  g.fillStyle = '#0a1a40';
  for (let dy = -3; dy <= 3; dy++) {
    const half = Math.round(w * Math.sqrt(1 - (dy * dy) / 12));
    for (let dx = -half; dx <= half; dx++) if ((dx + dy) % 2 === 0) g.fillRect(Math.round(x + dx), Math.round(y + dy), 1, 1);
  }
}

/** Cordes avant, dessinées par-dessus les boxeurs. */
export function drawRingFront(g: CanvasRenderingContext2D): void {
  post(g, 4, 300, 400, 'red');
  post(g, W - 10, 300, 400, 'blue');
  for (const [i, y] of [338, 362, 386].entries()) rope(g, 10, W - 10, y, i);
}

/** Étoile d'impact (plus grosse et dorée pour un coup propre). */
export function drawSpark(g: CanvasRenderingContext2D, x: number, y: number, size: number, clean: boolean): void {
  const s = size * 2;
  const core = clean ? '#fff060' : '#ffffff';
  const ring = clean ? '#ff9a20' : '#a0d8ff';
  // Rayons.
  rect(g, x - s - 2, y - 2, s * 2 + 5, 5, OUTLINE);
  rect(g, x - 2, y - s - 2, 5, s * 2 + 5, OUTLINE);
  rect(g, x - s - 1, y - 1, s * 2 + 3, 3, ring);
  rect(g, x - 1, y - s - 1, 3, s * 2 + 3, ring);
  rect(g, x - s + 2, y, s * 2 - 3, 1, core);
  rect(g, x, y - s + 2, 1, s * 2 - 3, core);
  // Diagonales.
  for (let k = 2; k < s - 1; k++) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    rect(g, x + dx * k, y + dy * k, 2, 2, k < s / 2 ? core : ring);
  }
  rect(g, x - 2, y - 2, 5, 5, '#ffffff');
}
