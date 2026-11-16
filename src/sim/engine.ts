/**
 * Moteur de simulation de combat.
 *
 * Le combat est découpé en "échanges" de quelques secondes. À chaque échange,
 * on décide de la distance, de qui attaque, quels coups partent, s'ils touchent
 * et leurs effets (dégâts, étourdissement, fatigue). Le moteur produit :
 *  - un FightResult (résultat + statistiques), stocké dans l'historique ;
 *  - une liste d'événements horodatés (SimEvent), rejouée par l'animation 8-bit.
 *
 * Entièrement déterministe : même entrée + même seed => même combat.
 */
import { Rng, clamp } from '../core/rng';
import type {
  Attributes, Corner, FightResult, FightStats, FightingStyle, RoundStats,
  Scorecard, Stance, WeightClass,
} from '../model/types';
import { scoreRound, decide, JUDGE_PROFILES, type RoundTally } from './judges';

// ---------------------------------------------------------------------------
// Entrées / sorties
// ---------------------------------------------------------------------------

/** Ce dont le moteur a besoin d'un boxeur (instantané au moment du combat). */
export interface Fighter {
  name: string;
  attributes: Attributes;
  style: FightingStyle;
  stance: Stance;
  reachCm: number;
}

export interface FightSetup {
  red: Fighter;
  blue: Fighter;
  rounds: number;
  weightClass: WeightClass;
  seed: number;
  judges?: string[];
}

export type PunchType = 'jab' | 'cross' | 'hook' | 'uppercut' | 'body';
export type Range = 'long' | 'inside';

export type SimEvent =
  | { type: 'roundStart'; round: number; t: 0 }
  | { type: 'range'; round: number; t: number; range: Range }
  | { type: 'punch'; round: number; t: number; by: Corner; punch: PunchType; landed: boolean; damage: number; clean: boolean; counter: boolean }
  | { type: 'hurt'; round: number; t: number; who: Corner }
  | { type: 'clinch'; round: number; t: number }
  | { type: 'knockdown'; round: number; t: number; who: Corner; count: number; getsUp: boolean }
  | { type: 'stoppage'; round: number; t: number; who: Corner; reason: 'KO' | 'referee' | 'threeKnockdowns' | 'corner' | 'doctor' }
  | { type: 'roundEnd'; round: number; t: 180; scores: { judge: string; red: number; blue: number }[] }
  | { type: 'decision'; round: number; t: 180 };

export interface SimOutput {
  result: FightResult;
  events: SimEvent[];
}

// ---------------------------------------------------------------------------
// Réglages (calibrés par tests/engine.test.ts pour un rendu réaliste)
// ---------------------------------------------------------------------------

export const ROUND_SECONDS = 180;

export const PUNCHES: Record<PunchType, { hit: number; dmg: number; cost: number; power: boolean }> = {
  jab: { hit: 0.31, dmg: 2.0, cost: 0.25, power: false },
  cross: { hit: 0.33, dmg: 4.0, cost: 0.55, power: true },
  hook: { hit: 0.31, dmg: 4.6, cost: 0.65, power: true },
  uppercut: { hit: 0.27, dmg: 5.0, cost: 0.70, power: true },
  body: { hit: 0.40, dmg: 3.0, cost: 0.55, power: true },
};

interface StyleProfile {
  aggression: number; // tendance à prendre l'initiative
  combo: number; // nombre moyen de coups par attaque
  counter: number; // probabilité de riposter après une attaque
  heavyHands: number; // multiplicateur d'étourdissement (frappe "assise", lourde)
  range: Range; // distance préférée
  /** Efficacité (attaque et défense) selon la distance. */
  rangeSkill: Record<Range, number>;
  mix: Record<PunchType, number>;
}

export const STYLE_PROFILES: Record<FightingStyle, StyleProfile> = {
  slugger: { aggression: 0.6, combo: 1.8, counter: 0.28, heavyHands: 1.25, range: 'inside', rangeSkill: { long: 0.919, inside: 1.084 }, mix: { jab: 18, cross: 28, hook: 30, uppercut: 12, body: 12 } },
  outBoxer: { aggression: 0.55, combo: 2.1, counter: 0.30, heavyHands: 0.95, range: 'long', rangeSkill: { long: 1.081, inside: 0.882 }, mix: { jab: 50, cross: 25, hook: 9, uppercut: 4, body: 12 } },
  counterPuncher: { aggression: 0.38, combo: 1.8, counter: 0.55, heavyHands: 1.05, range: 'long', rangeSkill: { long: 1.046, inside: 0.986 }, mix: { jab: 30, cross: 32, hook: 20, uppercut: 8, body: 10 } },
  swarmer: { aggression: 0.66, combo: 2.3, counter: 0.15, heavyHands: 0.95, range: 'inside', rangeSkill: { long: 0.816, inside: 1.068 }, mix: { jab: 14, cross: 20, hook: 28, uppercut: 12, body: 26 } },
  boxerPuncher: { aggression: 0.55, combo: 2.1, counter: 0.3, heavyHands: 1.05, range: 'long', rangeSkill: { long: 1.0, inside: 1.0 }, mix: { jab: 32, cross: 28, hook: 18, uppercut: 8, body: 14 } },
};

/** Les coups des lourds font plus de dégâts. */
const CLASS_POWER: Record<WeightClass, number> = {
  lightweight: 0.96, welterweight: 0.98, middleweight: 1.0, lightHeavyweight: 1.03, heavyweight: 1.08,
};

export const TUNING = {
  /** Multiplicateur de l'étourdissement par coup (↑ = plus de knockdowns/KO). */
  stunScale: 0.72,
  /** Bonus d'étourdissement d'un coup "propre" (sur la pointe du menton). */
  cleanStun: 2.0,
  /** Seuil de knockdown : base + menton × pente (↑ = moins de knockdowns). */
  kdBase: 8,
  kdChin: 0.3,
  /** Part des dégâts d'un coup qui s'accumule (usure du combat). */
  damageAccum: 0.12,
  /** Volume de coups (↑ = plus de coups par round). */
  volume: 1.25,
  /** Dégâts à partir desquels le coin ou le médecin peut arrêter le combat. */
  stopDamage: 85,
  /** Propension de l'arbitre à arrêter un boxeur sonné qui ne répond plus. */
  refereeStop: 0.25,
  /** Écart-type de la "forme du soir" (± % sur tous les attributs). */
  formSd: 0.06,
};

// ---------------------------------------------------------------------------
// État interne
// ---------------------------------------------------------------------------

interface State {
  f: Fighter;
  energy: number; // 0–100, fatigue
  damage: number; // dégâts cumulés (tête), ne se résorbent presque pas
  bodyDamage: number; // dégâts au corps, réduisent la récupération
  stun: number; // étourdissement passager
  kdTotal: number;
  kdRound: number;
  pressure: number; // coups de puissance encaissés sans répondre (arrêt de l'arbitre)
  disrupt: number; // gêne causée par le jab adverse (0–0,6) : moins d'initiative
  stats: FightStats;
  round: RoundStats & { jabsLanded: number; thrownAll: number };
}

const emptyFightStats = (): FightStats => ({
  punchesThrown: 0, punchesLanded: 0, jabsThrown: 0, jabsLanded: 0,
  powerPunchesThrown: 0, powerPunchesLanded: 0, knockdowns: 0,
});
const emptyRound = () => ({ thrown: 0, landed: 0, powerLanded: 0, knockdowns: 0, jabsLanded: 0, thrownAll: 0 });

const other = (c: Corner): Corner => (c === 'red' ? 'blue' : 'red');

/** Performance selon la fatigue : 0,8 (épuisé) … 1 (frais). */
const fatigue = (s: State) => 0.8 + 0.2 * (s.energy / 100);

/** Seuil d'étourdissement au-delà duquel un coup peut envoyer au tapis. */
const kdThreshold = (s: State) =>
  TUNING.kdBase + s.f.attributes.chin * TUNING.kdChin - s.damage * 0.08 - s.kdTotal * 2;

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export function simulateFight(setup: FightSetup): SimOutput {
  const rng = new Rng(setup.seed);
  const judges = setup.judges ?? ['Juge A', 'Juge B', 'Juge C'];
  const classPower = CLASS_POWER[setup.weightClass];
  const events: SimEvent[] = [];

  // Forme du soir : un boxeur peut être dans un grand ou un mauvais jour.
  const withForm = (f: Fighter): Fighter => {
    const form = clamp(rng.gaussian(1, TUNING.formSd), 0.85, 1.15);
    const attributes = { ...f.attributes };
    for (const k of Object.keys(attributes) as (keyof Attributes)[]) attributes[k] *= form;
    return { ...f, attributes };
  };
  const mk = (f: Fighter): State => ({
    f: withForm(f), energy: 100, damage: 0, bodyDamage: 0, stun: 0, kdTotal: 0, kdRound: 0, pressure: 0, disrupt: 0,
    stats: emptyFightStats(), round: emptyRound(),
  });
  const st: Record<Corner, State> = { red: mk(setup.red), blue: mk(setup.blue) };

  const scorecards: Scorecard[] = judges.map((judge) => ({ judge, red: [], blue: [] }));
  const roundStats: Record<Corner, RoundStats>[] = [];

  let ended: { winner: Corner; method: 'KO' | 'TKO'; round: number; t: number } | null = null;

  for (let round = 1; round <= setup.rounds && !ended; round++) {
    events.push({ type: 'roundStart', round, t: 0 });
    for (const c of ['red', 'blue'] as const) {
      st[c].kdRound = 0;
      st[c].pressure = 0;
      st[c].round = emptyRound();
    }

    let t = 0;
    let range: Range | null = null;

    while (t < ROUND_SECONDS && !ended) {
      t += rng.float(1.8, 4.6);
      if (t >= ROUND_SECONDS) break;
      const time = Math.round(t);

      // 1. Récupération de l'étourdissement et coût de base du mouvement.
      for (const c of ['red', 'blue'] as const) {
        const s = st[c];
        s.stun = Math.max(0, s.stun * 0.86 - (1 + s.f.attributes.recovery * 0.03));
        s.disrupt *= 0.5;
        s.energy = clamp(s.energy - 0.12 * (1.4 - s.f.attributes.stamina / 120), 5, 100);
      }

      // 2. Distance : chacun essaie d'imposer la sienne (jeu de jambes).
      const newRange = decideRange(rng, st.red, st.blue);
      if (newRange !== range) {
        range = newRange;
        events.push({ type: 'range', round, t: time, range });
      }

      // 3. Accrochage (clinch) : plus fréquent quand un boxeur est fatigué ou sonné.
      const clinchP = 0.04 + (range === 'inside' ? 0.05 : 0)
        + Math.max(st.red.stun, st.blue.stun) / 250 + (100 - Math.min(st.red.energy, st.blue.energy)) / 900;
      if (rng.chance(clinchP)) {
        events.push({ type: 'clinch', round, t: time });
        for (const c of ['red', 'blue'] as const) st[c].stun *= 0.7;
        continue;
      }

      // 4. Qui prend l'initiative ?
      const initiative = (s: State) =>
        (STYLE_PROFILES[s.f.style].aggression + s.f.attributes.handSpeed / 500)
        * (0.6 + s.energy / 250) * (1 - s.stun / 150) * (1 - s.disrupt)
        + (STYLE_PROFILES[s.f.style].range === range ? 0.1 : 0);
      const iR = initiative(st.red), iB = initiative(st.blue);
      // Temps mort (feintes, observation) : plus fréquent entre deux attentistes.
      if (rng.chance(0.22 - (iR + iB) * 0.08)) continue;

      const attacker: Corner = rng.chance(iR / (iR + iB)) ? 'red' : 'blue';
      const defender = other(attacker);

      let misses = 0;
      ended = attack(attacker, false) ?? null;
      if (ended) break;

      // 5. Riposte éventuelle du défenseur : chaque coup raté par l'attaquant
      //    l'expose davantage (c'est là que brille le contre-attaquant).
      const d = st[defender];
      const counterP = STYLE_PROFILES[d.f.style].counter * (0.35 + misses * 0.3)
        * (0.6 + d.f.attributes.ringIQ / 250) * fatigue(d) * (1 - d.stun / 80);
      // Un boxeur qui avance pour entrer au corps à corps "marche" dans les ripostes.
      const walksIn = STYLE_PROFILES[st[attacker].f.style].range === 'inside' && range === 'long' ? 1.3 : 1;
      if (rng.chance(clamp(counterP * walksIn, 0, 0.85))) {
        ended = attack(defender, true) ?? null;
      }

      // --- Une attaque (combinaison de coups) ---------------------------------
      function attack(by: Corner, isCounter: boolean): typeof ended | void {
        const a = st[by], d = st[other(by)];
        const prof = STYLE_PROFILES[a.f.style];
        const size = prof.combo * TUNING.volume * (0.7 + a.f.attributes.handSpeed / 250)
          * (0.7 + a.energy / 330) * (1 - a.disrupt * 0.5) * (isCounter ? 0.7 : 1);
        const n = clamp(Math.round(rng.gaussian(size, 0.8)), 1, 5);

        for (let i = 0; i < n; i++) {
          const punch = pickPunch(rng, prof.mix, range!);
          const p = PUNCHES[punch];
          a.energy = clamp(a.energy - p.cost * 0.8 * (1.35 - a.f.attributes.stamina / 140), 5, 100);
          a.stats.punchesThrown++;
          a.round.thrown++;
          if (punch === 'jab') a.stats.jabsThrown++; else a.stats.powerPunchesThrown++;

          // Probabilité de toucher.
          const A = a.f.attributes, D = d.f.attributes;
          const acc = (A.accuracy * 0.65 + A.handSpeed * 0.35) * fatigue(a) * (1 + A.ringIQ * (round - 1) * 0.0004);
          const def = (D.defense * 0.6 + D.footwork * 0.25 + D.ringIQ * 0.15) * fatigue(d) * (1 - d.stun / 120);
          const skill = STYLE_PROFILES[a.f.style].rangeSkill[range!] / STYLE_PROFILES[d.f.style].rangeSkill[range!];
          let hitP = p.hit * clamp(1 + (acc - def) / 110, 0.45, 1.7) * rangeMod(punch, range!) * skill;
          if (punch === 'jab' && range === 'long') hitP *= 1 + (a.f.reachCm - d.f.reachCm) / 120;
          if (a.f.stance === 'southpaw' && d.f.stance === 'orthodox') hitP *= 1.04;
          if (isCounter) hitP *= 1.25; // l'attaquant qui rate est exposé
          hitP *= 1 - i * 0.04; // les derniers coups d'une série sont plus prévisibles
          const landed = rng.chance(clamp(hitP, 0.04, 0.8));

          if (!landed) {
            if (!isCounter) misses++;
            events.push({ type: 'punch', round, t: time, by, punch, landed: false, damage: 0, clean: false, counter: isCounter });
            continue;
          }

          // Dégâts.
          const clean = rng.chance(0.05 + a.f.attributes.accuracy / 1200);
          let dmg = p.dmg * (0.45 + a.f.attributes.power / 90) * (0.75 + 0.25 * a.energy / 100)
            * classPower * rng.float(0.7, 1.3);
          dmg *= STYLE_PROFILES[a.f.style].rangeSkill[range!]; // levier selon la distance
          if (clean) dmg *= 1.8;
          if (isCounter) dmg *= 1.35; // il "marche" dans le coup
          dmg = Math.round(dmg * 10) / 10;

          a.stats.punchesLanded++;
          a.round.landed++;
          if (punch === 'jab') {
            a.stats.jabsLanded++; a.round.jabsLanded++;
            d.disrupt = Math.min(0.6, d.disrupt + (range === 'long' ? 0.12 : 0.06));
          } else { a.stats.powerPunchesLanded++; a.round.powerLanded++; }
          events.push({ type: 'punch', round, t: time, by, punch, landed: true, damage: dmg, clean, counter: isCounter });

          // Effets sur le défenseur.
          const chin = d.f.attributes.chin;
          if (punch === 'body') {
            d.energy = clamp(d.energy - dmg * 0.35, 5, 100);
            d.bodyDamage += dmg * 0.4;
            d.damage += dmg * TUNING.damageAccum * 0.3;
            d.stun += dmg * (clean ? 1.0 : 0.15) * TUNING.stunScale;
          } else {
            d.damage += dmg * TUNING.damageAccum;
            // Une bonne défense "accompagne" le coup et en absorbe une partie.
            d.stun += dmg * (1.55 - chin / 100) * (1.25 - D.defense / 200) * (1 + d.damage / 120)
              * (clean ? TUNING.cleanStun : 1) * STYLE_PROFILES[a.f.style].heavyHands * TUNING.stunScale;
          }
          if (p.power) d.pressure++;
          a.pressure = 0;

          const threshold = kdThreshold(d);
          if (d.stun > threshold * 0.75 && rng.chance(0.3)) events.push({ type: 'hurt', round, t: time, who: other(by) });

          // Knockdown ?
          if (p.power && d.stun > threshold) {
            const kdP = clamp((d.stun - threshold) / 35, 0.05, 0.75);
            if (rng.chance(kdP)) {
              const res = knockdown(by, time);
              if (res) return res;
              return; // la série s'arrête après un knockdown
            }
          }

          // Arrêt de l'arbitre : boxeur sonné qui encaisse sans répondre.
          if (d.stun > threshold && d.pressure >= 6 && rng.chance(TUNING.refereeStop + (d.pressure - 6) * 0.05)) {
            events.push({ type: 'stoppage', round, t: time, who: other(by), reason: 'referee' });
            return { winner: by, method: 'TKO', round, t: time };
          }
        }
      }

      function knockdown(by: Corner, time: number): typeof ended | void {
        const a = st[by], d = st[other(by)];
        const loser = other(by);
        d.kdTotal++; d.kdRound++;
        a.stats.knockdowns++;
        a.round.knockdowns++;
        const threshold = kdThreshold(d);
        const getUpP = clamp(
          0.96 - (d.kdTotal - 1) * 0.1 - d.damage / 250
          + (d.f.attributes.chin - 60) / 220 + (d.f.attributes.recovery - 60) / 260
          - Math.max(0, d.stun - threshold) / 200,
          0.12, 0.97,
        );
        const getsUp = rng.chance(getUpP);
        const count = getsUp ? rng.int(3, 9) : 10;
        events.push({ type: 'knockdown', round, t: time, who: loser, count, getsUp });

        if (!getsUp) {
          events.push({ type: 'stoppage', round, t: time, who: loser, reason: 'KO' });
          return { winner: by, method: 'KO', round, t: time };
        }
        if (d.kdRound >= 3) {
          events.push({ type: 'stoppage', round, t: time, who: loser, reason: 'threeKnockdowns' });
          return { winner: by, method: 'TKO', round, t: time };
        }
        // L'arbitre peut arrêter si le boxeur se relève mais semble incapable de continuer.
        if (d.kdTotal >= 2 && rng.chance(clamp((d.damage - 15) / 100, 0.05, 0.4))) {
          events.push({ type: 'stoppage', round, t: time, who: loser, reason: 'referee' });
          return { winner: by, method: 'TKO', round, t: time };
        }
        d.stun = threshold * 0.55; // se relève encore sonné
        d.pressure = 0;
        t += 12; // le compte prend du temps
      }
    }

    // --- Fin du round : statistiques et pointage ------------------------------
    roundStats.push({
      red: pickRound(st.red.round), blue: pickRound(st.blue.round),
    });

    if (!ended) {
      const tally: Record<Corner, RoundTally> = {
        red: tallyOf(st.red, st.blue),
        blue: tallyOf(st.blue, st.red),
      };
      const scores = judges.map((judge, j) => {
        const [r, b] = scoreRound(rng, tally.red, tally.blue, JUDGE_PROFILES[j % JUDGE_PROFILES.length]!);
        scorecards[j]!.red.push(r);
        scorecards[j]!.blue.push(b);
        return { judge, red: r, blue: b };
      });
      events.push({ type: 'roundEnd', round, t: ROUND_SECONDS, scores });

      // Arrêt entre les rounds (médecin ou coin) si un boxeur est trop amoché.
      for (const c of ['red', 'blue'] as const) {
        const s = st[c];
        const stopP = clamp((s.damage - TUNING.stopDamage) / 60, 0, 0.6) + (s.kdTotal >= 3 ? 0.1 : 0);
        if (round < setup.rounds && rng.chance(stopP)) {
          const reason = rng.chance(0.5) ? 'corner' : 'doctor';
          events.push({ type: 'stoppage', round, t: ROUND_SECONDS, who: c, reason });
          ended = { winner: other(c), method: 'TKO', round, t: ROUND_SECONDS };
          break;
        }
      }

      // Repos d'une minute.
      for (const c of ['red', 'blue'] as const) {
        const s = st[c];
        const maxEnergy = 100 - s.bodyDamage * 0.35;
        s.energy = clamp(s.energy + 10 + s.f.attributes.recovery * 0.12 + s.f.attributes.stamina * 0.05 - s.bodyDamage * 0.05, 5, maxEnergy);
        s.stun = 0;
        s.damage = Math.max(0, s.damage - s.f.attributes.recovery * 0.02);
      }
    }
  }

  // --- Résultat ---------------------------------------------------------------
  const stats = { red: st.red.stats, blue: st.blue.stats };
  const damage = { red: Math.round(st.red.damage), blue: Math.round(st.blue.damage) };

  if (ended) {
    const ordinal = ended.round === 1 ? '1er' : `${ended.round}e`;
    const betweenRounds = ended.t >= ROUND_SECONDS;
    return {
      events,
      result: {
        winner: ended.winner, method: ended.method, endRound: ended.round, endTimeSec: Math.min(ended.t, ROUND_SECONDS),
        scorecards, stats, rounds: roundStats, damage,
        summary: betweenRounds
          ? `KO technique (abandon) après le ${ordinal} round`
          : `${ended.method === 'KO' ? 'KO' : 'KO technique'} au ${ordinal} round (${formatClock(ended.t)})`,
      },
    };
  }

  events.push({ type: 'decision', round: setup.rounds, t: ROUND_SECONDS });
  const { winner, method } = decide(scorecards);
  const totals = scorecards.map((s) => {
    const r = sum(s.red), b = sum(s.blue);
    return winner === 'blue' ? `${b}-${r}` : `${r}-${b}`;
  }).join(', ');
  const label = { UD: 'Décision unanime', SD: 'Décision partagée', MD: 'Décision majoritaire', DRAW: 'Match nul' }[method];
  return {
    events,
    result: {
      winner, method, endRound: setup.rounds, endTimeSec: ROUND_SECONDS,
      scorecards, stats, rounds: roundStats, damage,
      summary: `${label} (${totals})`,
    },
  };
}

// ---------------------------------------------------------------------------
// Fonctions utilitaires
// ---------------------------------------------------------------------------

function decideRange(rng: Rng, red: State, blue: State): Range {
  const pr = STYLE_PROFILES[red.f.style].range, pb = STYLE_PROFILES[blue.f.style].range;
  if (pr === pb) return rng.chance(0.85) ? pr : (pr === 'long' ? 'inside' : 'long');
  // Duel de jeu de jambes : celui qui veut rester à distance contre celui qui veut entrer.
  // Le presseur "coupe le ring" : son agressivité l'aide à imposer le corps à corps.
  const ctrl = (s: State) => s.f.attributes.footwork * fatigue(s) * (1 - s.stun / 150) + s.f.attributes.ringIQ * 0.3
    + (STYLE_PROFILES[s.f.style].range === 'inside' ? STYLE_PROFILES[s.f.style].aggression * 5 : 0);
  const pRed = 1 / (1 + Math.exp(-(ctrl(red) - ctrl(blue)) / 18));
  return rng.chance(pRed) ? pr : pb;
}

function rangeMod(punch: PunchType, range: Range): number {
  if (range === 'long') return punch === 'jab' ? 1.12 : punch === 'cross' ? 1.0 : 0.85;
  return punch === 'jab' ? 0.8 : punch === 'cross' ? 0.95 : 1.12;
}

function pickPunch(rng: Rng, mix: Record<PunchType, number>, range: Range): PunchType {
  const w = { ...mix };
  if (range === 'inside') { w.jab *= 0.5; w.hook *= 1.4; w.uppercut *= 1.5; w.body *= 1.4; }
  else { w.jab *= 1.3; w.uppercut *= 0.5; w.body *= 0.8; }
  return rng.weighted(w);
}

function tallyOf(s: State, opp: State): RoundTally {
  return {
    powerLanded: s.round.powerLanded,
    jabsLanded: s.round.jabsLanded,
    thrown: s.round.thrown,
    knockdowns: s.round.knockdowns,
    opponentMissed: opp.round.thrown - opp.round.landed,
  };
}

function pickRound(r: State['round']): RoundStats {
  return { thrown: r.thrown, landed: r.landed, powerLanded: r.powerLanded, knockdowns: r.knockdowns };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function formatClock(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
