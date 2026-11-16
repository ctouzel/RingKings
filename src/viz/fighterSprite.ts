/**
 * Dessin d'un boxeur "pantin" en pixel art, à partir d'une pose et de son apparence.
 * Deux passes : d'abord la silhouette élargie en couleur de contour (le trait noir
 * typique du 8-bit), puis les couleurs. Les membres arrière sont dans l'ombre.
 */
import type { Appearance } from '../model/types';
import { FACE, FACIAL_HAIR, GLOVE, HAIR_STYLES, HAND, type Grid } from './heads';
import { HAIR, OUTLINE, SKIN } from './palette';
import type { Pose, Pt } from './poses';

export interface SpriteLook {
  appearance: Appearance;
  heightCm: number;
  /** Tenue d'arbitre : chemise et pantalon, mains nues. */
  shirt?: string;
  pants?: string;
}

type Mode = 'outline' | 'fill';

interface Ctx {
  g: CanvasRenderingContext2D;
  ox: number; // position des pieds à l'écran
  oy: number;
  facing: 1 | -1;
  sy: number; // échelle verticale (taille du boxeur)
}

const BUILD = {
  slim: { torso: 7, arm: 3, leg: 4 },
  medium: { torso: 9, arm: 3, leg: 4 },
  bulky: { torso: 11, arm: 4, leg: 5 },
} as const;

function screen(c: Ctx, pt: Pt): Pt {
  return { x: c.ox + c.facing * pt.x, y: c.oy + pt.y * c.sy };
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.g.fillStyle = color;
  c.g.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Segment épais (tampons carrés le long de la ligne). */
function limb(c: Ctx, a: Pt, b: Pt, thick: number, color: string, mode: Mode) {
  const A = screen(c, a), B = screen(c, b);
  const t = mode === 'outline' ? thick + 2 : thick;
  const steps = Math.max(1, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) * 2));
  c.g.fillStyle = mode === 'outline' ? OUTLINE : color;
  for (let i = 0; i <= steps; i++) {
    const x = A.x + ((B.x - A.x) * i) / steps, y = A.y + ((B.y - A.y) * i) / steps;
    c.g.fillRect(Math.round(x - t / 2), Math.round(y - t / 2), t, t);
  }
}

/** Grille de pixels (tête, gant), ancrée sur un point, retournée selon le regard. */
function grid(c: Ctx, rows: Grid, anchor: Pt, ax: number, ay: number, colors: Record<string, string>, mode: Mode) {
  const A = screen(c, anchor);
  rows.forEach((row, r) => {
    for (let col = 0; col < row.length; col++) {
      const ch = row[col]!;
      if (ch === '.' || !colors[ch]) continue;
      const x = c.facing === 1 ? A.x - ax + col : A.x + ax - col - 1;
      const y = A.y - ay + r;
      if (mode === 'outline') rect(c, x - 1, y - 1, 3, 3, OUTLINE);
      else rect(c, x, y, 1, 1, colors[ch]!);
    }
  });
}

/** Superpose plusieurs grilles (visage + cheveux + barbe) en une seule. */
function composeHead(hair: number, facial: number): string[] {
  const out = FACE.map((r) => r.split(''));
  for (const layer of [HAIR_STYLES[hair] ?? [], FACIAL_HAIR[facial] ?? []]) {
    layer.forEach((row, r) => {
      for (let col = 0; col < row.length; col++) if (row[col] !== '.' && out[r]) out[r]![col] = row[col]!;
    });
  }
  return out.map((r) => r.join(''));
}

const headCache = new Map<string, string[]>();

export function drawFighter(
  g: CanvasRenderingContext2D, pose: Pose, look: SpriteLook, x: number, groundY: number, facing: 1 | -1,
): void {
  const ap = look.appearance;
  const c: Ctx = { g, ox: x, oy: groundY, facing, sy: Math.max(0.92, Math.min(1.1, look.heightCm / 180)) };
  const b = BUILD[ap.build];
  const [skin, shade] = SKIN[ap.skinTone] ?? SKIN[0]!;
  const hairColor = HAIR[ap.hairColor] ?? HAIR[0]!;
  const key = `${ap.hairStyle}|${ap.facialHair}`;
  if (!headCache.has(key)) headCache.set(key, composeHead(ap.hairStyle, ap.facialHair));
  const head = headCache.get(key)!;
  const headColors = { S: skin, L: shade, E: OUTLINE, M: shade, H: hairColor, F: hairColor };
  const gloveColors = look.shirt ? { C: skin, K: skin } : { C: ap.glovesColor, K: '#ffffff' };
  const top = look.shirt ?? skin, armTop = look.shirt ?? skin, legCol = look.pants;
  const gloveGrid = look.shirt ? HAND : GLOVE;
  const mid = (a: Pt, z: Pt): Pt => ({ x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 });
  const shoeOf = (foot: Pt): Pt => ({ x: foot.x + 1, y: foot.y - 1 });

  for (const mode of ['outline', 'fill'] as const) {
    // Bras arrière (dans l'ombre).
    limb(c, pose.shoulder, pose.elbowR, b.arm, look.shirt ?? shade, mode);
    limb(c, pose.elbowR, pose.gloveR, b.arm, shade, mode);
    grid(c, gloveGrid, pose.gloveR, 3, 2, gloveColors, mode);
    // Jambes : arrière puis avant, short en haut, chaussures en bas.
    for (const [knee, foot, col] of [[pose.kneeR, pose.footR, shade], [pose.kneeF, pose.footF, skin]] as const) {
      limb(c, pose.hip, knee, b.leg, legCol ?? col, mode);
      limb(c, mid(pose.hip, knee), pose.hip, b.leg + 1, legCol ?? ap.trunksColor, mode);
      limb(c, knee, foot, b.leg, legCol ?? col, mode);
      limb(c, shoeOf(foot), { x: foot.x + 3, y: foot.y - 1 }, 3, legCol ? OUTLINE : '#f0f0f0', mode);
    }
    // Torse et short.
    limb(c, pose.hip, pose.shoulder, b.torso, top, mode);
    limb(c, { x: pose.hip.x, y: pose.hip.y + 2 }, { x: pose.hip.x, y: pose.hip.y - 2 }, b.torso + 2, legCol ?? ap.trunksColor, mode);
    if (mode === 'fill' && look.shirt) {
      // Nœud papillon de l'arbitre.
      const n = screen(c, { x: pose.shoulder.x + 1, y: pose.shoulder.y + 1 });
      rect(c, n.x - 1, n.y, 3, 1, OUTLINE);
    } else if (mode === 'fill') {
      // Ceinture du short.
      const w = screen(c, { x: pose.hip.x, y: pose.hip.y - 3 });
      rect(c, w.x - (b.torso + 2) / 2, w.y, b.torso + 2, 1, '#f0f0f0');
    }
    // Tête (ancrée sur le bas du cou).
    grid(c, head, pose.head, 6, 14, headColors, mode);
    // Bras avant.
    limb(c, pose.shoulder, pose.elbowF, b.arm, armTop, mode);
    limb(c, pose.elbowF, pose.gloveF, b.arm, skin, mode);
    grid(c, gloveGrid, pose.gloveF, 3, 2, gloveColors, mode);
  }
}

/** Position écran d'un point de la pose (pour placer les étincelles d'impact). */
export function posePoint(pt: Pt, x: number, groundY: number, facing: 1 | -1, heightCm: number): Pt {
  const sy = Math.max(0.92, Math.min(1.1, heightCm / 180));
  return { x: x + facing * pt.x, y: groundY + pt.y * sy };
}
