/**
 * Écoulement du temps : défenses obligatoires, titres vacants, retour de blessure.
 */
import { formatDate } from '../core/date';
import { fullName } from '../model/boxer';
import type { IsoDate, League } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { WEIGHT_CLASS_INFO } from '../model/labels';
import { addNews } from './career';
import { recomputeRankings } from './ranking';

/** Le champion a-t-il une défense obligatoire programmée avant l'échéance ? */
export function mandatoryBooked(league: League, wc: (typeof WEIGHT_CLASSES)[number]): boolean {
  const div = league.divisions[wc];
  if (!div.championId || !div.mandatoryDue) return false;
  const n1 = div.rankings[0];
  return Object.values(league.fights).some((f) =>
    !f.result && f.isTitleFight && f.weightClass === wc && f.date <= div.mandatoryDue!
    && (f.red === div.championId || f.blue === div.championId)
    && (f.red === n1 || f.blue === n1)
    && league.events[f.eventId]?.status === 'planned');
}

/** Avance la date de la ligue et applique les règles liées au temps. */
export function advanceTo(league: League, date: IsoDate): void {
  if (date < league.currentDate) return;
  league.currentDate = date;

  for (const wc of WEIGHT_CLASSES) {
    const div = league.divisions[wc];
    if (div.championId && div.mandatoryDue && div.mandatoryDue < date) {
      // Défense obligatoire non honorée : le titre est déclaré vacant.
      const champ = league.boxers[div.championId]!;
      const reign = div.titleHistory[div.titleHistory.length - 1];
      if (reign && !reign.lostOn) { reign.lostOn = div.mandatoryDue; reign.endedBy = 'vacated'; }
      addNews(league, {
        kind: 'vacated', boxerIds: [champ.id],
        text: `Titre ${WEIGHT_CLASS_INFO[wc].label} VACANT : ${fullName(champ)} n'a pas défendu contre l'aspirant n°1 avant le ${formatDate(div.mandatoryDue)}.`,
      });
      div.championId = null;
      div.mandatoryDue = null;
    }
  }
  for (const b of Object.values(league.boxers)) {
    if (b.status === 'injured' && b.unavailableUntil && b.unavailableUntil <= date) b.status = 'active';
  }
  recomputeRankings(league);
}
