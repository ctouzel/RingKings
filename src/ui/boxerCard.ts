import { formatDate } from '../core/date';
import { rankOf, rankingPoints } from '../league/ranking';
import { accuracyPct, ageOn, displayName, fullName, isAvailable, koPct, overallRating, recordString } from '../model/boxer';
import { ATTRIBUTE_LABEL, NATIONALITY_INFO, STANCE_LABEL, STYLE_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Boxer, Corner, League } from '../model/types';
import { ATTRIBUTE_KEYS } from '../model/types';
import { esc } from './dom';

/** Couleur de la barre selon la valeur (rouge < 55, jaune < 75, vert sinon). */
function barClass(v: number): string {
  return v >= 75 ? 'hi' : v >= 55 ? 'mid' : 'lo';
}

export function rankLabel(league: League, b: Boxer): string {
  const r = rankOf(league, b.id);
  const wc = WEIGHT_CLASS_INFO[b.weightClass].label;
  return r === 0 ? `Champion · ${wc}` : r === null ? `Non classé · ${wc}` : `N° ${r} · ${wc}`;
}

/** Historique des combats dans la ligue (du plus récent au plus ancien). */
function history(league: League, b: Boxer): string {
  if (b.fightIds.length === 0) return '<p class="muted small">Aucun combat dans la ligue pour l’instant.</p>';
  const rows = [...b.fightIds].reverse().map((id) => {
    const f = league.fights[id]!;
    const r = f.result!;
    const me: Corner = f.red === b.id ? 'red' : 'blue';
    const opp = league.boxers[me === 'red' ? f.blue : f.red]!;
    const oppRank = f.rankAtFight[me === 'red' ? 'blue' : 'red'];
    const res = r.winner === null ? 'N' : r.winner === me ? 'V' : 'D';
    const pts = r.rankingPoints?.[me] ?? 0;
    return `<tr data-fight="${f.id}">
      <td class="muted">${formatDate(f.date)}</td>
      <td><span class="res res-${res}">${res}</span></td>
      <td>${esc(fullName(opp))} <span class="muted">${oppRank === 0 ? '(C)' : oppRank ? `(n°${oppRank})` : ''}</span>${f.isTitleFight ? ' <span class="belt sm">TITRE</span>' : ''}</td>
      <td class="muted">${esc(r.summary.replace(/ \(.*\)$/, ''))}</td>
      <td class="num ${pts >= 0 ? 'pos' : 'neg'}">${pts > 0 ? '+' : ''}${pts}</td>
    </tr>`;
  }).join('');
  return `<div class="scroll-x"><table class="history"><tbody>${rows}</tbody></table></div>`;
}

export function boxerCard(league: League, b: Boxer, actions = ''): string {
  const nat = NATIONALITY_INFO[b.nationality];
  const s = b.stats;
  const attrs = ATTRIBUTE_KEYS.map((k) => `
    <div class="attr"><span>${ATTRIBUTE_LABEL[k]}</span>
      <div class="bar"><span class="${barClass(b.attributes[k])}" style="width:${b.attributes[k]}%"></span></div>
      <span class="num">${b.attributes[k]}</span></div>`).join('');
  const unavailable = !isAvailable(b, league.currentDate)
    ? `<div class="alert">Indisponible jusqu’au ${formatDate(b.unavailableUntil!)} (repos médical)</div>` : '';

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="rank-label">${esc(rankLabel(league, b))} · ${rankingPoints(league, b)} pts</div>
          <h2>${esc(displayName(b))}</h2>
          <div class="sub">${nat.flag} ${esc(b.hometown)}, ${esc(nat.country)} · ${ageOn(b.birthDate, league.currentDate)} ans</div>
        </div>
        <div class="card-side">
          <canvas class="sprite-preview" data-sprite="${b.id}" width="44" height="70" aria-label="Sprite du boxeur"></canvas>
          <div class="ovr" title="Note globale">${overallRating(b)}</div>
        </div>
      </div>
      ${unavailable}
      ${actions ? `<div class="row-btns card-actions">${actions}</div>` : ''}
      <div class="tags">
        <span class="tag" title="${esc(STYLE_INFO[b.style].description)}">${STYLE_INFO[b.style].label}</span>
        <span class="tag">${STANCE_LABEL[b.stance]}</span>
        <span class="tag">${b.heightCm} cm · allonge ${b.reachCm} cm</span>
      </div>
      <div class="record">${recordString(s)}</div>
      <div class="facts">
        <div><b>${koPct(s)} %</b><span>KO</span></div>
        <div><b>${accuracyPct(s)} %</b><span>Précision</span></div>
        <div><b>${s.knockdownsScored}/${s.knockdownsSuffered}</b><span>Knockdowns</span></div>
        <div><b>${b.popularity}</b><span>Popularité</span></div>
        <div><b>${b.development.potential}</b><span>Potentiel</span></div>
        <div><b>${s.titleWins}/${s.titleDefenses}</b><span>Titres / défenses</span></div>
      </div>
      ${attrs}
      <h3>Carrière dans la ligue</h3>
      ${history(league, b)}
      <div class="foot">Pro depuis le ${b.debutDate ? formatDate(b.debutDate) : '—'} · ${s.roundsFought} rounds disputés · usure ${b.development.wear}/100</div>
    </article>`;
}
