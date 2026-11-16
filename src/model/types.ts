/**
 * Modèle de données de RingKings.
 *
 * Principe : tout l'état du jeu est sérialisable en JSON (pas de classes,
 * pas de Map/Set, pas de Date). On peut donc sauvegarder/charger une ligue
 * entière avec JSON.stringify / JSON.parse.
 *
 * Les dates sont des chaînes ISO "AAAA-MM-JJ" (date dans le jeu, pas la vraie date).
 */

// ---------------------------------------------------------------------------
// Identifiants
// ---------------------------------------------------------------------------

export type BoxerId = string; // ex. "bx_0001"
export type FightId = string; // ex. "ft_0001"
export type EventId = string; // ex. "ev_0001"
export type IsoDate = string; // ex. "2026-03-14"

// ---------------------------------------------------------------------------
// Énumérations (tableaux `as const` => liste utilisable à l'exécution + type)
// ---------------------------------------------------------------------------

export const WEIGHT_CLASSES = [
  'lightweight', // Poids légers      (≤ 61,2 kg)
  'welterweight', // Poids mi-moyens   (≤ 66,7 kg)
  'middleweight', // Poids moyens      (≤ 72,6 kg)
  'lightHeavyweight', // Poids mi-lourds (≤ 79,4 kg)
  'heavyweight', // Poids lourds       (> 90,7 kg)
] as const;
export type WeightClass = (typeof WEIGHT_CLASSES)[number];

/**
 * Styles de boxe. Chaque style influencera le moteur de combat (étape 3) :
 * fréquence des coups, prise de risque, gestion de la distance, etc.
 */
export const FIGHTING_STYLES = [
  'slugger', // Cogneur : puissance, avance, encaisse
  'outBoxer', // Boxeur-technicien : jab, distance, jeu de jambes
  'counterPuncher', // Contre-attaquant : attend l'erreur, précision
  'swarmer', // Presseur (in-fighter) : volume, travail au corps
  'boxerPuncher', // Complet : polyvalent, bon partout
] as const;
export type FightingStyle = (typeof FIGHTING_STYLES)[number];

export const STANCES = ['orthodox', 'southpaw'] as const;
export type Stance = (typeof STANCES)[number];

/** Codes pays ISO 3166-1 alpha-2 (pour drapeaux et générateur de noms). */
export const NATIONALITIES = [
  'CA', 'US', 'MX', 'GB',
  'CU', 'PR', 'DO', 'CO', 'BR', 'AR',
  'IE', 'FR', 'DE', 'IT', 'ES', 'PL', 'UA', 'RU', 'KZ', 'UZ',
  'NG', 'GH', 'ZA', 'JP', 'PH', 'TH', 'KR', 'AU',
] as const;
export type Nationality = (typeof NATIONALITIES)[number];

// ---------------------------------------------------------------------------
// Boxeur
// ---------------------------------------------------------------------------

/** Attributs sportifs, tous sur une échelle 1–100. */
export interface Attributes {
  power: number; // Puissance de frappe (dégâts, chances de KO)
  handSpeed: number; // Vitesse des mains (volume, coups qui passent)
  accuracy: number; // Précision
  defense: number; // Esquive, garde, blocage
  footwork: number; // Jeu de jambes, contrôle de la distance
  chin: number; // Menton : résistance aux KO
  stamina: number; // Endurance : maintien du rythme sur 12 rounds
  recovery: number; // Récupération entre les rounds / après un knockdown
  ringIQ: number; // Intelligence de combat, adaptation, gestion du plan
}
export type AttributeKey = keyof Attributes;
export const ATTRIBUTE_KEYS: readonly AttributeKey[] = [
  'power', 'handSpeed', 'accuracy', 'defense', 'footwork',
  'chin', 'stamina', 'recovery', 'ringIQ',
];

/**
 * Données d'évolution de carrière (utilisées à l'étape 7 : progression/déclin).
 */
export interface Development {
  potential: number; // Plafond de niveau global (1–100)
  peakAge: number; // Âge où il atteint son sommet (≈ 26–31)
  /** Usure cumulée (0–100) : augmente avec les KO subis et les guerres. */
  wear: number;
}

/** Paramètres visuels du sprite 8-bit (étape 6). Tous ajustables. */
export interface Appearance {
  skinTone: number; // index dans la palette de peaux
  hairStyle: number; // index du gabarit de coiffure (0 = chauve)
  hairColor: number; // index dans la palette de cheveux
  trunksColor: string; // couleur du short, ex. "#c0392b"
  glovesColor: string; // couleur des gants
  build: 'slim' | 'medium' | 'bulky'; // carrure
  facialHair: number; // 0 = aucun, 1 = moustache, 2 = barbe
}

/** Statistiques cumulées de carrière (mises à jour après chaque combat). */
export interface CareerStats {
  fights: number;
  wins: number;
  losses: number;
  draws: number;
  koWins: number; // victoires par KO ou TKO
  koLosses: number; // défaites par KO ou TKO
  roundsFought: number;
  punchesThrown: number;
  punchesLanded: number;
  powerPunchesLanded: number;
  knockdownsScored: number;
  knockdownsSuffered: number;
  titleFights: number;
  titleWins: number;
  titleDefenses: number;
}

export type BoxerStatus = 'active' | 'injured' | 'retired';

export interface Boxer {
  id: BoxerId;
  firstName: string;
  lastName: string;
  nickname?: string; // ex. "The Hammer"
  nationality: Nationality;
  hometown: string;
  birthDate: IsoDate;
  heightCm: number;
  reachCm: number;
  weightClass: WeightClass;
  stance: Stance;
  style: FightingStyle;

  attributes: Attributes;
  development: Development;
  appearance: Appearance;

  /** Popularité (0–100) : influence l'affluence et le prestige des galas. */
  popularity: number;
  status: BoxerStatus;
  /** Date jusqu'à laquelle il est indisponible (blessure / suspension médicale). */
  unavailableUntil?: IsoDate;
  debutDate?: IsoDate;
  retiredDate?: IsoDate;
  /** Année du repêchage, pour les boxeurs arrivés en cours de partie. */
  draftYear?: number;

  stats: CareerStats;
  /** Historique des combats dans la ligue, du plus ancien au plus récent. */
  fightIds: FightId[];
  /**
   * Points de classement hérités d'avant la ligue (palmarès généré).
   * Comme les points de combat, ils s'effacent progressivement en 2 ans.
   */
  seedPoints: number;
}

/** Instantané des caractéristiques d'un boxeur le soir du combat. */
export interface FighterSnapshot {
  attributes: Attributes;
  style: FightingStyle;
  stance: Stance;
  reachCm: number;
}

// ---------------------------------------------------------------------------
// Combats
// ---------------------------------------------------------------------------

export type Corner = 'red' | 'blue';

/**
 * Méthodes de victoire :
 *  KO  = knockout (compté jusqu'à 10)
 *  TKO = arrêt de l'arbitre / du médecin / abandon du coin
 *  UD  = décision unanime, SD = décision partagée, MD = décision majoritaire
 *  DRAW = match nul, DQ = disqualification
 */
export const RESULT_METHODS = ['KO', 'TKO', 'UD', 'SD', 'MD', 'DRAW', 'DQ'] as const;
export type ResultMethod = (typeof RESULT_METHODS)[number];

/** Statistiques d'un boxeur sur un seul combat. */
export interface FightStats {
  punchesThrown: number;
  punchesLanded: number;
  jabsThrown: number;
  jabsLanded: number;
  powerPunchesThrown: number;
  powerPunchesLanded: number;
  knockdowns: number; // knockdowns infligés
}

/** Carte d'un juge : points par round pour chaque coin. */
export interface Scorecard {
  judge: string;
  red: number[]; // ex. [10, 9, 10, ...]
  blue: number[];
}

export interface FightResult {
  winner: Corner | null; // null = nul
  method: ResultMethod;
  endRound: number; // round où le combat s'est terminé
  endTimeSec: number; // seconde dans le round (0–180)
  scorecards: Scorecard[]; // 3 juges
  stats: Record<Corner, FightStats>;
  /** Statistiques round par round (coups lancés/portés, knockdowns). */
  rounds: Record<Corner, RoundStats>[];
  /** Dégâts accumulés en fin de combat (0–100+) : servira aux blessures. */
  damage: Record<Corner, number>;
  /** Points de classement gagnés (ou perdus) par chaque boxeur. */
  rankingPoints?: Record<Corner, number>;
  /** Le titre a changé de mains / a été attribué. */
  titleChange?: boolean;
  /** Résumé lisible, ex. "KO au 7e round (2:13)". */
  summary: string;
}

export interface RoundStats {
  thrown: number;
  landed: number;
  powerLanded: number;
  knockdowns: number; // knockdowns infligés dans ce round
}

export interface Fight {
  id: FightId;
  eventId: EventId;
  date: IsoDate;
  weightClass: WeightClass;
  red: BoxerId; // coin rouge (habituellement le favori / champion)
  blue: BoxerId;
  scheduledRounds: 4 | 6 | 8 | 10 | 12;
  isTitleFight: boolean;
  isMainEvent: boolean;
  /** Rang de chaque boxeur au moment du combat (pour l'historique). */
  rankAtFight: Record<Corner, number | null>;
  /** Absent tant que le combat n'a pas eu lieu. */
  result?: FightResult;
  /** Seed RNG : permet de rejouer exactement le même combat en animation. */
  seed: number;
  /** Caractéristiques au moment du combat (pour le rejouer à l'identique plus tard). */
  snapshot?: Record<Corner, FighterSnapshot>;
}

// ---------------------------------------------------------------------------
// Galas (soirées de boxe)
// ---------------------------------------------------------------------------

export type EventStatus = 'planned' | 'completed';

export interface FightEvent {
  id: EventId;
  name: string; // ex. "Nuit des Champions"
  date: IsoDate;
  venue: string;
  city: string;
  status: EventStatus;
  /** Ordre d'affichage : le dernier est le combat principal (main event). */
  fightIds: FightId[];
  attendance?: number;
  revenue?: number;
}

// ---------------------------------------------------------------------------
// Ligue (état global du jeu)
// ---------------------------------------------------------------------------

export interface Division {
  weightClass: WeightClass;
  championId: BoxerId | null;
  /** Classement ordonné (champion exclu) : index 0 = n°1 aspirant. */
  rankings: BoxerId[];
  /** Historique des champions de la division. */
  titleHistory: TitleReign[];
  /**
   * Date limite de la défense obligatoire : le champion doit affronter
   * l'aspirant n°1 avant cette date, sinon le titre est déclaré vacant.
   */
  mandatoryDue: IsoDate | null;
}

export interface TitleReign {
  boxerId: BoxerId;
  wonOn: IsoDate;
  lostOn?: IsoDate;
  defenses: number;
  /** Comment le règne s'est terminé. */
  endedBy?: 'defeat' | 'vacated' | 'retired';
}

export type NewsKind = 'title' | 'upset' | 'ko' | 'vacated' | 'injury' | 'info';

/** Fil d'actualité de la ligue. */
export interface NewsItem {
  date: IsoDate;
  kind: NewsKind;
  text: string;
  boxerIds: BoxerId[];
}

export interface League {
  /** Version du format de sauvegarde (pour migrer les vieilles parties). */
  saveVersion: number;
  name: string;
  currentDate: IsoDate;
  /** Date de création de la ligue (référence des points hérités). */
  startDate: IsoDate;
  /** Seed principal de la partie. */
  seed: number;
  /** Compteurs pour générer des identifiants uniques. */
  nextIds: { boxer: number; fight: number; event: number };

  boxers: Record<BoxerId, Boxer>;
  fights: Record<FightId, Fight>;
  events: Record<EventId, FightEvent>;
  divisions: Record<WeightClass, Division>;

  /** Finances du promoteur (le joueur). */
  money: number;
  /** Actualités, de la plus ancienne à la plus récente. */
  news: NewsItem[];
  /** Année de la saison en cours (le bilan se fait au passage du 31 décembre). */
  seasonYear: number;
  /** Bilans des saisons terminées. */
  seasons: SeasonReview[];
  /** Repêchage en attente des choix du promoteur. */
  draft: Draft | null;
}

// ---------------------------------------------------------------------------
// Saisons et repêchage
// ---------------------------------------------------------------------------

export interface Award {
  boxerId?: BoxerId;
  fightId?: FightId;
  text: string;
}

export interface SeasonReview {
  year: number;
  awards: {
    boxer?: Award; // boxeur de l'année
    ko?: Award; // KO de l'année
    fight?: Award; // combat de l'année
    upset?: Award; // surprise de l'année
  };
  /** Évolution de la note globale de chaque boxeur pendant l'intersaison. */
  progress: { boxerId: BoxerId; before: number; after: number }[];
  retirements: { boxerId: BoxerId; age: number; record: string; reason: string }[];
  champions: Record<WeightClass, BoxerId | null>;
  drafted: BoxerId[];
}

export interface DraftProspect {
  boxer: Boxer;
  /** Estimation du recruteur : le vrai potentiel est quelque part dans cette fourchette… en principe. */
  scoutLow: number;
  scoutHigh: number;
}

export interface Draft {
  year: number;
  /** Nombre de choix par catégorie. */
  picks: Record<WeightClass, number>;
  pool: Record<WeightClass, DraftProspect[]>;
}
