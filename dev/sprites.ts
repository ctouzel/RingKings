/** Galerie : toutes les poses pour plusieurs apparences (npm run dev puis /dev/sprites.html). */
import { drawFighter } from '../src/viz/fighterSprite';
import { POSES, type PoseName } from '../src/viz/poses';
import type { Appearance } from '../src/model/types';

const looks: { appearance: Appearance; heightCm: number; shirt?: string; pants?: string }[] = [
  { heightCm: 180, appearance: { skinTone: 0, hairStyle: 2, hairColor: 4, trunksColor: '#c0392b', glovesColor: '#e74c3c', build: 'medium', facialHair: 0 } },
  { heightCm: 195, appearance: { skinTone: 5, hairStyle: 3, hairColor: 0, trunksColor: '#f1c40f', glovesColor: '#111111', build: 'bulky', facialHair: 2 } },
  { heightCm: 170, appearance: { skinTone: 2, hairStyle: 5, hairColor: 0, trunksColor: '#27ae60', glovesColor: '#f5f6fa', build: 'slim', facialHair: 1 } },
  { heightCm: 183, appearance: { skinTone: 3, hairStyle: 4, hairColor: 1, trunksColor: '#2e86de', glovesColor: '#2e86de', build: 'medium', facialHair: 0 } },
];
const names = (Object.keys(POSES) as PoseName[]).filter((n) => !n.startsWith('ref'));
const COLS = 8, CW = 120, RH = 175;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const rowsPerLook = Math.ceil(names.length / COLS);
canvas.width = COLS * CW;
canvas.height = looks.length * rowsPerLook * RH + RH;
const g = canvas.getContext('2d')!;
g.fillStyle = '#3c6cb4';
g.fillRect(0, 0, canvas.width, canvas.height);
g.font = '10px monospace';
looks.forEach((look, j) => names.forEach((name, i) => {
  const col = i % COLS, row = j * rowsPerLook + Math.floor(i / COLS);
  g.fillStyle = '#ffffffaa';
  g.fillText(name, col * CW + 4, row * RH + 12);
  drawFighter(g, POSES[name], look, col * CW + 60, row * RH + RH - 8, j % 2 ? -1 : 1);
}));
// Arbitre.
const refLook = { heightCm: 176, shirt: '#f4f4f4', pants: '#202028', appearance: { skinTone: 1, hairStyle: 1, hairColor: 1, trunksColor: '#202028', glovesColor: '#f0b888', build: 'slim' as const, facialHair: 0 } };
(['refStand', 'refCount', 'refWave'] as PoseName[]).forEach((n, i) => drawFighter(g, POSES[n], refLook, 60 + i * CW, canvas.height - 8, 1));
