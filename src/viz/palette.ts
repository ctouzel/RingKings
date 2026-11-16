/**
 * Palette rétro (inspirée des consoles 8-bit, couleurs choisies pour RingKings).
 * Les indices de peau / cheveux correspondent à Boxer.appearance.
 */
export const OUTLINE = '#141018';

/** 6 teintes de peau : [couleur, ombre]. */
export const SKIN: [string, string][] = [
  ['#f8d0b0', '#d8a080'],
  ['#f0b888', '#c88858'],
  ['#d89860', '#a86c38'],
  ['#b87440', '#8a5028'],
  ['#8c5430', '#643818'],
  ['#5c3418', '#3c2010'],
];

/** 5 couleurs de cheveux : noir, brun foncé, brun, blond, roux. */
export const HAIR = ['#201818', '#4a2c18', '#7a4a20', '#e0b848', '#c05020'];

export const RING = {
  floor: '#3c78c8', floorLight: '#5890d8', apron: '#202838', apronText: '#f8c818',
  rope: '#f8f8f8', ropeRed: '#e04040', ropeBlue: '#3868e0', post: '#d8d8d8',
  lights: '#fff8c0',
};

export const CROWD = ['#382838', '#483850', '#584060', '#303048', '#604848', '#405058', '#504030', '#283040'];
