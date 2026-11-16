/**
 * Têtes en pixel art, vues de profil (tournées vers la droite).
 * Grilles de 12×14 caractères :
 *   . transparent   S peau   L ombre de peau   E œil   M bouche
 *   H cheveux       F barbe/moustache (couleur des cheveux)
 * Pour créer une nouvelle coiffure, ajoute une grille à HAIR_STYLES :
 * chaque 'H' recouvre la case correspondante du visage.
 */
export type Grid = readonly string[];

export const FACE: Grid = [
  '............',
  '............',
  '...SSSSS....',
  '..SSSSSSS...',
  '..SSSSSSSS..',
  '..LSSSSSESS.',
  '..LSSSSSSSS.',
  '..LSSSSSSSSS',
  '..LSSSSSSSS.',
  '..LSSSSSMMS.',
  '...LSSSSSS..',
  '....LSSSS...',
  '....LSSS....',
  '....LSSS....',
];

/** Index = appearance.hairStyle : 0 chauve, 1 ras, 2 court, 3 afro, 4 queue, 5 mohawk. */
export const HAIR_STYLES: Grid[] = [
  [],
  [
    '............',
    '............',
    '...HHHHH....',
    '..HHHHHHH...',
    '..HH........',
  ],
  [
    '............',
    '...HHHHH....',
    '..HHHHHHHH..',
    '.HHHHHHHH...',
    '.HHHH.......',
    '.HHH........',
    '..HH........',
  ],
  [
    '...HHHHHH...',
    '.HHHHHHHHHH.',
    'HHHHHHHHHHH.',
    'HHHHHHHHHH..',
    'HHHHHH......',
    'HHHH........',
    '.HHH........',
    '.HH.........',
  ],
  [
    '............',
    '...HHHHH....',
    '..HHHHHHHH..',
    '.HHHHHHHH...',
    'HHHHH.......',
    'HHH.........',
    'HH..........',
    'H...........',
  ],
  [
    '....HHH.....',
    '...HHHHH....',
    '....HHHH....',
  ],
];

/** Index = appearance.facialHair : 0 aucun, 1 moustache, 2 barbe. */
export const FACIAL_HAIR: Grid[] = [
  [],
  [
    '', '', '', '', '', '', '', '',
    '.......FFF..',
  ],
  [
    '', '', '', '', '', '', '',
    '...........F',
    '......FFFFF.',
    '...FFFFFFFF.',
    '...FFFFFFF..',
    '....FFFFF...',
  ],
];

/** Gant de boxe (6×5), C = couleur du gant, K = reflet. */
export const GLOVE: Grid = [
  '.CCCC.',
  'CKCCCC',
  'CCCCCC',
  'CCCCCC',
  '.CCCC.',
];

/** Main nue (arbitre), 6×5 : seules les cases C sont dessinées. */
export const HAND: Grid = [
  '......',
  '..CC..',
  '.CCCC.',
  '..CC..',
  '......',
];
