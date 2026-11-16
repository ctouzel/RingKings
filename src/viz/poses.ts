/**
 * Poses du "pantin" (boxeur tourné vers la droite).
 * Coordonnées en pixels, relatives au milieu des pieds au sol : x vers l'avant,
 * y vers le bas (donc négatif = en hauteur). Le dessin interpole entre deux poses.
 *
 * Pour ajuster une animation, il suffit de déplacer ces points.
 */
export interface Pt { x: number; y: number }

export interface Pose {
  hip: Pt;
  shoulder: Pt; // milieu des épaules
  head: Pt; // bas du cou
  elbowF: Pt; gloveF: Pt; // bras avant (main avant)
  elbowR: Pt; gloveR: Pt; // bras arrière
  kneeF: Pt; footF: Pt;
  kneeR: Pt; footR: Pt;
}

const p = (x: number, y: number): Pt => ({ x, y });

export const GUARD: Pose = {
  hip: p(0, -20), shoulder: p(1, -35), head: p(2, -37),
  elbowF: p(8, -28), gloveF: p(11, -37),
  elbowR: p(3, -27), gloveR: p(7, -39),
  kneeF: p(6, -10), footF: p(7, 0),
  kneeR: p(-5, -10), footR: p(-7, 0),
};

/** Poses "extrêmes" : le coup est porté au maximum (progression 1). */
export const POSES = {
  guard: GUARD,
  jab: { ...GUARD, shoulder: p(3, -35), head: p(4, -37), elbowF: p(15, -36), gloveF: p(23, -38) },
  cross: { ...GUARD, shoulder: p(4, -35), head: p(5, -37), elbowF: p(8, -30), gloveF: p(10, -38), elbowR: p(13, -35), gloveR: p(23, -37), footR: p(-6, 0) },
  hook: { ...GUARD, shoulder: p(3, -35), head: p(3, -37), elbowF: p(14, -39), gloveF: p(20, -38), elbowR: p(4, -28), gloveR: p(7, -38) },
  uppercut: { ...GUARD, hip: p(1, -19), shoulder: p(4, -34), head: p(5, -36), elbowR: p(13, -30), gloveR: p(18, -43), elbowF: p(8, -29), gloveF: p(10, -37) },
  body: { ...GUARD, hip: p(1, -18), shoulder: p(5, -32), head: p(7, -34), elbowF: p(13, -27), gloveF: p(20, -26), kneeF: p(8, -9), kneeR: p(-4, -9) },
  hit: { ...GUARD, shoulder: p(-2, -35), head: p(-3, -36), elbowF: p(6, -27), gloveF: p(8, -33), elbowR: p(0, -27), gloveR: p(3, -34) },
  hitBody: { ...GUARD, hip: p(-1, -18), shoulder: p(3, -31), head: p(5, -33), elbowF: p(7, -24), gloveF: p(9, -27), elbowR: p(2, -24), gloveR: p(5, -28), kneeF: p(6, -9), kneeR: p(-5, -9) },
  slip: { ...GUARD, hip: p(-1, -19), shoulder: p(-3, -32), head: p(-3, -34), elbowF: p(5, -26), gloveF: p(8, -34), elbowR: p(-1, -25), gloveR: p(3, -35), kneeF: p(5, -9) },
  clinch: { ...GUARD, shoulder: p(4, -34), head: p(6, -36), elbowF: p(12, -32), gloveF: p(15, -36), elbowR: p(9, -28), gloveR: p(13, -31) },
  victory: { ...GUARD, shoulder: p(0, -36), head: p(1, -38), elbowF: p(6, -45), gloveF: p(7, -54), elbowR: p(-4, -45), gloveR: p(-4, -54), footF: p(5, 0), footR: p(-5, 0) },
  kneel: { hip: p(-2, -12), shoulder: p(1, -26), head: p(2, -28), elbowF: p(6, -18), gloveF: p(9, -6), elbowR: p(0, -18), gloveR: p(3, -10), kneeF: p(7, -10), footF: p(7, 0), kneeR: p(-2, 0), footR: p(-10, 0) },
  down: { hip: p(-4, -4), shoulder: p(-18, -5), head: p(-21, -6), elbowF: p(-14, -10), gloveF: p(-10, -13), elbowR: p(-20, -9), gloveR: p(-16, -12), kneeF: p(5, -8), footF: p(12, -1), kneeR: p(4, -5), footR: p(13, -1) },
  // Arbitre.
  refStand: { ...GUARD, shoulder: p(0, -36), head: p(1, -38), elbowF: p(3, -28), gloveF: p(4, -21), elbowR: p(-3, -28), gloveR: p(-3, -21), footF: p(4, 0), footR: p(-4, 0), kneeF: p(4, -10), kneeR: p(-4, -10) },
  refCount: { ...GUARD, hip: p(1, -19), shoulder: p(4, -33), head: p(6, -35), elbowF: p(10, -36), gloveF: p(12, -44), elbowR: p(-1, -27), gloveR: p(1, -21), footF: p(6, 0), footR: p(-5, 0) },
  refWave: { ...GUARD, shoulder: p(0, -36), head: p(1, -38), elbowF: p(7, -40), gloveF: p(-4, -44), elbowR: p(-6, -40), gloveR: p(5, -44), footF: p(5, 0), footR: p(-5, 0) },
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    out[k] = { x: a[k].x + (b[k].x - a[k].x) * t, y: a[k].y + (b[k].y - a[k].y) * t };
  }
  return out;
}

/** Courbe d'un coup : départ rapide, impact au milieu, retour plus lent. */
export function punchCurve(t: number): number {
  if (t < 0.4) return Math.sin((t / 0.4) * (Math.PI / 2));
  return Math.max(0, 1 - (t - 0.4) / 0.6) ** 1.5;
}

/** Courbe d'une réaction (encaisser / esquiver). */
export function reactCurve(t: number): number {
  return Math.sin(Math.min(1, t) * Math.PI);
}
