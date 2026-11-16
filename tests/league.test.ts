import { describe, expect, it } from 'vitest';
import { addDays } from '../src/core/date';
import { Rng } from '../src/core/rng';
import { divisionOrder, generateLeague } from '../src/gen/generator';
import { advanceTo } from '../src/league/calendar';
import { bookFight, canBook, createEvent, replayFight, runEvent } from '../src/league/events';
import { autoCard } from '../src/league/matchmaking';
import { decay, rankOf, rankingPoints } from '../src/league/ranking';
import type { League } from '../src/model/types';
import { WEIGHT_CLASSES } from '../src/model/types';

const fresh = () => generateLeague({ seed: 314 });

describe('galas et validations', () => {
  it('refuse les combats impossibles', () => {
    const l = fresh();
    const ev = createEvent(l, { name: 'Test', date: addDays(l.currentDate, 30), venue: 'V', city: 'C' });
    const heavy = divisionOrder(l, 'heavyweight'), light = divisionOrder(l, 'lightweight');
    expect(canBook(l, ev.id, heavy[0]!.id, light[0]!.id)).toMatch(/même catégorie/);
    expect(canBook(l, ev.id, heavy[3]!.id, heavy[4]!.id, { title: true })).toMatch(/champion/);
    expect(canBook(l, ev.id, heavy[0]!.id, heavy[14]!.id, { title: true })).toMatch(/top 10/);
    bookFight(l, ev.id, heavy[1]!.id, heavy[2]!.id);
    expect(canBook(l, ev.id, heavy[1]!.id, heavy[3]!.id)).toMatch(/déjà programmé/);
  });

  it('met à jour palmarès, ceinture et classement après un combat de titre', () => {
    const l = fresh();
    const heavy = divisionOrder(l, 'heavyweight');
    const champ = heavy[0]!, chall = heavy[1]!;
    const before = { c: { ...champ.stats }, ch: { ...chall.stats } };
    const ev = createEvent(l, { name: 'Titre', date: addDays(l.currentDate, 30), venue: 'V', city: 'C' });
    const f = bookFight(l, ev.id, chall.id, champ.id, { title: true, seed: 42 });
    expect(f.red).toBe(champ.id); // le champion est dans le coin rouge
    expect(f.scheduledRounds).toBe(12);
    runEvent(l, ev.id);

    const r = f.result!;
    expect(champ.stats.fights).toBe(before.c.fights + 1);
    expect(chall.stats.fights).toBe(before.ch.fights + 1);
    expect(champ.stats.titleFights).toBe(before.c.titleFights + 1);
    expect(champ.fightIds).toContain(f.id);
    expect(f.rankAtFight).toEqual({ red: 0, blue: 1 });
    expect(f.snapshot).toBeDefined();

    const div = l.divisions.heavyweight;
    if (r.winner === 'blue') {
      expect(div.championId).toBe(chall.id);
      expect(r.titleChange).toBe(true);
      expect(div.titleHistory.at(-2)!.endedBy).toBe('defeat');
    } else {
      expect(div.championId).toBe(champ.id);
    }
    if (r.winner) {
      // Défense contre le n°1 => nouvelle échéance obligatoire à +1 an.
      expect(div.mandatoryDue).toBe(addDays(f.date, 365));
      const loser = r.winner === 'red' ? 'blue' : 'red';
      expect(r.rankingPoints![r.winner]).toBeGreaterThan(0);
      expect(r.rankingPoints![loser]).toBeLessThan(0);
    }
    expect(l.news.length).toBeGreaterThan(0);
  });

  it('rejoue un combat disputé à l’identique', () => {
    const l = fresh();
    const ev = autoCard(l, new Rng(9));
    runEvent(l, ev.id);
    for (const id of ev.fightIds) {
      const f = l.fights[id]!;
      expect(replayFight(l, f).result.summary).toBe(f.result!.summary);
    }
  });
});

describe('défense obligatoire', () => {
  it('déclare le titre vacant si le champion ne défend pas à temps', () => {
    const l = fresh();
    const div = l.divisions.middleweight;
    const champ = div.championId!;
    advanceTo(l, addDays(div.mandatoryDue!, 1));
    expect(div.championId).toBeNull();
    expect(div.titleHistory.at(-1)!.endedBy).toBe('vacated');
    expect(div.rankings).toContain(champ); // l'ex-champion redevient un aspirant
    expect(l.news.some((n) => n.kind === 'vacated')).toBe(true);
  });

  it('un titre vacant se dispute entre membres du top 5 et couronne le vainqueur', () => {
    const l = fresh();
    const div = l.divisions.middleweight;
    advanceTo(l, addDays(div.mandatoryDue!, 1));
    const ev = createEvent(l, { name: 'Vacant', date: addDays(l.currentDate, 30), venue: 'V', city: 'C' });
    const [a, b] = div.rankings;
    // On cherche un seed sans match nul pour vérifier le couronnement.
    const f = bookFight(l, ev.id, a!, b!, { title: true, seed: 7 });
    runEvent(l, ev.id);
    if (f.result!.winner) {
      expect(div.championId).toBe(f.result!.winner === 'red' ? f.red : f.blue);
      expect(div.mandatoryDue).toBe(addDays(f.date, 365));
    } else {
      expect(div.championId).toBeNull();
    }
  });
});

describe('classement par points', () => {
  it('les points s’effacent avec le temps', () => {
    expect(decay('2026-01-01', '2026-06-01')).toBe(1);
    expect(decay('2026-01-01', '2027-06-01')).toBeGreaterThan(0);
    expect(decay('2026-01-01', '2027-06-01')).toBeLessThan(1);
    expect(decay('2026-01-01', '2028-06-01')).toBe(0);
  });

  it('le classement initial correspond aux points hérités', () => {
    const l = fresh();
    for (const wc of WEIGHT_CLASSES) {
      const pts = l.divisions[wc].rankings.map((id) => rankingPoints(l, l.boxers[id]!));
      expect([...pts].sort((a, b) => b - a)).toEqual(pts);
    }
  });
});

describe('simulation de 3 ans de galas', () => {
  const l: League = fresh();
  const rng = new Rng(2026);
  let events = 0;
  for (let i = 0; i < 39; i++) {
    const ev = autoCard(l, rng, addDays(l.currentDate, 28));
    runEvent(l, ev.id);
    events++;
  }

  it('dispute les galas et fait avancer le temps', () => {
    expect(events).toBe(39);
    expect(l.currentDate > '2028-12-01').toBe(true);
    expect(Object.values(l.fights).filter((f) => f.result).length).toBeGreaterThan(120);
  });

  it('garde des palmarès cohérents', () => {
    for (const b of Object.values(l.boxers)) {
      const s = b.stats;
      expect(s.wins + s.losses + s.draws).toBe(s.fights);
      expect(s.koWins).toBeLessThanOrEqual(s.wins);
      for (const id of b.fightIds) {
        const f = l.fights[id]!;
        expect([f.red, f.blue]).toContain(b.id);
        expect(f.result).toBeDefined();
      }
    }
  });

  it('garde des divisions cohérentes', () => {
    for (const wc of WEIGHT_CLASSES) {
      const d = l.divisions[wc];
      const members = Object.values(l.boxers).filter((b) => b.weightClass === wc).length;
      expect(d.rankings.length + (d.championId ? 1 : 0)).toBe(members);
      if (d.championId) {
        expect(rankOf(l, d.championId)).toBe(0);
        expect(d.titleHistory.at(-1)!.boxerId).toBe(d.championId);
        expect(d.titleHistory.at(-1)!.lostOn).toBeUndefined();
        expect(d.mandatoryDue! >= l.currentDate).toBe(true);
      }
      // Un seul règne ouvert à la fois.
      expect(d.titleHistory.filter((r) => !r.lostOn).length).toBe(d.championId ? 1 : 0);
    }
  });

  it('produit des changements de titre et des actualités', () => {
    const changes = Object.values(l.fights).filter((f) => f.result?.titleChange).length;
    expect(changes).toBeGreaterThan(0);
    expect(l.news.length).toBeGreaterThan(20);
  });
});
