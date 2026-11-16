import { describe, expect, it } from 'vitest';
import { addDays } from '../src/core/date';
import { divisionOrder, generateLeague } from '../src/gen/generator';
import {
  bookFight, createEvent, deleteEvent, moveFight, plannedEvents, runEvent, setMainEvent,
} from '../src/league/events';
import { forecast } from '../src/league/forecast';
import { stakes } from '../src/league/ranking';

describe('composition de la carte', () => {
  const l = generateLeague({ seed: 55 });
  const ev = createEvent(l, { name: 'G', date: addDays(l.currentDate, 30), venue: 'V', city: 'C' });
  const h = divisionOrder(l, 'heavyweight'), m = divisionOrder(l, 'middleweight'), w = divisionOrder(l, 'welterweight');
  const f1 = bookFight(l, ev.id, h[3]!.id, h[4]!.id);
  const f2 = bookFight(l, ev.id, m[3]!.id, m[4]!.id);
  const f3 = bookFight(l, ev.id, w[3]!.id, w[4]!.id);

  it('le dernier combat ajouté est le combat principal', () => {
    expect(ev.fightIds).toEqual([f1.id, f2.id, f3.id]);
    expect(f3.isMainEvent).toBe(true);
    expect(f1.isMainEvent).toBe(false);
  });

  it('réordonne la carte et choisit le combat principal', () => {
    moveFight(l, f3.id, -1);
    expect(ev.fightIds).toEqual([f1.id, f3.id, f2.id]);
    expect(f2.isMainEvent).toBe(true);
    setMainEvent(l, f1.id);
    expect(ev.fightIds.at(-1)).toBe(f1.id);
    expect(f1.isMainEvent).toBe(true);
    expect(f2.isMainEvent).toBe(false);
    moveFight(l, ev.fightIds[0]!, -1); // déjà en tête : rien ne change
    expect(ev.fightIds).toHaveLength(3);
  });

  it('impose l’ordre chronologique et annule un gala', () => {
    const later = createEvent(l, { name: 'Plus tard', date: addDays(l.currentDate, 60), venue: 'V', city: 'C' });
    bookFight(l, later.id, h[6]!.id, h[7]!.id);
    expect(plannedEvents(l).map((e) => e.id)).toEqual([ev.id, later.id]);
    expect(() => runEvent(l, later.id)).toThrow(/chronologique/);
    deleteEvent(l, later.id);
    expect(l.events[later.id]).toBeUndefined();
    expect(Object.values(l.fights).some((f) => f.eventId === later.id)).toBe(false);
    runEvent(l, ev.id);
    expect(ev.status).toBe('completed');
  });

  it('refuse de disputer une carte vide', () => {
    const empty = createEvent(l, { name: 'Vide', date: addDays(l.currentDate, 30), venue: 'V', city: 'C' });
    expect(() => runEvent(l, empty.id)).toThrow(/vide/);
  });
});

describe('pronostic et enjeu', () => {
  const l = generateLeague({ seed: 56 });
  const h = divisionOrder(l, 'heavyweight');

  it('les probabilités somment à 1 et favorisent le meilleur', () => {
    const fc = forecast(l, h[0]!.id, h[13]!.id, 12, 200);
    expect(fc.winA + fc.winB + fc.draw).toBeCloseTo(1, 5);
    expect(fc.winA).toBeGreaterThan(fc.winB);
    expect(fc.koA).toBeLessThanOrEqual(fc.winA);
  });

  it('battre un mieux classé rapporte plus', () => {
    const s = stakes(l, h[1]!.id, h[10]!.id, 10, false);
    expect(s.bWin).toBeGreaterThan(s.aWin); // n°10 qui bat le n°1 gagne plus
    expect(s.aLose).toBeLessThan(s.bLose); // n°1 qui perd contre le n°10 perd plus
  });
});
