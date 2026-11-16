import { divisionOrder } from '../gen/generator';
import { displayName, fullName, overallRating, recordString } from '../model/boxer';
import { NATIONALITY_INFO, STYLE_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Boxer, BoxerId, Corner, FightResult, League, WeightClass } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { commentary } from '../sim/commentary';
import { simulateFight } from '../sim/engine';
import { fighterFromBoxer } from '../sim/fighter';
import { esc } from './dom';

export interface LabState {
  division: WeightClass;
  red: BoxerId | null;
  blue: BoxerId | null;
  rounds: number;
  seed: number | null;
}

export function defaultLab(league: League): LabState {
  const order = divisionOrder(league, 'heavyweight');
  return { division: 'heavyweight', red: order[0]!.id, blue: order[1]!.id, rounds: 12, seed: null };
}

/** Réinitialise les boxeurs quand on change de division. */
export function setLabDivision(league: League, lab: LabState, wc: WeightClass): void {
  const order = divisionOrder(league, wc);
  lab.division = wc;
  lab.red = order[0]!.id;
  lab.blue = order[1]!.id;
  lab.seed = null;
}

function options(order: Boxer[], selected: BoxerId | null): string {
  return order.map((b, i) => `<option value="${b.id}" ${b.id === selected ? 'selected' : ''}>
    ${i === 0 ? 'C' : i}. ${esc(fullName(b))} (${overallRating(b)})</option>`).join('');
}

export function renderFightLab(league: League, lab: LabState): string {
  const order = divisionOrder(league, lab.division);
  const divOptions = WEIGHT_CLASSES.map((wc) => `<option value="${wc}" ${wc === lab.division ? 'selected' : ''}>${WEIGHT_CLASS_INFO[wc].label}</option>`).join('');

  let resultHtml = '<p class="muted">Choisis deux boxeurs et lance la simulation.</p>';
  const red = lab.red ? league.boxers[lab.red] : undefined;
  const blue = lab.blue ? league.boxers[lab.blue] : undefined;
  if (lab.seed !== null && red && blue && red.id !== blue.id) {
    const { result, events } = simulateFight({
      red: fighterFromBoxer(red), blue: fighterFromBoxer(blue),
      rounds: lab.rounds, weightClass: lab.division, seed: lab.seed,
    });
    resultHtml = renderResult(result, commentary(events, { red: fullName(red), blue: fullName(blue) }), red, blue);
  }

  return `
    <section class="panel lab-form">
      <label>Division <select id="lab-division">${divOptions}</select></label>
      <label class="corner-red">Coin rouge <select id="lab-red">${options(order, lab.red)}</select></label>
      <label class="corner-blue">Coin bleu <select id="lab-blue">${options(order, lab.blue)}</select></label>
      <label>Rounds <select id="lab-rounds">${[4, 6, 8, 10, 12].map((r) => `<option ${r === lab.rounds ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <button class="btn" id="lab-run">Simuler le combat</button>
    </section>
    ${lab.seed !== null && lab.red === lab.blue ? '<p class="muted">Choisis deux boxeurs différents.</p>' : ''}
    <div class="lab-result">${resultHtml}</div>`;
}

export function fighterHead(b: Boxer, corner: Corner, winner: Corner | null): string {
  const nat = NATIONALITY_INFO[b.nationality];
  const tag = winner === corner ? '<span class="win-tag">VAINQUEUR</span>' : '';
  return `<div class="fh ${corner}">
    <div class="fh-name">${nat.flag} ${esc(displayName(b))} ${tag}</div>
    <div class="muted">${STYLE_INFO[b.style].label} · ${recordString(b.stats)} · note ${overallRating(b)}</div>
  </div>`;
}

export function renderResult(r: FightResult, lines: ReturnType<typeof commentary>, red: Boxer, blue: Boxer): string {
  const statRow = (label: string, a: string | number, b: string | number) =>
    `<tr><td class="num">${a}</td><th>${label}</th><td>${b}</td></tr>`;
  const pct = (l: number, t: number) => (t ? `${Math.round((l / t) * 100)} %` : '—');
  const s = r.stats;

  const cards = r.scorecards.map((c) => {
    const tr = c.red.reduce((a, b) => a + b, 0), tb = c.blue.reduce((a, b) => a + b, 0);
    return `<tr><th>${esc(c.judge)}</th>${c.red.map((v, i) => `<td class="${v > c.blue[i]! ? 'r' : v < c.blue[i]! ? 'b' : ''}">${v}-${c.blue[i]}</td>`).join('')}<td class="total">${tr}-${tb}</td></tr>`;
  }).join('');
  const roundHead = r.scorecards[0]?.red.map((_, i) => `<th>R${i + 1}</th>`).join('') ?? '';

  return `
    <section class="panel result-head">
      ${fighterHead(red, 'red', r.winner)}
      <div class="verdict pixel">${esc(r.summary)}</div>
      ${fighterHead(blue, 'blue', r.winner)}
    </section>
    <div class="lab-grid">
      <section class="panel pad">
        <h3>Statistiques</h3>
        <table class="stats-table">
          ${statRow('Coups lancés', s.red.punchesThrown, s.blue.punchesThrown)}
          ${statRow('Coups portés', s.red.punchesLanded, s.blue.punchesLanded)}
          ${statRow('Précision', pct(s.red.punchesLanded, s.red.punchesThrown), pct(s.blue.punchesLanded, s.blue.punchesThrown))}
          ${statRow('Jabs portés', `${s.red.jabsLanded}/${s.red.jabsThrown}`, `${s.blue.jabsLanded}/${s.blue.jabsThrown}`)}
          ${statRow('Coups de puissance', `${s.red.powerPunchesLanded}/${s.red.powerPunchesThrown}`, `${s.blue.powerPunchesLanded}/${s.blue.powerPunchesThrown}`)}
          ${statRow('Knockdowns', s.red.knockdowns, s.blue.knockdowns)}
          ${statRow('Dégâts subis', r.damage.red, r.damage.blue)}
        </table>
        ${r.scorecards[0]!.red.length ? `
        <h3>Cartes des juges</h3>
        <div class="scroll-x"><table class="cards"><thead><tr><th></th>${roundHead}<th>Total</th></tr></thead><tbody>${cards}</tbody></table></div>` : ''}
      </section>
      <section class="panel pad">
        <h3>Moments forts</h3>
        <ol class="commentary">
          ${lines.map((l) => `<li class="${l.kind}"><span class="clock">R${l.round} ${l.clock}</span>${esc(l.text)}</li>`).join('')}
        </ol>
      </section>
    </div>`;
}
