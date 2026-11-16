/**
 * Transforme les événements du moteur en commentaires lisibles (moments forts).
 * L'animation 8-bit (étape 6) réutilisera ces lignes en bas de l'écran.
 */
import type { Corner } from '../model/types';
import { formatClock, type PunchType, type SimEvent } from './engine';

const PUNCH_NAME: Record<PunchType, string> = {
  jab: 'jab', cross: 'direct', hook: 'crochet', uppercut: 'uppercut', body: 'crochet au corps',
};

export interface CommentLine {
  round: number;
  clock: string;
  text: string;
  kind: 'info' | 'big' | 'hurt' | 'knockdown' | 'end';
}

export function commentary(events: SimEvent[], names: Record<Corner, string>): CommentLine[] {
  const out: CommentLine[] = [];
  const other = (c: Corner): Corner => (c === 'red' ? 'blue' : 'red');
  let lastHurt = -999;

  for (const e of events) {
    const clock = formatClock(e.t);
    switch (e.type) {
      case 'roundStart':
        out.push({ round: e.round, clock: '0:00', text: `— Round ${e.round} —`, kind: 'info' });
        break;
      case 'punch':
        if (e.landed && e.clean && e.punch !== 'jab' && e.damage >= 10) {
          const how = e.counter ? `contre d'un ${PUNCH_NAME[e.punch]}` : `place un ${PUNCH_NAME[e.punch]}`;
          out.push({ round: e.round, clock, text: `${names[e.by]} ${how} parfait !`, kind: 'big' });
        }
        break;
      case 'hurt':
        if (e.round * 1000 + e.t - lastHurt > 20) {
          out.push({ round: e.round, clock, text: `${names[e.who]} est ébranlé !`, kind: 'hurt' });
          lastHurt = e.round * 1000 + e.t;
        }
        break;
      case 'knockdown':
        out.push({
          round: e.round, clock, kind: 'knockdown',
          text: e.getsUp
            ? `KNOCKDOWN ! ${names[e.who]} va au tapis… se relève à ${e.count}.`
            : `${names[e.who]} est au tapis… 8… 9… 10 ! C'est terminé !`,
        });
        break;
      case 'stoppage': {
        const reason = {
          KO: '',
          referee: `L'arbitre arrête le combat pour protéger ${names[e.who]} !`,
          threeKnockdowns: `Troisième knockdown dans le round : l'arbitre arrête tout !`,
          corner: `Le coin de ${names[e.who]} jette l'éponge.`,
          doctor: `Le médecin juge que ${names[e.who]} ne peut pas continuer.`,
        }[e.reason];
        if (reason) out.push({ round: e.round, clock, text: reason, kind: 'end' });
        out.push({ round: e.round, clock, text: `Victoire de ${names[other(e.who)]} !`, kind: 'end' });
        break;
      }
      case 'roundEnd': {
        const r = e.scores.filter((s) => s.red > s.blue).length;
        const b = e.scores.filter((s) => s.blue > s.red).length;
        const who = r > b ? names.red : b > r ? names.blue : null;
        out.push({ round: e.round, clock: '3:00', text: who ? `Fin du round, avantage ${who} (${Math.max(r, b)} juges sur 3).` : 'Fin du round, très serré.', kind: 'info' });
        break;
      }
      case 'decision':
        out.push({ round: e.round, clock: '3:00', text: 'Le combat ira à la décision des juges…', kind: 'end' });
        break;
    }
  }
  return out;
}
