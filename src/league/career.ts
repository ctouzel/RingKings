/**
 * Conséquences d'un combat sur la carrière des boxeurs et sur la division :
 * palmarès, statistiques cumulées, ceintures, popularité, repos médical, usure.
 */
import { addDays } from '../core/date';
import { clamp } from '../core/rng';
import { fullName } from '../model/boxer';
import type { Boxer, Corner, Fight, FightResult, League, NewsItem } from '../model/types';
import { fightPoints, opponentValue } from './ranking';

const other = (c: Corner): Corner => (c === 'red' ? 'blue' : 'red');

export function addNews(league: League, item: Omit<NewsItem, 'date'>): void {
  league.news.push({ date: league.currentDate, ...item });
}

/** Applique le résultat d'un combat à la ligue. Le combat doit avoir rankAtFight renseigné. */
export function applyResult(league: League, fight: Fight, result: FightResult): void {
  const div = league.divisions[fight.weightClass];
  const box: Record<Corner, Boxer> = { red: league.boxers[fight.red]!, blue: league.boxers[fight.blue]! };
  const stopped = result.method === 'KO' || result.method === 'TKO';

  result.rankingPoints = fightPoints(fight, result);
  fight.result = result;

  // --- Statistiques de carrière --------------------------------------------
  for (const c of ['red', 'blue'] as const) {
    const b = box[c], s = b.stats, fs = result.stats[c], opp = result.stats[other(c)];
    s.fights++;
    if (result.winner === null) s.draws++;
    else if (result.winner === c) { s.wins++; if (stopped) s.koWins++; }
    else { s.losses++; if (stopped) s.koLosses++; }
    s.roundsFought += result.endRound;
    s.punchesThrown += fs.punchesThrown;
    s.punchesLanded += fs.punchesLanded;
    s.powerPunchesLanded += fs.powerPunchesLanded;
    s.knockdownsScored += fs.knockdowns;
    s.knockdownsSuffered += opp.knockdowns;
    if (fight.isTitleFight) s.titleFights++;
    b.fightIds.push(fight.id);
  }

  // --- Ceinture ---------------------------------------------------------------
  if (fight.isTitleFight) {
    const champCorner: Corner | null =
      div.championId === fight.red ? 'red' : div.championId === fight.blue ? 'blue' : null;
    const reign = div.titleHistory[div.titleHistory.length - 1];

    if (champCorner && result.winner === champCorner) {
      // Défense réussie.
      if (reign && !reign.lostOn) reign.defenses++;
      box[champCorner].stats.titleDefenses++;
      if (fight.rankAtFight[other(champCorner)] === 1) div.mandatoryDue = addDays(fight.date, 365);
      addNews(league, {
        kind: 'title', boxerIds: [box[champCorner].id],
        text: `${fullName(box[champCorner])} conserve sa ceinture face à ${fullName(box[other(champCorner)])} (${result.summary}).`,
      });
    } else if (result.winner && (champCorner || !div.championId)) {
      // Nouveau champion (titre conquis ou titre vacant attribué).
      const winner = box[result.winner];
      if (champCorner && reign && !reign.lostOn) { reign.lostOn = fight.date; reign.endedBy = 'defeat'; }
      div.championId = winner.id;
      div.titleHistory.push({ boxerId: winner.id, wonOn: fight.date, defenses: 0 });
      div.mandatoryDue = addDays(fight.date, 365);
      winner.stats.titleWins++;
      result.titleChange = true;
      addNews(league, {
        kind: 'title', boxerIds: [winner.id],
        text: champCorner
          ? `NOUVEAU CHAMPION ! ${fullName(winner)} détrône ${fullName(box[other(result.winner)])} (${result.summary}).`
          : `${fullName(winner)} remporte le titre vacant face à ${fullName(box[other(result.winner)])} (${result.summary}).`,
      });
    }
  }

  // --- Popularité, repos, usure ----------------------------------------------
  const upset = result.winner !== null
    && opponentValue(fight.rankAtFight[other(result.winner)]) - opponentValue(fight.rankAtFight[result.winner]) >= 30;

  for (const c of ['red', 'blue'] as const) {
    const b = box[c];
    const won = result.winner === c, lost = result.winner === other(c);
    let pop = won ? 3 + (stopped ? 2 : 0) + (fight.isTitleFight ? 5 : 0) + (upset ? 4 : 0) : lost ? -2 - (stopped ? 1 : 0) : 1;
    if (fight.isMainEvent) pop += 1;
    b.popularity = clamp(b.popularity + pop, 1, 99);

    // Repos minimal + suspension médicale après un KO.
    const dmg = result.damage[c];
    let restDays = 30 + Math.round(dmg * 0.8);
    if (lost && stopped) restDays += result.method === 'KO' ? 75 : 45;
    b.unavailableUntil = addDays(fight.date, restDays);

    b.development.wear = clamp(Math.round(b.development.wear + dmg * 0.12 + (lost && stopped ? 5 : 0)), 0, 100);
  }

  if (upset && result.winner) {
    const w = box[result.winner], l = box[other(result.winner)];
    addNews(league, { kind: 'upset', boxerIds: [w.id, l.id], text: `SURPRISE : ${fullName(w)} bat ${fullName(l)} (${result.summary}).` });
  } else if (stopped && result.winner && !fight.isTitleFight && result.endRound <= 3) {
    const w = box[result.winner], l = box[other(result.winner)];
    addNews(league, { kind: 'ko', boxerIds: [w.id, l.id], text: `${fullName(w)} expédie ${fullName(l)} en ${result.endRound} round${result.endRound > 1 ? 's' : ''}.` });
  }
}
