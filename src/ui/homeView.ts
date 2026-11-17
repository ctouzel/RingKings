/**
 * Accueil : tableau de bord du promoteur.
 */
import { daysBetween, formatDate } from '../core/date';
import { mandatoryBooked } from '../league/calendar';
import { plannedEvents } from '../league/events';
import { rankOf } from '../league/ranking';
import { ageOn, displayName, fullName, overallRating, recordString } from '../model/boxer';
import { NATIONALITY_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Boxer, Corner, League } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { esc } from './dom';
import type { App } from './state';

/** Série de victoires en cours dans la ligue. */
export function winStreak(league: League, b: Boxer): number {
  let n = 0;
  for (const id of [...b.fightIds].reverse()) {
    const f = league.fights[id]!;
    const me: Corner = f.red === b.id ? 'red' : 'blue';
    if (f.result?.winner === me) n++; else break;
  }
  return n;
}

function todo(league: League): string[] {
  const items: string[] = [];
  if (league.draft) items.push(`<b>Repêchage ${league.draft.year}</b> à faire avant le prochain gala. <button class="btn sm" data-screen="season">Y aller</button>`);
  const next = plannedEvents(league)[0];
  if (!next) items.push('Aucun gala prévu. <button class="btn sm" data-act-home="new-gala">Créer un gala</button>');
  else if (next.fightIds.length === 0) items.push(`La carte de <b>${esc(next.name)}</b> est vide.`);
  for (const wc of WEIGHT_CLASSES) {
    const d = league.divisions[wc];
    if (!d.championId) { items.push(`Titre <b>${WEIGHT_CLASS_INFO[wc].label}</b> vacant : à disputer entre deux membres du top 5.`); continue; }
    if (d.mandatoryDue && !mandatoryBooked(league, wc)) {
      const days = daysBetween(league.currentDate, d.mandatoryDue);
      if (days < 90) {
        items.push(`Défense obligatoire <b>${WEIGHT_CLASS_INFO[wc].label}</b> : ${esc(fullName(league.boxers[d.championId]!))} doit affronter le n°1 d’ici ${days} jours, sinon le titre sera vacant.`);
      }
    }
  }
  return items;
}

const mini = (b: Boxer) => `<canvas class="sprite-mini" data-sprite="${b.id}" width="96" height="172"></canvas>`;

export function renderHome(app: App): string {
  const l = app.league;
  const next = plannedEvents(l)[0];
  const active = Object.values(l.boxers).filter((b) => b.status !== 'retired');

  const nextHtml = next
    ? (() => {
      const main = next.fightIds.length ? l.fights[next.fightIds[next.fightIds.length - 1]!]! : null;
      return `<div class="next-name">${esc(next.name)}</div>
        <div class="muted small">${esc(next.venue)}, ${esc(next.city)} · ${formatDate(next.date)} · dans ${daysBetween(l.currentDate, next.date)} jours · ${next.fightIds.length} combat(s)</div>
        ${main ? `<div class="next-main">${main.isTitleFight ? '<span class="belt sm">TITRE</span> ' : ''}${esc(fullName(l.boxers[main.red]!))} <span class="vs">vs</span> ${esc(fullName(l.boxers[main.blue]!))}</div>` : ''}
        <div class="row-btns"><button class="btn" data-act-home="open-gala" data-id="${next.id}">Composer / disputer</button></div>`;
    })()
    : `<p class="muted">Aucun gala prévu.</p><button class="btn" data-act-home="new-gala">+ Nouveau gala</button>`;

  const champs = WEIGHT_CLASSES.map((wc) => {
    const d = l.divisions[wc];
    const c = d.championId ? l.boxers[d.championId]! : null;
    const reign = d.titleHistory[d.titleHistory.length - 1];
    return `<div class="champ-tile" ${c ? `data-boxer-modal="${c.id}"` : ''}>
      <div class="ct-div">${WEIGHT_CLASS_INFO[wc].label}</div>
      ${c ? `${mini(c)}<div class="ct-name">${NATIONALITY_INFO[c.nationality].flag} ${esc(fullName(c))}</div>
        <div class="muted small">${recordString(c.stats)} · ${reign?.defenses ?? 0} déf.</div>` : '<div class="ct-vacant pixel">VACANT</div>'}
    </div>`;
  }).join('');

  const hot = active.map((b) => ({ b, s: winStreak(l, b) })).filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s || overallRating(b.b) - overallRating(a.b)).slice(0, 6);
  const prospects = active.filter((b) => ageOn(b.birthDate, l.currentDate) <= 24)
    .sort((a, b) => b.development.potential - a.development.potential).slice(0, 6);
  const row = (b: Boxer, right: string) => {
    const r = rankOf(l, b.id);
    return `<li data-boxer-modal="${b.id}"><span class="flag">${NATIONALITY_INFO[b.nationality].flag}</span>
      <span class="bn">${esc(displayName(b))}<span class="muted small"> · ${WEIGHT_CLASS_INFO[b.weightClass].label}${r === 0 ? ' · C' : r ? ` · n°${r}` : ''}</span></span>
      <span class="bv">${right}</span></li>`;
  };

  const lastEv = Object.values(l.events).filter((e) => e.status === 'completed').at(-1);
  const results = lastEv ? [...lastEv.fightIds].reverse().map((id) => {
    const f = l.fights[id]!, r = f.result!;
    const w = r.winner ? l.boxers[f[r.winner]]! : null;
    return `<li data-fight="${f.id}">${w ? `<b>${esc(fullName(w))}</b> bat ${esc(fullName(l.boxers[f[r.winner === 'red' ? 'blue' : 'red']]!))}` : `${esc(fullName(l.boxers[f.red]!))} et ${esc(fullName(l.boxers[f.blue]!))} : nul`}
      <span class="muted small">· ${esc(r.summary.replace(/ \(.*\)$/, ''))}</span></li>`;
  }).join('') : '';

  const items = todo(l);
  const news = [...l.news].reverse().slice(0, 6).map((n) => `<li class="news-${n.kind}"><span class="muted small">${formatDate(n.date)}</span>${esc(n.text)}</li>`).join('');

  return `
    <div class="home-top">
      <section class="panel pad hero">
        <div class="belt-title pixel">PROCHAIN GALA</div>
        ${nextHtml}
      </section>
      <section class="panel pad">
        <h3>À faire</h3>
        ${items.length ? `<ul class="todo">${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '<p class="pos">Tout est en ordre. Bon gala !</p>'}
      </section>
    </div>
    <section class="panel pad"><h3>Les champions</h3><div class="champ-strip">${champs}</div></section>
    <div class="boards">
      <section class="panel pad board"><h3>En forme <span class="hint">séries de victoires</span></h3>
        <ol>${hot.map((x) => row(x.b, `${x.s} V`)).join('') || '<li class="muted">Pas encore de série.</li>'}</ol></section>
      <section class="panel pad board"><h3>Espoirs à suivre <span class="hint">24 ans et moins</span></h3>
        <ol>${prospects.map((b) => row(b, `pot. ${b.development.potential}`)).join('')}</ol></section>
      <section class="panel pad board"><h3>Derniers résultats ${lastEv ? `<span class="hint">${esc(lastEv.name)}</span>` : ''}</h3>
        <ul class="plain results">${results || '<li class="muted">Aucun gala disputé.</li>'}</ul></section>
    </div>
    <section class="panel pad" style="margin-top:16px"><h3>Actualités</h3><ul class="news">${news || '<li class="muted">Rien pour l’instant.</li>'}</ul></section>`;
}

export function onHomeClick(app: App, target: HTMLElement): boolean {
  const el = target.closest<HTMLElement>('[data-act-home]');
  if (!el) return false;
  app.screen = 'events';
  app.events.fightId = null;
  if (el.dataset.actHome === 'new-gala') app.events.newForm = true;
  else app.events.openEvent = el.dataset.id!;
  return true;
}
