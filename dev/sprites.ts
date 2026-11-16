/** Galerie : une ligne par apparence, une colonne par pose (npm run dev puis /dev/sprites.html). */
import { drawFighter } from '../src/viz/fighterSprite';
import { POSES, type PoseName } from '../src/viz/poses';
import type { Appearance } from '../src/model/types';

const looks: { appearance: Appearance; heightCm: number }[] = [
  { heightCm: 180, appearance: { skinTone: 0, hairStyle: 2, hairColor: 4, trunksColor: '#c0392b', glovesColor: '#e74c3c', build: 'medium', facialHair: 0 } },
  { heightCm: 195, appearance: { skinTone: 5, hairStyle: 3, hairColor: 0, trunksColor: '#f1c40f', glovesColor: '#111111', build: 'bulky', facialHair: 2 } },
  { heightCm: 170, appearance: { skinTone: 2, hairStyle: 5, hairColor: 0, trunksColor: '#27ae60', glovesColor: '#f5f6fa', build: 'slim', facialHair: 1 } },
  { heightCm: 183, appearance: { skinTone: 3, hairStyle: 4, hairColor: 1, trunksColor: '#2e86de', glovesColor: '#2e86de', build: 'medium', facialHair: 0 } },
];
const names = Object.keys(POSES) as PoseName[];
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = 20 + names.length * 46;
canvas.height = 30 + looks.length * 72;
const g = canvas.getContext('2d')!;
g.font = '7px monospace';
g.fillStyle = '#fff';
names.forEach((name, i) => g.fillText(name, 6 + i * 46, 12));
looks.forEach((look, j) => names.forEach((name, i) => {
  // Une ligne sur deux regarde vers la gauche (coin bleu).
  drawFighter(g, POSES[name], look, 28 + i * 46, 82 + j * 72, j % 2 ? -1 : 1);
}));
