/**
 * Rendu des boxeurs en pixel art « 16 couleurs » façon console 8-bit (NES).
 *
 * Principe :
 *  1. le squelette de la pose (poses.ts) est agrandi (U pixels par unité) ;
 *  2. chaque partie du corps est une forme mathématique (capsule effilée,
 *     ellipse) rasterisée pixel par pixel dans un tampon ;
 *  3. pour chaque pixel on calcule l'orientation de la surface : on en déduit
 *     un ton (reflet / base / ombre / ombre profonde), lumière en haut à gauche ;
 *  4. chaque partie est entourée d'un trait sombre, sauf contre une partie du
 *     même groupe (cuisse + mollet se fondent sans couture) ;
 *  5. les tons sont traduits en couleurs à partir de l'apparence du boxeur.
 */
import type { Appearance } from '../model/types';
import { HAIR, OUTLINE, SKIN } from './palette';
import type { Pose, Pt } from './poses';

export interface SpriteLook {
  appearance: Appearance;
  heightCm: number;
  /** Tenue d'arbitre : chemise et pantalon, mains nues. */
  shirt?: string;
  pants?: string;
}

/** Pixels fins par unité de pose (le squelette est défini pour ~55 unités de haut). */
export const U = 2.5;
/** Facteur des tailles fixes (dessinées à l'origine pour U = 2). */
const K = U / 2;

// Matériaux (index dans le tampon).
const enum M {
  Empty = 0, Line, Skin, Trunks, Trim, Glove, Cuff, Boot, Sole, Hair, Eye, Dark, Shirt, Pants, White,
}

const BW = 260, BH = 220; // tampon de dessin
const OX = 130, OY = 208; // pieds du boxeur dans le tampon

const mat = new Uint8Array(BW * BH);
const tone = new Uint8Array(BW * BH); // 0 ombre profonde, 1 ombre, 2 base, 3 reflet
const grp = new Uint8Array(BW * BH); // groupe de la partie (pas de trait entre parties d'un même groupe)

// Lumière venant du haut, à gauche, un peu de face.
const LX = -0.5, LY = -0.62, LZ = 0.6;

/** Ton d'un pixel à partir de sa normale 2D (|n| ≤ 1, la composante z est déduite). */
function shade(nx: number, ny: number, darker: number): number {
  const m = Math.min(1, nx * nx + ny * ny);
  const nz = Math.sqrt(1 - m);
  const i = nx * LX + ny * LY + nz * LZ;
  const t = i > 0.72 ? 3 : i > 0.28 ? 2 : i > -0.1 ? 1 : 0;
  return Math.max(0, t - darker);
}

interface Shape {
  /** Distance signée approximative (négative à l'intérieur), et normale au point. */
  sdf(x: number, y: number): { d: number; nx: number; ny: number };
  bbox: [number, number, number, number];
}

/** Capsule effilée de a (rayon ra) à b (rayon rb), avec un renflement optionnel au milieu. */
function capsule(a: Pt, b: Pt, ra: number, rb: number, bulge = 0): Shape {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
  const r = Math.max(ra, rb) + bulge + 2;
  return {
    bbox: [Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r],
    sdf(x, y) {
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const cx = a.x + dx * t, cy = a.y + dy * t;
      const rad = ra + (rb - ra) * t + bulge * Math.sin(Math.PI * t);
      const px = x - cx, py = y - cy, dist = Math.hypot(px, py);
      return { d: dist - rad, nx: px / rad, ny: py / rad };
    },
  };
}

/** Ellipse (éventuellement tournée d'un angle en radians). */
function ellipse(c: Pt, rx: number, ry: number, angle = 0): Shape {
  const cos = Math.cos(angle), sin = Math.sin(angle), r = Math.max(rx, ry) + 2;
  return {
    bbox: [c.x - r, c.y - r, c.x + r, c.y + r],
    sdf(x, y) {
      const px = x - c.x, py = y - c.y;
      const u = (px * cos + py * sin) / rx, v = (-px * sin + py * cos) / ry;
      const k = Math.hypot(u, v);
      // Normale dans le repère de l'écran.
      const nu = u, nv = v;
      return { d: (k - 1) * Math.min(rx, ry), nx: nu * cos - nv * sin, ny: nu * sin + nv * cos };
    },
  };
}

interface PartOpts {
  m: M;
  g: number; // groupe
  darker?: number; // membres arrière plus sombres
  outline?: boolean;
  /** Filtre : ne dessine que les pixels qui satisfont ce test (coordonnées tampon). */
  clip?: (x: number, y: number) => boolean;
  /** Ton imposé (sinon calculé). */
  flatTone?: number;
}

/** Dessine une forme dans le tampon : trait extérieur puis remplissage ombré. */
function draw(s: Shape, o: PartOpts): void {
  const [x0, y0, x1, y1] = s.bbox;
  const xa = Math.max(0, Math.floor(x0)), xb = Math.min(BW - 1, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(BH - 1, Math.ceil(y1));
  const outline = o.outline !== false;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      if (o.clip && !o.clip(x, y)) continue;
      const { d, nx, ny } = s.sdf(x + 0.5, y + 0.5);
      const i = y * BW + x;
      if (d <= 0) {
        mat[i] = o.m;
        grp[i] = o.g;
        tone[i] = o.flatTone ?? shade(nx, ny, o.darker ?? 0);
      } else if (outline && d <= 1.15 && (mat[i] === M.Empty || grp[i] !== o.g)) {
        mat[i] = M.Line;
        grp[i] = o.g;
      }
    }
  }
}

/** Pose un pixel de détail (œil, sourcil…). */
function dot(x: number, y: number, m: M, t = 2): void {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= BW || y >= BH) return;
  const i = y * BW + x;
  mat[i] = m;
  tone[i] = t;
}

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const BLACK: [number, number, number] = [20, 14, 28];
const WHITE_: [number, number, number] = [255, 250, 236];

/** Rampe de 4 tons à partir d'une couleur de base (ombres légèrement bleutées, reflets chauds). */
function ramp(base: string): [number, number, number][] {
  const b = hex(base);
  return [mix(b, BLACK, 0.62), mix(b, BLACK, 0.34), b, mix(b, WHITE_, 0.42)];
}

function skinRamp(tone_: number): [number, number, number][] {
  const [base, shadow] = SKIN[tone_] ?? SKIN[0]!;
  const b = hex(base), s = hex(shadow);
  return [mix(s, BLACK, 0.35), s, b, mix(b, WHITE_, 0.35)];
}

const cache = new Map<string, Record<number, [number, number, number][]>>();

function palette(look: SpriteLook): Record<number, [number, number, number][]> {
  const ap = look.appearance;
  const key = `${ap.skinTone}|${ap.hairColor}|${ap.trunksColor}|${ap.glovesColor}|${look.shirt}|${look.pants}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const trunks = hex(ap.trunksColor);
  const lightTrunks = trunks[0] + trunks[1] + trunks[2] > 560;
  const p: Record<number, [number, number, number][]> = {
    [M.Line]: [hex(OUTLINE), hex(OUTLINE), hex(OUTLINE), hex(OUTLINE)],
    [M.Skin]: skinRamp(ap.skinTone),
    [M.Trunks]: ramp(ap.trunksColor),
    [M.Trim]: ramp(lightTrunks ? '#283048' : '#f2f2ea'),
    [M.Glove]: ramp(ap.glovesColor),
    [M.Cuff]: ramp('#efefe6'),
    [M.Boot]: ramp(lightTrunks ? '#30303c' : '#ecebe4'),
    [M.Sole]: ramp('#3a3440'),
    [M.Hair]: ramp(HAIR[ap.hairColor] ?? HAIR[0]!),
    [M.Eye]: [hex(OUTLINE), hex(OUTLINE), hex(OUTLINE), WHITE_],
    [M.Dark]: [hex(OUTLINE), mix(hex((SKIN[ap.skinTone] ?? SKIN[0]!)[1]), BLACK, 0.5), mix(hex((SKIN[ap.skinTone] ?? SKIN[0]!)[1]), BLACK, 0.5), hex(OUTLINE)],
    [M.Shirt]: ramp(look.shirt ?? '#f4f4f4'),
    [M.Pants]: ramp(look.pants ?? '#202028'),
    [M.White]: [WHITE_, WHITE_, WHITE_, WHITE_],
  };
  cache.set(key, p);
  return p;
}

// ---------------------------------------------------------------------------
// Construction du boxeur
// ---------------------------------------------------------------------------

const BUILD = {
  slim: { torso: 0.86, arm: 0.86, leg: 0.92 },
  medium: { torso: 1, arm: 1, leg: 1 },
  bulky: { torso: 1.16, arm: 1.18, leg: 1.08 },
} as const;

// Groupes (pas de trait entre deux parties d'un même groupe).
const G = { armR: 1, legR: 2, body: 3, legF: 4, trunks: 5, head: 6, armF: 7, gloveR: 8, gloveF: 9, hair: 10 };

function renderToBuffer(pose: Pose, look: SpriteLook): void {
  mat.fill(0); tone.fill(0); grp.fill(0);
  const ap = look.appearance;
  const bb = BUILD[ap.build];
  const b = { torso: bb.torso * K, arm: bb.arm * K, leg: bb.leg * K };
  const sy = Math.max(0.92, Math.min(1.1, look.heightCm / 180));
  const P = (p: Pt): Pt => ({ x: OX + p.x * U, y: OY + p.y * U * sy });
  const ref = !!look.shirt;
  const hip = P(pose.hip), sh = P(pose.shoulder), neck = P(pose.head);
  const axis = { x: sh.x - hip.x, y: sh.y - hip.y };
  const alen = Math.hypot(axis.x, axis.y) || 1;
  const ux = axis.x / alen, uy = axis.y / alen; // de la hanche vers les épaules
  const lerp = (a: Pt, c: Pt, t: number): Pt => ({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t });

  const shoulderF: Pt = { x: sh.x + 3 * b.torso, y: sh.y + 2 * K };
  const shoulderR: Pt = { x: sh.x - 4 * b.torso, y: sh.y + 2 * K };

  // --- Bras arrière -------------------------------------------------------
  const arm = (s: Pt, e: Pt, w: Pt, g: number, gg: number, darker: number) => {
    const sleeve = ref ? M.Shirt : M.Skin;
    draw(capsule(s, P(e as Pt), 4.6 * b.arm, 3.6 * b.arm, 1.1 * b.arm), { m: sleeve, g, darker });
    draw(capsule(P(e as Pt), P(w as Pt), 3.7 * b.arm, 3 * b.arm, 0.5 * K), { m: M.Skin, g, darker });
    const W = P(w as Pt), E = P(e as Pt);
    const ang = Math.atan2(W.y - E.y, W.x - E.x);
    if (ref) {
      draw(ellipse(W, 3.2 * K, 3 * K), { m: M.Skin, g: gg, darker });
      return;
    }
    // Gant : gros ovale orienté dans l'axe de l'avant-bras, manchette blanche côté poignet.
    const gc: Pt = { x: W.x + Math.cos(ang) * 2.5 * K, y: W.y + Math.sin(ang) * 2.5 * K };
    draw(ellipse(gc, 7.4 * K, 6.4 * K, ang), { m: M.Glove, g: gg, darker });
    const cuffLimit = (x: number, y: number) => (x - gc.x) * Math.cos(ang) + (y - gc.y) * Math.sin(ang) < -4.6 * K;
    draw(ellipse(gc, 7.4 * K, 6.4 * K, ang), { m: M.Cuff, g: gg, darker, clip: cuffLimit, outline: false });
    // Reflet du gant.
    for (const [dx, dy] of [[-3, -4], [-2, -4], [-3, -3], [-1, -4], [-2, -3]] as const) dot(gc.x + dx * K, gc.y + dy * K, M.Glove, 3);
  };
  arm(shoulderR, pose.elbowR, pose.gloveR, G.armR, G.gloveR, 1);

  // --- Jambes -------------------------------------------------------------
  const leg = (knee: Pt, foot: Pt, g: number, darker: number) => {
    const Kn = P(knee), F = P(foot);
    const pants = ref ? M.Pants : M.Skin;
    draw(capsule(lerp(hip, Kn, 0.1), Kn, 6.2 * b.leg, 4.4 * b.leg, 0.6 * K), { m: pants, g, darker });
    const ankle: Pt = { x: F.x, y: F.y - 6 * K };
    draw(capsule(Kn, ankle, 4.4 * b.leg, 3 * b.leg, 1.3 * b.leg), { m: pants, g, darker });
    if (ref) {
      draw(capsule({ x: F.x - K, y: F.y - 2 * K }, { x: F.x + 6 * K, y: F.y - 1.5 * K }, 2.6 * K, 2.2 * K), { m: M.Sole, g, darker });
      return;
    }
    // Bottine de boxe montante, semelle sombre.
    draw(capsule({ x: F.x, y: F.y - 11 * K }, { x: F.x, y: F.y - 3 * K }, 3.8 * K, 3.9 * K), { m: M.Boot, g, darker });
    draw(capsule({ x: F.x - K, y: F.y - 2.5 * K }, { x: F.x + 6.5 * K, y: F.y - 2 * K }, 3 * K, 2.6 * K), { m: M.Boot, g, darker });
    draw(capsule({ x: F.x - 2 * K, y: F.y }, { x: F.x + 7.5 * K, y: F.y }, 1.1 * K, 1.1 * K), { m: M.Sole, g, darker, outline: false });
    // Lacets.
    for (let k = 0; k < 3; k++) dot(F.x + 2 * K, F.y - (10 - k * 2.5) * K, M.Sole, 1);
  };
  leg(pose.kneeR, pose.footR, G.legR, 1);

  // --- Torse --------------------------------------------------------------
  const torsoTop = lerp(hip, sh, 0.98);
  draw(capsule(hip, torsoTop, 7.6 * b.torso, 9.6 * b.torso, 0.6 * K), { m: ref ? M.Shirt : M.Skin, g: G.body });
  // Deltoïde avant (épaule arrondie).
  draw(ellipse({ x: shoulderF.x, y: shoulderF.y + K }, 5.2 * b.arm, 4.6 * b.arm), { m: ref ? M.Shirt : M.Skin, g: G.body });
  if (!ref) {
    // Musculature : ligne des pectoraux et des abdominaux (ombres légères).
    const at = (v: number, w: number): Pt => ({ x: hip.x + ux * v * alen - uy * w, y: hip.y + uy * v * alen + ux * w });
    for (let w = -6; w <= 5; w++) {
      const v = 0.7 - Math.abs(w + 0.5) * 0.012 * (w > 0 ? 2.2 : 1);
      const p = at(v, w * b.torso);
      if (mat[Math.round(p.y) * BW + Math.round(p.x)] === M.Skin) dot(p.x, p.y, M.Skin, 1);
    }
    for (let v = 0.24; v <= 0.6; v += 0.04) {
      const p = at(v, 1.5 * b.torso);
      if (mat[Math.round(p.y) * BW + Math.round(p.x)] === M.Skin) dot(p.x, p.y, M.Skin, 1);
    }
    for (const v of [0.34, 0.47]) for (let w = -1; w <= 4; w++) {
      const p = at(v, w * b.torso);
      if (mat[Math.round(p.y) * BW + Math.round(p.x)] === M.Skin) dot(p.x, p.y, M.Skin, 1);
    }
  }

  // --- Jambe avant + short -------------------------------------------------
  leg(pose.kneeF, pose.footF, G.legF, 0);
  if (ref) {
    draw(capsule({ x: hip.x - K, y: hip.y - 3 * K }, { x: hip.x + K, y: hip.y + 3 * K }, 8.4 * b.torso, 8.4 * b.torso), { m: M.Pants, g: G.trunks });
    for (let k = 3; k <= 5; k++) dot(sh.x + k * K, sh.y + 2 * K, M.Dark, 0);
  } else {
    const KF = P(pose.kneeF), KR = P(pose.kneeR);
    // Position le long du torse (0 = hanche) : le short s'arrête net à la taille.
    const along = (x: number, y: number) => (x + 0.5 - hip.x) * ux + (y + 0.5 - hip.y) * uy;
    const belowWaist = (x: number, y: number) => along(x, y) < 7.5 * K;
    // Le short : bloc de la taille + jambes amples jusqu'à mi-cuisse.
    draw(capsule(hip, lerp(hip, KR, 0.5), 7.6 * b.leg, 6.8 * b.leg), { m: M.Trunks, g: G.trunks, darker: 1, clip: belowWaist });
    draw(capsule(hip, lerp(hip, KF, 0.52), 7.8 * b.leg, 7 * b.leg), { m: M.Trunks, g: G.trunks, clip: belowWaist });
    const waistTop = { x: hip.x + ux * 7 * K, y: hip.y + uy * 7 * K };
    draw(capsule(waistTop, { x: hip.x - ux * 2, y: hip.y - uy * 2 }, 8.6 * b.torso, 8.4 * b.torso), { m: M.Trunks, g: G.trunks, clip: belowWaist });
    // Ceinture : une bande étroite en haut du short.
    draw(capsule(waistTop, { x: hip.x - ux * 2, y: hip.y - uy * 2 }, 8.6 * b.torso, 8.4 * b.torso), {
      m: M.Trim, g: G.trunks, outline: false,
      clip: (x, y) => { const a = along(x, y); return a > 4.3 * K && a < 7.5 * K && mat[y * BW + x] === M.Trunks; },
    });
  }

  // --- Tête -----------------------------------------------------------------
  const HS = 1.15 * K; // tête un peu plus grosse : proportions « dessin animé » des jeux 8-bit
  const C: Pt = { x: neck.x + 3 * HS, y: neck.y - 13 * HS }; // centre du crâne
  draw(capsule({ x: sh.x + K, y: sh.y + K }, { x: neck.x + K, y: neck.y - 4 * K }, 4.6 * b.torso, 4.2 * K), { m: M.Skin, g: G.head });
  draw(ellipse(C, 9 * HS, 9.6 * HS), { m: M.Skin, g: G.head });
  draw(ellipse({ x: C.x + 3.6 * HS, y: C.y + 5 * HS }, 6.8 * HS, 5.6 * HS, 0.25), { m: M.Skin, g: G.head }); // mâchoire
  draw(ellipse({ x: C.x + 9 * HS, y: C.y + 0.5 * K }, 2.4 * K, 2.7 * K, 0.3), { m: M.Skin, g: G.head }); // nez
  // Oreille.
  draw(ellipse({ x: C.x - 1.5 * K, y: C.y + 1.5 * HS }, 2.2 * K, 3.2 * K), { m: M.Skin, g: G.hair + 1, darker: 1 });

  // Cheveux selon la coiffure (régions définies autour du centre du crâne).
  const rel = (x: number, y: number) => ({ dx: (x + 0.5 - C.x) / HS, dy: (y + 0.5 - C.y) / HS });
  const skull = ellipse(C, 10 * HS, 10.6 * HS);
  const inSkull = (x: number, y: number) => skull.sdf(x + 0.5, y + 0.5).d <= 0.2;
  switch (ap.hairStyle) {
    case 1: // ras
      draw(ellipse(C, 9.6 * HS, 10.2 * HS), { m: M.Hair, g: G.hair, clip: (x, y) => { const { dx, dy } = rel(x, y); return dy < -3.5 + Math.max(0, -dx) * 0.5 && dx < 6; } });
      break;
    case 2: // court
      draw(ellipse({ x: C.x - 0.5 * HS, y: C.y - 0.8 * HS }, 10.2 * HS, 10.6 * HS), { m: M.Hair, g: G.hair, clip: (x, y) => { const { dx, dy } = rel(x, y); return (dy < -3 && dx < 7.5) || (dx < -4 && dy < 5) || (dx > -2 && dx < 1 && dy < 3); } });
      break;
    case 3: // afro
      draw(ellipse({ x: C.x - 2.5 * HS, y: C.y - 5 * HS }, 14 * HS, 12.5 * HS), { m: M.Hair, g: G.hair, clip: (x, y) => { const { dx, dy } = rel(x, y); return !(dx > 1.5 && dy > -4) && !(dx > -2 && dy > 1); } });
      break;
    case 4: // queue de cheval
      draw(ellipse({ x: C.x - 0.5 * HS, y: C.y - 0.8 * HS }, 10.2 * HS, 10.6 * HS), { m: M.Hair, g: G.hair, clip: (x, y) => { const { dx, dy } = rel(x, y); return (dy < -3 && dx < 7.5) || (dx < -4 && dy < 3); } });
      draw(capsule({ x: C.x - 9 * HS, y: C.y - 1 * HS }, { x: C.x - 11.5 * HS, y: C.y + 11 * HS }, 2.8 * K, 1.6 * K, 0.6 * K), { m: M.Hair, g: G.hair });
      break;
    case 5: // mohawk : crête au sommet
      draw(ellipse({ x: C.x - 1.5 * HS, y: C.y - 7 * HS }, 10 * HS, 8 * HS), { m: M.Hair, g: G.hair, clip: (x, y) => { const { dx, dy } = rel(x, y); return !inSkull(x, y) || (dy < -8 && dx < 5); } });
      break;
    default: break; // chauve : le crâne brille naturellement
  }
  // Barbe / moustache.
  if (ap.facialHair === 2) {
    draw(ellipse({ x: C.x + 3.6 * HS, y: C.y + 5.5 * HS }, 7.2 * HS, 6 * HS), { m: M.Hair, g: G.head, outline: false, clip: (x, y) => { const { dx, dy } = rel(x, y); return dy > 3 && dx > -3 && mat[y * BW + x] === M.Skin; } });
  }
  if (ap.facialHair >= 1) for (let k = 0; k < 4; k++) dot(C.x + (6 + k) * HS, C.y + 4.5 * HS, M.Hair, 1);
  // Visage : sourcil, œil (blanc + pupille), bouche.
  const F = (dx: number, dy: number): [number, number] => [C.x + dx * HS, C.y + dy * HS];
  for (let k = 0; k < 4; k++) dot(...F(4 + k, -3.2), M.Hair, 0);
  dot(...F(6.2, -1), M.Eye, 0); dot(...F(6.2, 0), M.Eye, 0); dot(...F(5.3, -1), M.White, 3); dot(...F(5.3, 0), M.White, 3);
  dot(...F(7, 6.5), M.Dark, 1); dot(...F(8, 6.5), M.Dark, 1);
  if (!ap.facialHair) dot(...F(6, 6.5), M.Dark, 1);

  // --- Bras avant (devant tout) -------------------------------------------
  arm(shoulderF, pose.elbowF, pose.gloveF, G.armF, G.gloveF, 0);
}

// ---------------------------------------------------------------------------
// Sortie
// ---------------------------------------------------------------------------

let scratch: HTMLCanvasElement | null = null;
let image: ImageData | null = null;

/**
 * Dessine un boxeur dont les pieds sont en (x, groundY) sur le canvas
 * (U pixels par unité de pose), tourné vers la droite (1) ou la gauche (-1).
 */
export function drawFighter(
  g: CanvasRenderingContext2D, pose: Pose, look: SpriteLook, x: number, groundY: number, facing: 1 | -1,
): void {
  renderToBuffer(pose, look);
  const pal = palette(look);
  scratch ??= document.createElement('canvas');
  if (scratch.width !== BW) { scratch.width = BW; scratch.height = BH; }
  const sg = scratch.getContext('2d')!;
  image ??= sg.createImageData(BW, BH);
  const data = image.data;
  data.fill(0);
  for (let y = 0; y < BH; y++) {
    for (let xx = 0; xx < BW; xx++) {
      const i = y * BW + xx, m = mat[i]!;
      if (!m) continue;
      const c = pal[m]![tone[i]!]!;
      const ox = facing === 1 ? xx : BW - 1 - xx;
      const o = (y * BW + ox) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
  }
  sg.putImageData(image, 0, 0);
  const left = facing === 1 ? OX : BW - 1 - OX;
  g.drawImage(scratch, Math.round(x - left), Math.round(groundY - OY));
}

/** Position écran d'un point de la pose (pour placer les étincelles d'impact). */
export function posePoint(pt: Pt, x: number, groundY: number, facing: 1 | -1, heightCm: number): Pt {
  const sy = Math.max(0.92, Math.min(1.1, heightCm / 180));
  return { x: x + facing * pt.x * U, y: groundY + pt.y * U * sy };
}
