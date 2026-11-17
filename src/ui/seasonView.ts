/**
 * Écran Saison : repêchage (quand il est ouvert) et bilans annuels.
 */
import { formatDate } from '../core/date';
import { autoPicks, completeDraft, validateDraft } from '../league/draft';
import { ageOn, displayName, fullName, overallRating, recordString } from '../model/boxer';
import { ATTRIBUTE_LABEL, NATIONALITY_INFO, STANCE_LABEL, STYLE_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Award, Boxer, DraftProspect, League, SeasonReview } from '../model/types';
import { ATTRIBUTE_KEYS, WEIGHT_CLASSES } from '../model/types';
import { esc } from './dom';
import type { App } from './state';

function prospectCard(p: DraftProspect, selected: boolean, full: boolean, league: League): string {
  const b = p.boxer, nat = NATIONALITY_INFO[b.nationality];
  const best = [...ATTRIBUTE_KEYS].sort((x, y) => b.attributes[y] - b.attributes[x]).slice(0, 3);
  return `
    <li class="prospect ${selected ? 'picked' : ''} ${full && !selected ? 'dim' : ''}" data-pick="${b.id}">
      <canvas class="sprite-mini" data-sprite="${b.id}" width="96" height="172"></canvas>
      <div class="pr-main">
        <div class="pr-name">${nat.flag} ${esc(displayName(b))}</div>
        <div class="muted small">${ageOn(b.birthDate, league.currentDate)} ans · ${esc(b.hometown)} · ${STYLE_INFO[b.style].label} · ${STANCE_LABEL[b.stance]} · ${b.heightCm} cm</div>
        <div class="small">Amateur/pro : ${recordString(b.stats)} · forces : ${best.map((k) => `${ATTRIBUTE_LABEL[k]} ${b.attributes[k]}`).join(', ')}</div>
      </div>
      <div class="pr-nums">
        <div><span class="muted small">Note</span><b>${overallRating(b)}</b></div>
        <div title="Estimation du recruteur : le vrai potentiel peut surprendre"><span class="muted small">Potentiel estimé</span><b class="scout">${p.scoutLow}–${p.scoutHigh}</b></div>
      </div>
      <div class="pr-check">${selected ? '✓' : ''}</div>
    </li>`;
}

function draftPanel(app: App): string {
  const { league } = app;
  const d = league.draft!;
  const sel = app.season.selected;
  const err = validateDraft(league, sel);
  const divisions = WEIGHT_CLASSES.map((wc) => {
    const ids = new Set(d.pool[wc].map((p) => p.boxer.id));
    const n = sel.filter((id) => ids.has(id)).length;
    const full = n >= d.picks[wc];
    return `
      <section class="panel pad draft-div">
        <h3>${WEIGHT_CLASS_INFO[wc].label} <span class="hint">· ${n}/${d.picks[wc]} choix</span></h3>
        <ul class="prospects">${d.pool[wc].map((p) => prospectCard(p, sel.includes(p.boxer.id), full, league)).join('')}</ul>
      </section>`;
  }).join('');
  return `
    <section class="panel pad draft-head">
      <div>
        <div class="belt-title pixel">REPÊCHAGE ${d.year}</div>
        <p>Choisis les espoirs qui rejoignent ta ligue : un choix par place libérée par les retraites (au moins un par catégorie).
        Le <b>potentiel estimé</b> vient de ton recruteur : il peut se tromper.</p>
        ${err ? `<p class="muted small">${esc(err)}</p>` : '<p class="pos small">Sélection complète.</p>'}
      </div>
      <div class="row-btns">
        <button class="btn ghost" data-act="draft-auto">Suivre le recruteur</button>
        <button class="btn" data-act="draft-validate" ${err ? 'disabled' : ''}>Valider le repêchage</button>
      </div>
    </section>
    <div class="draft-grid">${divisions}</div>`;
}

function awardCard(title: string, a: Award | undefined): string {
  if (!a) return '';
  const attrs = a.fightId ? `data-fight="${a.fightId}"` : a.boxerId ? `data-boxer-modal="${a.boxerId}"` : '';
  return `<div class="award" ${attrs}>
    <div class="award-title pixel">${title}</div>
    ${a.boxerId ? `<canvas class="sprite-mini" data-sprite="${a.boxerId}" width="96" height="172"></canvas>` : ''}
    <div class="award-text">${esc(a.text)}</div>
  </div>`;
}

function reviewPanel(league: League, r: SeasonReview): string {
  const name = (id: string) => {
    const b: Boxer = league.boxers[id]!;
    return `<span class="link" data-boxer-modal="${b.id}">${NATIONALITY_INFO[b.nationality].flag} ${esc(fullName(b))}</span>`;
  };
  const sorted = [...r.progress].sort((a, b) => (b.after - b.before) - (a.after - a.before));
  const line = (p: SeasonReview['progress'][number]) => {
    const d = p.after - p.before;
    return `<li>${name(p.boxerId)} <span class="${d >= 0 ? 'pos' : 'neg'}">${p.before} → ${p.after} (${d > 0 ? '+' : ''}${d})</span></li>`;
  };
  return `
    <div class="awards">
      ${awardCard('BOXEUR DE L’ANNÉE', r.awards.boxer)}
      ${awardCard('KO DE L’ANNÉE', r.awards.ko)}
      ${awardCard('COMBAT DE L’ANNÉE', r.awards.fight)}
      ${awardCard('SURPRISE DE L’ANNÉE', r.awards.upset)}
    </div>
    ${Object.keys(r.awards).length === 0 ? '<p class="muted">Aucun combat disputé cette année : pas de récompenses.</p>' : ''}
    <div class="review-grid">
      <section class="panel pad"><h3>Plus fortes progressions</h3><ul class="plain">${sorted.slice(0, 6).map(line).join('')}</ul></section>
      <section class="panel pad"><h3>Plus forts déclins</h3><ul class="plain">${sorted.slice(-6).reverse().map(line).join('')}</ul></section>
      <section class="panel pad"><h3>Retraites (${r.retirements.length})</h3><ul class="plain">${r.retirements.map((x) => `<li>${name(x.boxerId)} <span class="muted small">${x.age} ans · ${esc(x.record)} · ${esc(x.reason)}</span></li>`).join('') || '<li class="muted">Aucune</li>'}</ul></section>
      <section class="panel pad"><h3>Champions au 31 décembre</h3><ul class="plain">${WEIGHT_CLASSES.map((wc) => `<li>${WEIGHT_CLASS_INFO[wc].label} : ${r.champions[wc] ? name(r.champions[wc]!) : '<span class="muted">vacant</span>'}</li>`).join('')}</ul></section>
      ${r.drafted.length ? `<section class="panel pad"><h3>Repêchés</h3><ul class="plain">${r.drafted.map((id) => `<li>${name(id)} <span class="muted small">${WEIGHT_CLASS_INFO[league.boxers[id]!.weightClass].label}</span></li>`).join('')}</ul></section>` : ''}
    </div>`;
}

export function renderSeason(app: App): string {
  const { league } = app;
  const reviews = [...league.seasons].reverse();
  const shown = reviews.find((r) => r.year === app.season.year) ?? reviews[0];
  const tabs = reviews.map((r) => `<button class="tab ${r === shown ? 'active' : ''}" data-year="${r.year}">Saison ${r.year}</button>`).join('');
  return `
    ${league.draft ? draftPanel(app) : ''}
    <h3 class="section-title">Bilans de saison</h3>
    ${reviews.length === 0
      ? `<p class="muted">Saison ${league.seasonYear} en cours. Le premier bilan (récompenses, vieillissement, retraites, repêchage) aura lieu au passage du ${formatDate(`${league.seasonYear}-12-31`)}.</p>`
      : `<nav class="tabs">${tabs}</nav>${reviewPanel(league, shown!)}`}`;
}

export function onSeasonClick(app: App, target: HTMLElement): boolean {
  const year = target.closest<HTMLElement>('[data-year]');
  if (year) { app.season.year = Number(year.dataset.year); return true; }
  const pick = target.closest<HTMLElement>('[data-pick]');
  const d = app.league.draft;
  if (pick && d) {
    const id = pick.dataset.pick!;
    const sel = app.season.selected;
    if (sel.includes(id)) { app.season.selected = sel.filter((x) => x !== id); return true; }
    const wc = WEIGHT_CLASSES.find((w) => d.pool[w].some((p) => p.boxer.id === id))!;
    const inDiv = sel.filter((x) => d.pool[wc].some((p) => p.boxer.id === x));
    if (inDiv.length >= d.picks[wc]) {
      // Catégorie pleine : on remplace le premier choix.
      app.season.selected = sel.filter((x) => x !== inDiv[0]);
    }
    app.season.selected.push(id);
    return true;
  }
  const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'draft-auto' && d) { app.season.selected = autoPicks(app.league); return true; }
  if (act === 'draft-validate' && d) {
    try {
      const added = completeDraft(app.league, app.season.selected);
      app.season.selected = [];
      app.flash = { kind: 'ok', text: `Repêchage terminé : ${added.length} espoirs rejoignent la ligue. Tu peux reprendre tes galas.` };
    } catch (e) {
      app.flash = { kind: 'err', text: (e as Error).message };
    }
    return true;
  }
  return false;
}
