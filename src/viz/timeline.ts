/**
 * Transforme les événements du moteur en "temps forts" à animer (beats).
 *
 * - Mode résumé : on garde les échanges importants de chaque round
 *   (knockdowns, boxeur ébranlé, gros coups, fin du combat) => ~20-30 s par round.
 * - Mode complet : tout le combat, en temps réel (3 min par round).
 *
 * Fonction pure (sans dessin) : facile à tester et à régler.
 */
import type { Corner } from '../model/types';
import type { PunchType, Range, SimEvent } from '../sim/engine';

export type ViewMode = 'summary' | 'full';

interface BeatBase { at: number; dur: number; round: number; clock: number; text?: string }

export type Beat =
  | (BeatBase & { kind: 'roundIntro' })
  | (BeatBase & { kind: 'range'; range: Range })
  | (BeatBase & { kind: 'punch'; by: Corner; punch: PunchType; landed: boolean; damage: number; clean: boolean; counter: boolean })
  | (BeatBase & { kind: 'clinch' })
  | (BeatBase & { kind: 'hurt'; who: Corner })
  | (BeatBase & { kind: 'knockdown'; who: Corner; count: number; getsUp: boolean })
  | (BeatBase & { kind: 'stoppage'; who: Corner; reason: string })
  | (BeatBase & { kind: 'roundEnd'; scores: { judge: string; red: number; blue: number }[] })
  | (BeatBase & { kind: 'decision' })
  | (BeatBase & { kind: 'note' })
  | (BeatBase & { kind: 'result'; winner: Corner | null; summary: string });

export interface Timeline {
  beats: Beat[];
  duration: number;
  roundStarts: number[]; // instant de début de chaque round (pour "round suivant")
  mode: ViewMode;
}

/** Durées (en secondes, vitesse ×1). Ajustables pour changer le rythme. */
export const TIMING = {
  intro: 1.6,
  punch: 0.42,
  gap: 0.55, // pause entre deux échanges (mode résumé)
  clinch: 1.2,
  fall: 0.8,
  countSummary: 0.55,
  countFull: 1.0,
  getUp: 0.8,
  stoppage: 2.6,
  roundEnd: 2.6,
  decision: 2.4,
  result: 5,
  /** Nombre d'échanges "ordinaires" gardés par round en mode résumé. */
  exchangesPerRound: 9,
};

const PUNCH_NAME: Record<PunchType, string> = {
  jab: 'jab', cross: 'direct', hook: 'crochet', uppercut: 'uppercut', body: 'crochet au corps',
};

const STOP_TEXT: Record<string, (n: string) => string> = {
  KO: () => 'C’est terminé !',
  referee: (n) => `L’arbitre arrête le combat pour protéger ${n} !`,
  threeKnockdowns: () => 'Troisième knockdown du round : c’est fini !',
  corner: (n) => `Le coin de ${n} jette l’éponge.`,
  doctor: (n) => `Le médecin arrête le combat : ${n} ne peut pas continuer.`,
};

type Exchange = { t: number; events: SimEvent[]; score: number };

function groupExchanges(roundEvents: SimEvent[]): Exchange[] {
  const map = new Map<number, Exchange>();
  for (const e of roundEvents) {
    if (e.type === 'roundStart' || e.type === 'roundEnd' || e.type === 'decision') continue;
    let ex = map.get(e.t);
    if (!ex) { ex = { t: e.t, events: [], score: 0 }; map.set(e.t, ex); }
    ex.events.push(e);
  }
  for (const ex of map.values()) {
    for (const e of ex.events) {
      if (e.type === 'punch' && e.landed) ex.score += e.damage + (e.clean ? 8 : 0) + (e.counter ? 3 : 0);
      if (e.type === 'knockdown' || e.type === 'stoppage' || e.type === 'hurt') ex.score += 1000;
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

export function buildTimeline(events: SimEvent[], names: Record<Corner, string>, mode: ViewMode): Timeline {
  const beats: Beat[] = [];
  const roundStarts: number[] = [];
  const rounds = [...new Set(events.map((e) => e.round))].sort((a, b) => a - b);
  let now = 0;
  let lastRange: Range | null = null;

  for (const round of rounds) {
    const evs = events.filter((e) => e.round === round);
    roundStarts.push(now);
    beats.push({ kind: 'roundIntro', at: now, dur: TIMING.intro, round, clock: 0, text: `Round ${round} !` });
    now += TIMING.intro;
    const roundZero = now; // origine du temps réel (mode complet)

    let exchanges = groupExchanges(evs);
    if (mode === 'summary') {
      const key = exchanges.filter((x) => x.score >= 1000);
      const others = exchanges.filter((x) => x.score < 1000 && x.events.some((e) => e.type === 'punch'))
        .sort((a, b) => b.score - a.score).slice(0, TIMING.exchangesPerRound);
      const clinch = exchanges.find((x) => x.events.some((e) => e.type === 'clinch'));
      const keep = new Set([...key, ...others, ...(clinch ? [clinch] : [])]);
      // Les changements de distance sont conservés pour placer les boxeurs.
      exchanges = exchanges.filter((x) => keep.has(x) || x.events.some((e) => e.type === 'range'))
        .map((x) => (keep.has(x) ? x : { ...x, events: x.events.filter((e) => e.type === 'range') }));
    }

    for (const ex of exchanges) {
      if (mode === 'full') now = Math.max(now, roundZero + ex.t);
      const onlyRange = ex.events.every((e) => e.type === 'range');
      for (const e of ex.events) {
        const base = { at: now, round, clock: e.t };
        switch (e.type) {
          case 'range':
            if (e.range !== lastRange) beats.push({ ...base, kind: 'range', dur: 0.5, range: e.range });
            lastRange = e.range;
            break;
          case 'clinch':
            beats.push({ ...base, kind: 'clinch', dur: TIMING.clinch, text: 'Les deux boxeurs s’accrochent.' });
            now += TIMING.clinch;
            break;
          case 'punch': {
            const big = e.landed && e.clean && e.punch !== 'jab' && e.damage >= 10;
            beats.push({
              ...base, kind: 'punch', dur: TIMING.punch, by: e.by, punch: e.punch, landed: e.landed,
              damage: e.damage, clean: e.clean, counter: e.counter,
              text: big ? `${names[e.by]} ${e.counter ? 'contre d’un' : 'place un'} ${PUNCH_NAME[e.punch]} parfait !` : undefined,
            });
            now += TIMING.punch;
            break;
          }
          case 'hurt':
            beats.push({ ...base, kind: 'hurt', dur: 1.5, who: e.who, text: `${names[e.who]} est ébranlé !` });
            break;
          case 'knockdown': {
            const per = mode === 'full' ? TIMING.countFull : TIMING.countSummary;
            const dur = TIMING.fall + e.count * per + (e.getsUp ? TIMING.getUp : 0);
            beats.push({ ...base, kind: 'knockdown', dur, who: e.who, count: e.count, getsUp: e.getsUp, text: `KNOCKDOWN ! ${names[e.who]} est au tapis !` });
            // La suite n'est annoncée qu'à la fin du compte (pas de spoiler).
            beats.push({
              kind: 'note', at: now + TIMING.fall + e.count * per, dur: 0, round, clock: e.t,
              text: e.getsUp ? `${names[e.who]} se relève à ${e.count} !` : `${names[e.who]} ne se relève pas !`,
            });
            now += dur;
            break;
          }
          case 'stoppage': {
            const loser = names[e.who], winner = names[e.who === 'red' ? 'blue' : 'red'];
            beats.push({ ...base, kind: 'stoppage', dur: TIMING.stoppage, who: e.who, reason: e.reason, text: `${STOP_TEXT[e.reason]!(loser)} Victoire de ${winner} !` });
            now += TIMING.stoppage;
            break;
          }
        }
      }
      if (mode === 'summary' && !onlyRange) now += TIMING.gap;
    }

    if (mode === 'full') now = Math.max(now, roundZero + 180);
    const end = evs.find((e) => e.type === 'roundEnd');
    if (end && end.type === 'roundEnd') {
      const r = end.scores.filter((s) => s.red > s.blue).length, b = end.scores.filter((s) => s.blue > s.red).length;
      const who = r > b ? names.red : b > r ? names.blue : null;
      beats.push({
        kind: 'roundEnd', at: now, dur: TIMING.roundEnd, round, clock: 180, scores: end.scores,
        text: who ? `Fin du round ${round} : avantage ${who}.` : `Fin du round ${round} : très serré.`,
      });
      now += TIMING.roundEnd;
    }
    if (evs.some((e) => e.type === 'decision')) {
      beats.push({ kind: 'decision', at: now, dur: TIMING.decision, round, clock: 180, text: 'Le combat va à la décision des juges…' });
      now += TIMING.decision;
    }
  }
  return { beats, duration: now, roundStarts, mode };
}

/** Ajoute la scène finale (vainqueur) une fois le résultat connu. */
export function addResult(tl: Timeline, winner: Corner | null, summary: string, winnerName: string | null): Timeline {
  const last = tl.beats[tl.beats.length - 1];
  tl.beats.push({
    kind: 'result', at: tl.duration, dur: TIMING.result, round: last?.round ?? 1, clock: last?.clock ?? 0, winner, summary,
    text: winnerName ? `${winnerName} l’emporte : ${summary}` : `Match nul : ${summary}`,
  });
  tl.duration += TIMING.result;
  return tl;
}
