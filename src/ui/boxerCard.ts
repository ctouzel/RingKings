import { accuracyPct, ageOn, displayName, koPct, overallRating, recordString } from '../model/boxer';
import { ATTRIBUTE_LABEL, NATIONALITY_INFO, STANCE_LABEL, STYLE_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Boxer, IsoDate } from '../model/types';
import { ATTRIBUTE_KEYS } from '../model/types';
import { formatDate } from '../core/date';
import { esc } from './dom';

/** Couleur de la barre selon la valeur (rouge < 55, jaune < 75, vert sinon). */
function barClass(v: number): string {
  return v >= 75 ? 'hi' : v >= 55 ? 'mid' : 'lo';
}

export function boxerCard(b: Boxer, today: IsoDate, rankLabel: string): string {
  const nat = NATIONALITY_INFO[b.nationality];
  const s = b.stats;
  const attrs = ATTRIBUTE_KEYS.map((k) => `
    <div class="attr"><span>${ATTRIBUTE_LABEL[k]}</span>
      <div class="bar"><span class="${barClass(b.attributes[k])}" style="width:${b.attributes[k]}%"></span></div>
      <span class="num">${b.attributes[k]}</span></div>`).join('');

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="rank-label">${esc(rankLabel)}</div>
          <h2>${esc(displayName(b))}</h2>
          <div class="sub">${nat.flag} ${esc(b.hometown)}, ${esc(nat.country)} · ${ageOn(b.birthDate, today)} ans</div>
        </div>
        <div class="ovr" title="Note globale">${overallRating(b)}</div>
      </div>
      <div class="tags">
        <span class="tag">${WEIGHT_CLASS_INFO[b.weightClass].label}</span>
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
        <div><b>${s.titleFights}</b><span>Combats titre</span></div>
      </div>
      ${attrs}
      <div class="foot">Pro depuis le ${b.debutDate ? formatDate(b.debutDate) : '—'} · ${s.roundsFought} rounds disputés</div>
    </article>`;
}
