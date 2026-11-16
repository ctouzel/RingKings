import type {
  AttributeKey, FightingStyle, Nationality, ResultMethod, Stance, WeightClass,
} from './types';

/** Libellés français pour l'interface. */

export const WEIGHT_CLASS_INFO: Record<WeightClass, { label: string; limitKg: number | null }> = {
  lightweight: { label: 'Poids légers', limitKg: 61.2 },
  welterweight: { label: 'Poids mi-moyens', limitKg: 66.7 },
  middleweight: { label: 'Poids moyens', limitKg: 72.6 },
  lightHeavyweight: { label: 'Poids mi-lourds', limitKg: 79.4 },
  heavyweight: { label: 'Poids lourds', limitKg: null },
};

export const STYLE_INFO: Record<FightingStyle, { label: string; description: string }> = {
  slugger: {
    label: 'Cogneur',
    description: 'Avance sans relâche et cherche le KO. Puissant mais prévisible.',
  },
  outBoxer: {
    label: 'Technicien',
    description: 'Boxe à distance derrière son jab, jeu de jambes et points.',
  },
  counterPuncher: {
    label: 'Contre-attaquant',
    description: "Laisse venir, esquive et punit chaque erreur de l'adversaire.",
  },
  swarmer: {
    label: 'Presseur',
    description: 'Colle son adversaire, gros volume de coups et travail au corps.',
  },
  boxerPuncher: {
    label: 'Complet',
    description: 'Polyvalent : sait boxer comme frapper fort.',
  },
};

export const STANCE_LABEL: Record<Stance, string> = {
  orthodox: 'Orthodoxe',
  southpaw: 'Gaucher',
};

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  power: 'Puissance',
  handSpeed: 'Vitesse',
  accuracy: 'Précision',
  defense: 'Défense',
  footwork: 'Jeu de jambes',
  chin: 'Menton',
  stamina: 'Endurance',
  recovery: 'Récupération',
  ringIQ: 'QI de ring',
};

export const RESULT_METHOD_LABEL: Record<ResultMethod, string> = {
  KO: 'KO',
  TKO: 'KO technique',
  UD: 'Décision unanime',
  SD: 'Décision partagée',
  MD: 'Décision majoritaire',
  DRAW: 'Match nul',
  DQ: 'Disqualification',
};

export const NATIONALITY_INFO: Record<Nationality, { country: string; flag: string }> = {
  CA: { country: 'Canada', flag: '🇨🇦' },
  US: { country: 'États-Unis', flag: '🇺🇸' },
  MX: { country: 'Mexique', flag: '🇲🇽' },
  CU: { country: 'Cuba', flag: '🇨🇺' },
  PR: { country: 'Porto Rico', flag: '🇵🇷' },
  DO: { country: 'Rép. dominicaine', flag: '🇩🇴' },
  CO: { country: 'Colombie', flag: '🇨🇴' },
  BR: { country: 'Brésil', flag: '🇧🇷' },
  AR: { country: 'Argentine', flag: '🇦🇷' },
  GB: { country: 'Royaume-Uni', flag: '🇬🇧' },
  IE: { country: 'Irlande', flag: '🇮🇪' },
  FR: { country: 'France', flag: '🇫🇷' },
  DE: { country: 'Allemagne', flag: '🇩🇪' },
  IT: { country: 'Italie', flag: '🇮🇹' },
  ES: { country: 'Espagne', flag: '🇪🇸' },
  PL: { country: 'Pologne', flag: '🇵🇱' },
  UA: { country: 'Ukraine', flag: '🇺🇦' },
  RU: { country: 'Russie', flag: '🇷🇺' },
  KZ: { country: 'Kazakhstan', flag: '🇰🇿' },
  UZ: { country: 'Ouzbékistan', flag: '🇺🇿' },
  NG: { country: 'Nigéria', flag: '🇳🇬' },
  GH: { country: 'Ghana', flag: '🇬🇭' },
  ZA: { country: 'Afrique du Sud', flag: '🇿🇦' },
  JP: { country: 'Japon', flag: '🇯🇵' },
  PH: { country: 'Philippines', flag: '🇵🇭' },
  TH: { country: 'Thaïlande', flag: '🇹🇭' },
  KR: { country: 'Corée du Sud', flag: '🇰🇷' },
  AU: { country: 'Australie', flag: '🇦🇺' },
};
