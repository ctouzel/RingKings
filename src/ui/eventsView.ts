/**
 * Écran Galas : créer un gala, composer la carte, disputer, consulter les résultats.
 */
import { addDays, daysBetween, formatDate } from '../core/date';
import { Rng } from '../core/rng';
import { divisionOrder } from '../gen/generator';
import { mandatoryBooked } from '../league/calendar';
import {
  bookFight, canBook, createEvent, deleteEvent, moveFight, plannedEvents, plannedFightsOf,
  replayFight, runEvent, setMainEvent, unbookFight,
} from '../league/events';
import { forecast } from '../league/forecast';
import { autoCard, EVENT_NAMES, proposeFight, VENUES } from '../league/matchmaking';
import { rankOf, stakes } from '../league/ranking';
import { fullName, isAvailable, overallRating, recordString } from '../model/boxer';
import { NATIONALITY_INFO, STYLE_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { BoxerId, Corner, Fight, FightEvent, League, WeightClass } from '../model/types';
import { WEIGHT_CLASSES } from '../model/types';
import { commentary } from '../sim/commentary';
import { esc } from './dom';
import { renderResult } from './fightLab';
import { emptyBuilder, type App } from './state';

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

function rankTag(r: number | null): string {
  return r === 0 ? '<span class="belt sm">C</span>' : r ? `<span class="muted">n°${r}</span>` : '';
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

function fightRow(league: League, f: Fight, editable: boolean, index: number, count: number): string {
  const r = f.result;
  const side = (c: Corner) => {
    const b = league.boxers[f[c]]!;
    const rank = r ? f.rankAtFight[c] : rankOf(league, b.id);
    return `<span class="${r?.winner === c ? 'winner' : r?.winner ? 'loser' : ''}">${NATIONALITY_INFO[b.nationality].flag} ${esc(fullName(b))} ${rankTag(rank)}</span>`;
  };
  const controls = editable ? `
    <div class="fr-ctrl">
      <button class="icon-btn" data-act="up" data-id="${f.id}" ${index === 0 ? 'disabled' : ''} title="Plus tôt dans la soirée">↑</button>
      <button class="icon-btn" data-act="down" data-id="${f.id}" ${index === count - 1 ? 'disabled' : ''} title="Plus tard dans la soirée">↓</button>
      <button class="icon-btn" data-act="main" data-id="${f.id}" ${f.isMainEvent ? 'disabled' : ''} title="En faire le combat principal">★</button>
      <button class="icon-btn danger" data-act="unbook" data-id="${f.id}" title="Retirer de la carte">✕</button>
    </div>` : '';
  return `<li class="fight-row ${f.isMainEvent ? 'main' : ''}" ${r ? `data-fight="${f.id}"` : ''}>
    <div class="fr-top">
      <span class="muted small">${WEIGHT_CLASS_INFO[f.weightClass].label} · ${f.scheduledRounds} rounds</span>
      ${f.isTitleFight ? '<span class="belt sm">TITRE</span>' : ''}${r?.titleChange ? '<span class="belt sm new">NOUVEAU CHAMPION</span>' : ''}
      ${f.isMainEvent ? '<span class="tag sm">COMBAT PRINCIPAL</span>' : ''}
      ${controls}
    </div>
    <div class="fr-body">${side('red')} <span class="vs">vs</span> ${side('blue')}</div>
    ${r ? `<div class="fr-res">${esc(r.summary)}</div>` : ''}
  </li>`;
}

/** Liste déroulante de boxeurs avec raison d'indisponibilité. */
function boxerOptions(app: App, ev: FightEvent, wc: WeightClass, selected: BoxerId | null, exclude: BoxerId | null): string {
  const league = app.league;
  const opts = divisionOrder(league, wc).map((b) => {
    const r = rankOf(league, b.id);
    let reason = '';
    if (!isAvailable(b, ev.date)) reason = `repos jusqu’au ${formatDate(b.unavailableUntil!)}`;
    else if (plannedFightsOf(league, b.id).length) reason = 'déjà programmé';
    const label = `${r === 0 ? 'C' : r ?? '—'}. ${fullName(b)} (${overallRating(b)})${reason ? ` — ${reason}` : ''}`;
    const disabled = (reason && b.id !== selected) || b.id === exclude;
    return `<option value="${b.id}" ${b.id === selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${esc(label)}</option>`;
  });
  return `<option value="">— Choisir —</option>${opts.join('')}`;
}

function matchupPreview(app: App, ev: FightEvent): string {
  const { league } = app;
  const bd = app.events.builder;
  if (!bd.a || !bd.b) return '<p class="muted small">Choisis deux boxeurs pour voir le pronostic et l’enjeu.</p>';
  const err = canBook(league, ev.id, bd.a, bd.b, { rounds: bd.rounds, title: bd.title });
  const A = league.boxers[bd.a]!, B = league.boxers[bd.b]!;
  const rounds = bd.title ? 12 : bd.rounds;
  const fc = forecast(league, A.id, B.id, rounds);
  const st = stakes(league, A.id, B.id, rounds, bd.title);
  const col = (b: typeof A, win: number, ko: number, ptsWin: number, ptsLose: number) => `
    <div class="mu-col">
      <div class="mu-name">${NATIONALITY_INFO[b.nationality].flag} ${esc(fullName(b))} ${rankTag(rankOf(league, b.id))}</div>
      <div class="muted small">${STYLE_INFO[b.style].label} · ${recordString(b.stats)} · note ${overallRating(b)} · pop. ${b.popularity}</div>
      <div class="mu-odds"><b>${pct(win)}</b> de victoire <span class="muted">(${pct(ko)} avant la limite)</span></div>
      <div class="small">Enjeu : <span class="pos">+${ptsWin}</span> / <span class="neg">${ptsLose}</span> pts</div>
    </div>`;
  return `
    ${err ? `<div class="alert">${esc(err)}</div>` : ''}
    <div class="matchup">
      ${col(A, fc.winA, fc.koA, st.aWin, st.aLose)}
      ${col(B, fc.winB, fc.koB, st.bWin, st.bLose)}
    </div>
    <div class="odds-bar" title="Pronostic sur ${300} simulations">
      <span class="oa" style="width:${fc.winA * 100}%"></span><span class="od" style="width:${fc.draw * 100}%"></span><span class="ob" style="width:${fc.winB * 100}%"></span>
    </div>`;
}

function builderPanel(app: App, ev: FightEvent): string {
  const bd = app.events.builder;
  const div = app.league.divisions[bd.division];
  const titleAllowed = !!bd.a && !!bd.b && (div.championId === null || div.championId === bd.a || div.championId === bd.b);
  const err = bd.a && bd.b ? canBook(app.league, ev.id, bd.a, bd.b, { rounds: bd.rounds, title: bd.title }) : 'incomplet';
  return `
    <div class="builder">
      <h3>Ajouter un combat</h3>
      <div class="lab-form inline">
        <label>Catégorie <select data-bind="division">${WEIGHT_CLASSES.map((wc) => `<option value="${wc}" ${wc === bd.division ? 'selected' : ''}>${WEIGHT_CLASS_INFO[wc].label}</option>`).join('')}</select></label>
        <label class="corner-red">Boxeur 1 <select data-bind="a">${boxerOptions(app, ev, bd.division, bd.a, bd.b)}</select></label>
        <label class="corner-blue">Boxeur 2 <select data-bind="b">${boxerOptions(app, ev, bd.division, bd.b, bd.a)}</select></label>
        <label>Rounds <select data-bind="rounds" ${bd.title ? 'disabled' : ''}>${[4, 6, 8, 10, 12].map((r) => `<option ${r === (bd.title ? 12 : bd.rounds) ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" data-bind="title" ${bd.title ? 'checked' : ''} ${titleAllowed ? '' : 'disabled'}> Titre en jeu</label>
      </div>
      ${matchupPreview(app, ev)}
      <div class="row-btns">
        <button class="btn" data-act="book" ${err ? 'disabled' : ''}>Ajouter à la carte</button>
        <button class="btn ghost" data-act="suggest">Suggérer un combat</button>
      </div>
    </div>`;
}

function plannedPanel(app: App, ev: FightEvent, isNext: boolean): string {
  const { league } = app;
  const open = app.events.openEvent === ev.id;
  const fights = ev.fightIds.map((id) => league.fights[id]!);
  const divisionsOnCard = new Set(fights.map((f) => f.weightClass));
  return `
    <section class="panel pad event planned ${open ? 'open' : ''}">
      <div class="ev-head">
        <div>
          <div class="ev-name">${esc(ev.name)} <span class="tag sm">PRÉVU</span></div>
          <div class="muted small">${esc(ev.venue)}, ${esc(ev.city)} · ${formatDate(ev.date)} · dans ${daysBetween(league.currentDate, ev.date)} jours · ${fights.length} combat${fights.length > 1 ? 's' : ''}</div>
        </div>
        <div class="row-btns">
          ${open ? '' : `<button class="btn ghost" data-act="open" data-id="${ev.id}">Composer la carte</button>`}
          <button class="btn" data-act="run" data-id="${ev.id}" ${isNext && fights.length ? '' : 'disabled'}
            title="${isNext ? '' : 'Un gala plus proche doit être disputé avant'}">Disputer le gala</button>
        </div>
      </div>
      ${fights.length ? `<ul class="fights">${fights.map((f, i) => fightRow(league, f, open, i, fights.length)).join('')}</ul>` : '<p class="muted small">La carte est vide.</p>'}
      ${open ? `
        ${builderPanel(app, ev)}
        <div class="row-btns ev-foot">
          <button class="btn ghost" data-act="autofill" data-id="${ev.id}" ${divisionsOnCard.size >= WEIGHT_CLASSES.length ? 'disabled' : ''}>Compléter automatiquement</button>
          <button class="btn ghost" data-act="close">Fermer</button>
          <button class="btn ghost danger" data-act="delete" data-id="${ev.id}">Annuler le gala</button>
        </div>` : ''}
    </section>`;
}

function newEventForm(app: App): string {
  const { league } = app;
  const planned = plannedEvents(league);
  const lastDate = planned.length ? planned[planned.length - 1]!.date : league.currentDate;
  const defDate = addDays(lastDate, 28);
  const nameIdx = Object.keys(league.events).length % EVENT_NAMES.length;
  return `
    <section class="panel pad new-event">
      <h3>Nouveau gala</h3>
      <form id="new-event" class="lab-form inline">
        <label>Nom <input name="name" value="${esc(EVENT_NAMES[nameIdx]!)}" required maxlength="40"></label>
        <label>Date <input type="date" name="date" value="${defDate}" min="${addDays(league.currentDate, 7)}" required></label>
        <label>Salle <select name="venue">${VENUES.map(([v, c], i) => `<option value="${i}">${esc(v)} — ${esc(c)}</option>`).join('')}</select></label>
        <button class="btn" type="submit">Créer</button>
        <button class="btn ghost" type="button" data-act="cancel-new">Annuler</button>
      </form>
    </section>`;
}

function deadlines(league: League): string {
  const rows = WEIGHT_CLASSES.map((wc) => {
    const d = league.divisions[wc];
    if (!d.championId) return `<li class="warn">${WEIGHT_CLASS_INFO[wc].label} : <b>titre vacant</b> — à disputer entre deux membres du top 5</li>`;
    if (!d.mandatoryDue) return '';
    const days = daysBetween(league.currentDate, d.mandatoryDue);
    const booked = mandatoryBooked(league, wc);
    const n1 = d.rankings[0] ? fullName(league.boxers[d.rankings[0]]!) : 'n°1';
    return `<li class="${booked ? 'ok' : days < 90 ? 'warn' : ''}">${WEIGHT_CLASS_INFO[wc].label} : ${esc(fullName(league.boxers[d.championId]!))} vs ${esc(n1)}
      avant le ${formatDate(d.mandatoryDue)} ${booked ? '✓' : `(${days} j)`}</li>`;
  }).join('');
  return `<ul class="deadlines">${rows}</ul>`;
}

export function renderEvents(app: App): string {
  const { league } = app;
  const st = app.events;
  if (st.fightId) {
    const f = league.fights[st.fightId]!;
    const red = league.boxers[f.red]!, blue = league.boxers[f.blue]!;
    const { events } = replayFight(league, f);
    const ev = league.events[f.eventId]!;
    return `
      <button class="btn ghost back" data-back>← Retour aux galas</button>
      <p class="muted">${esc(ev.name)} · ${esc(ev.venue)}, ${esc(ev.city)} · ${formatDate(ev.date)}</p>
      ${renderResult(f.result!, commentary(events, { red: fullName(red), blue: fullName(blue) }), red, blue)}`;
  }

  const planned = plannedEvents(league);
  const done = Object.values(league.events).filter((e) => e.status === 'completed').reverse();
  const news = [...league.news].reverse().slice(0, 25).map((n) => `
    <li class="news-${n.kind}"><span class="muted small">${formatDate(n.date)}</span>${esc(n.text)}</li>`).join('');

  return `
    <div class="events-bar">
      ${st.newForm ? '' : '<button class="btn" data-act="new">+ Nouveau gala</button>'}
      <button class="btn ghost" data-act="quick">Gala rapide (automatique)</button>
    </div>
    ${st.newForm ? newEventForm(app) : ''}
    <div class="lab-grid">
      <div>
        ${planned.length ? '<h3>À venir</h3>' : ''}
        ${planned.map((e, i) => plannedPanel(app, e, i === 0)).join('')}
        <h3>Résultats</h3>
        ${done.length === 0 ? '<p class="muted">Aucun gala disputé.</p>' : done.slice(0, 15).map((e) => `
          <section class="panel pad event">
            <div class="ev-name">${esc(e.name)}</div>
            <div class="muted small">${esc(e.venue)}, ${esc(e.city)} · ${formatDate(e.date)}</div>
            <ul class="fights">${[...e.fightIds].reverse().map((id, i, a) => fightRow(league, league.fights[id]!, false, i, a.length)).join('')}</ul>
          </section>`).join('')}
      </div>
      <div>
        <section class="panel pad"><h3>Échéances des champions</h3>${deadlines(league)}</section>
        <section class="panel pad"><h3>Actualités</h3><ul class="news">${news || '<li class="muted">Rien pour l’instant.</li>'}</ul></section>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Ouvre le compositeur sur un gala, en préparant éventuellement un boxeur. */
export function openBuilderFor(app: App, boxerId: BoxerId | null): void {
  const { league } = app;
  let ev = plannedEvents(league)[0];
  if (!ev) {
    const [venue, city] = VENUES[0]!;
    ev = createEvent(league, { name: EVENT_NAMES[0]!, date: addDays(league.currentDate, 28), venue, city });
  }
  app.screen = 'events';
  app.events.fightId = null;
  app.events.openEvent = ev.id;
  const b = boxerId ? league.boxers[boxerId] : null;
  app.events.builder = emptyBuilder(b?.weightClass ?? app.events.builder.division);
  app.events.builder.a = boxerId;
}

export function onEventsClick(app: App, target: HTMLElement): boolean {
  const { league } = app;
  const st = app.events;
  const el = target.closest<HTMLElement>('[data-act]');
  if (target.closest('[data-back]')) { st.fightId = null; return true; }
  if (!el) {
    const fight = target.closest<HTMLElement>('[data-fight]');
    if (fight) { st.fightId = fight.dataset.fight!; window.scrollTo(0, 0); return true; }
    return false;
  }
  const id = el.dataset.id!;
  const bd = st.builder;
  try {
    switch (el.dataset.act) {
      case 'new': st.newForm = true; return true;
      case 'cancel-new': st.newForm = false; return true;
      case 'open': st.openEvent = id; st.builder = emptyBuilder(bd.division); return true;
      case 'close': st.openEvent = null; return true;
      case 'up': moveFight(league, id, -1); return true;
      case 'down': moveFight(league, id, 1); return true;
      case 'main': setMainEvent(league, id); return true;
      case 'unbook': unbookFight(league, id); return true;
      case 'delete':
        if (!confirm('Annuler ce gala et retirer tous ses combats ?')) return false;
        deleteEvent(league, id); st.openEvent = null; return true;
      case 'book': {
        bookFight(league, st.openEvent!, bd.a!, bd.b!, { rounds: bd.rounds, title: bd.title });
        app.flash = { kind: 'ok', text: `Combat ajouté : ${fullName(league.boxers[bd.a!]!)} vs ${fullName(league.boxers[bd.b!]!)}.` };
        st.builder = emptyBuilder(bd.division);
        return true;
      }
      case 'suggest': {
        const ev = league.events[st.openEvent!]!;
        const p = proposeFight(league, bd.division, ev.date, new Rng(Math.floor(Math.random() * 2 ** 32)), new Set());
        if (!p) { app.flash = { kind: 'err', text: 'Aucun combat possible dans cette catégorie à cette date.' }; return true; }
        st.builder = { division: bd.division, a: p.a, b: p.b, rounds: p.opts.rounds ?? 12, title: !!p.opts.title };
        return true;
      }
      case 'autofill': {
        const ev = league.events[id]!;
        const rng = new Rng(Math.floor(Math.random() * 2 ** 32));
        const onCard = new Set(ev.fightIds.map((f) => league.fights[f]!.weightClass));
        let added = 0;
        for (const wc of WEIGHT_CLASSES.filter((w) => !onCard.has(w))) {
          const p = proposeFight(league, wc, ev.date, rng, new Set());
          if (p) { bookFight(league, ev.id, p.a, p.b, { ...p.opts, seed: rng.seed() }); added++; }
        }
        app.flash = { kind: added ? 'ok' : 'err', text: added ? `${added} combat(s) ajouté(s).` : 'Aucun combat disponible à ajouter.' };
        return true;
      }
      case 'run': {
        const ev = league.events[id]!;
        runEvent(league, id);
        st.openEvent = null;
        app.flash = { kind: 'ok', text: `${ev.name} disputé ! Résultats ci-dessous.` };
        return true;
      }
      case 'quick': {
        const planned = plannedEvents(league);
        const date = addDays(planned.length ? planned[planned.length - 1]!.date : league.currentDate, 28);
        // Le gala rapide ne peut se disputer tout de suite que s'il est le prochain.
        const rng = new Rng(Math.floor(Math.random() * 2 ** 32));
        const ev = autoCard(league, rng, date);
        if (plannedEvents(league)[0]?.id === ev.id && ev.fightIds.length) {
          runEvent(league, ev.id);
          app.flash = { kind: 'ok', text: `${ev.name} disputé !` };
        } else {
          app.flash = { kind: 'ok', text: `${ev.name} ajouté au calendrier (après tes galas prévus).` };
        }
        return true;
      }
    }
  } catch (e) {
    app.flash = { kind: 'err', text: (e as Error).message };
    return true;
  }
  return false;
}

export function onEventsChange(app: App, el: HTMLInputElement | HTMLSelectElement): boolean {
  const bd = app.events.builder;
  switch (el.dataset.bind) {
    case 'division': app.events.builder = emptyBuilder(el.value as WeightClass); return true;
    case 'a': bd.a = el.value || null; bd.title = false; return true;
    case 'b': bd.b = el.value || null; bd.title = false; return true;
    case 'rounds': bd.rounds = Number(el.value) as typeof bd.rounds; return true;
    case 'title': bd.title = (el as HTMLInputElement).checked; return true;
  }
  return false;
}

export function onEventsSubmit(app: App, form: HTMLFormElement): boolean {
  if (form.id !== 'new-event') return false;
  const data = new FormData(form);
  const [venue, city] = VENUES[Number(data.get('venue'))]!;
  try {
    const ev = createEvent(app.league, {
      name: String(data.get('name')).trim() || 'Gala', date: String(data.get('date')), venue, city,
    });
    app.events.newForm = false;
    app.events.openEvent = ev.id;
    app.flash = { kind: 'ok', text: `${ev.name} créé. Compose maintenant la carte.` };
  } catch (e) {
    app.flash = { kind: 'err', text: (e as Error).message };
  }
  return true;
}
