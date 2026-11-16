/**
 * Décor : salle, foule, ring, cordes. Résolution 256×224 (agrandie sans flou).
 */
import { CROWD, OUTLINE, RING } from './palette';

export const W = 256;
export const H = 224;
export const GROUND_Y = 160; // ligne des pieds des boxeurs
export const REF_Y = 128; // l'arbitre se tient en retrait, au fond du ring

/** Foule : générée une fois (pseudo-aléatoire stable). */
const crowd: { x: number; y: number; c: string; h: number }[] = [];
{
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let y = 26; y < 92; y += 6) {
    for (let x = (y / 6) % 2 ? 0 : 3; x < W; x += 6) {
      crowd.push({ x: x + Math.floor(rnd() * 2), y, c: CROWD[Math.floor(rnd() * CROWD.length)]!, h: 3 + Math.floor(rnd() * 2) });
    }
  }
}

export function drawBackground(g: CanvasRenderingContext2D, time: number, excitement: number): void {
  // Salle sombre et rampe d'éclairage.
  g.fillStyle = '#0c0a14';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#20202c';
  g.fillRect(0, 8, W, 6);
  for (let x = 12; x < W; x += 28) {
    g.fillStyle = RING.lights;
    g.fillRect(x, 10, 6, 3);
  }
  // Foule : elle s'agite et les flashs crépitent quand l'action est intense.
  for (const [i, p] of crowd.entries()) {
    const jump = excitement > 0 && (i * 7 + Math.floor(time * 8)) % 5 === 0 ? -1 : 0;
    g.fillStyle = p.c;
    g.fillRect(p.x, p.y + jump, 4, p.h);
    g.fillStyle = '#00000040';
    g.fillRect(p.x, p.y + jump + p.h, 4, 1);
  }
  if (excitement > 0) {
    const n = Math.floor(excitement * 14);
    for (let k = 0; k < n; k++) {
      const i = (k * 97 + Math.floor(time * 30) * 13) % crowd.length;
      g.fillStyle = '#ffffff';
      g.fillRect(crowd[i]!.x + 1, crowd[i]!.y, 2, 2);
    }
  }
  drawRingBack(g);
}

function drawRingBack(g: CanvasRenderingContext2D): void {
  // Plancher en perspective (trapèze).
  for (let y = 96; y < 196; y++) {
    const t = (y - 96) / 100;
    const half = 104 + t * 22;
    g.fillStyle = y % 8 < 4 ? RING.floor : RING.floorLight;
    g.fillRect(Math.round(128 - half), y, Math.round(half * 2), 1);
  }
  // Tablier.
  g.fillStyle = RING.apron;
  g.fillRect(0, 196, W, 28);
  g.fillStyle = RING.apronText;
  for (let x = 6; x < W; x += 16) g.fillRect(x, 208, 8, 2);
  // Poteaux du fond et cordes arrière.
  post(g, 24, 58, 96);
  post(g, 228, 58, 96);
  for (const [i, y] of [66, 76, 86].entries()) {
    g.fillStyle = i === 0 ? RING.ropeRed : i === 1 ? RING.rope : RING.ropeBlue;
    g.fillRect(26, y, 204, 2);
  }
}

function post(g: CanvasRenderingContext2D, x: number, top: number, bottom: number): void {
  g.fillStyle = OUTLINE;
  g.fillRect(x - 1, top - 1, 6, bottom - top + 2);
  g.fillStyle = RING.post;
  g.fillRect(x, top, 4, bottom - top);
}

/** Cordes avant, dessinées par-dessus les boxeurs. */
export function drawRingFront(g: CanvasRenderingContext2D): void {
  post(g, 2, 150, 198);
  post(g, 250, 150, 198);
  for (const [i, y] of [168, 180, 192].entries()) {
    g.fillStyle = OUTLINE;
    g.fillRect(4, y - 1, 248, 4);
    g.fillStyle = i === 0 ? RING.ropeRed : i === 1 ? RING.rope : RING.ropeBlue;
    g.fillRect(4, y, 248, 2);
  }
  // Coins rouge et bleu.
  g.fillStyle = '#e04040';
  g.fillRect(1, 146, 8, 6);
  g.fillStyle = '#3868e0';
  g.fillRect(247, 146, 8, 6);
}

/** Étoile d'impact. */
export function drawSpark(g: CanvasRenderingContext2D, x: number, y: number, size: number, clean: boolean): void {
  const c = clean ? '#fff060' : '#ffffff';
  g.fillStyle = OUTLINE;
  g.fillRect(x - size - 1, y - 2, size * 2 + 3, 5);
  g.fillRect(x - 2, y - size - 1, 5, size * 2 + 3);
  g.fillStyle = c;
  g.fillRect(x - size, y - 1, size * 2 + 1, 3);
  g.fillRect(x - 1, y - size, 3, size * 2 + 1);
  if (clean) {
    g.fillRect(x - size + 2, y - size + 2, 2, 2);
    g.fillRect(x + size - 3, y - size + 2, 2, 2);
    g.fillRect(x - size + 2, y + size - 3, 2, 2);
    g.fillRect(x + size - 3, y + size - 3, 2, 2);
  }
}
