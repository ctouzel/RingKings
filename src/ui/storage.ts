/**
 * Sauvegardes : 3 emplacements dans IndexedDB (assez de place pour des ligues
 * de plusieurs saisons), export / import en fichier JSON.
 * Si IndexedDB est indisponible (navigation privée stricte…), on se rabat sur
 * localStorage, puis sur la mémoire.
 */
import { deserializeLeague, serializeLeague } from '../model/league';
import type { League } from '../model/types';

export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];

export interface SlotMeta {
  slot: Slot;
  name: string;
  currentDate: string;
  seasonYear: number;
  fights: number;
  savedAt: string; // ISO (heure réelle)
}

interface Record_ { slot: Slot; meta: SlotMeta; json: string }

const DB_NAME = 'ringkings';
const STORE = 'slots';
const ACTIVE_KEY = 'ringkings.activeSlot';
const LEGACY_KEY = 'ringkings.save';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<Slot, Record_>();

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const lsKey = (slot: Slot) => `ringkings.slot.${slot}`;

async function readRecord(slot: Slot): Promise<Record_ | undefined> {
  const db = await openDb();
  if (db) return tx<Record_ | undefined>(db, 'readonly', (s) => s.get(slot) as IDBRequest<Record_ | undefined>);
  try {
    const raw = localStorage.getItem(lsKey(slot));
    if (raw) return JSON.parse(raw) as Record_;
  } catch { /* indisponible */ }
  return memory.get(slot);
}

async function writeRecord(rec: Record_): Promise<void> {
  const db = await openDb();
  if (db) { await tx(db, 'readwrite', (s) => s.put(rec)); return; }
  try { localStorage.setItem(lsKey(rec.slot), JSON.stringify(rec)); return; } catch { /* plein ou indisponible */ }
  memory.set(rec.slot, rec);
}

export function metaOf(league: League, slot: Slot): SlotMeta {
  return {
    slot, name: league.name, currentDate: league.currentDate, seasonYear: league.seasonYear,
    fights: Object.values(league.fights).filter((f) => f.result).length,
    savedAt: new Date().toISOString(),
  };
}

export async function saveSlot(slot: Slot, league: League): Promise<void> {
  await writeRecord({ slot, meta: metaOf(league, slot), json: serializeLeague(league) });
}

export async function loadSlot(slot: Slot): Promise<League | null> {
  const rec = await readRecord(slot);
  return rec ? deserializeLeague(rec.json) : null;
}

export async function deleteSlot(slot: Slot): Promise<void> {
  const db = await openDb();
  if (db) await tx(db, 'readwrite', (s) => s.delete(slot));
  try { localStorage.removeItem(lsKey(slot)); } catch { /* rien */ }
  memory.delete(slot);
}

export async function listSlots(): Promise<(SlotMeta | null)[]> {
  return Promise.all(SLOTS.map(async (s) => (await readRecord(s))?.meta ?? null));
}

export function activeSlot(): Slot {
  try {
    const v = Number(localStorage.getItem(ACTIVE_KEY));
    if (SLOTS.includes(v as Slot)) return v as Slot;
  } catch { /* rien */ }
  return 1;
}

export function setActiveSlot(slot: Slot): void {
  try { localStorage.setItem(ACTIVE_KEY, String(slot)); } catch { /* rien */ }
}

/** Ancienne sauvegarde unique (localStorage) -> emplacement 1, une seule fois. */
export async function migrateLegacy(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    if (!(await readRecord(1))) await saveSlot(1, deserializeLeague(raw));
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* sauvegarde illisible : ignorée */ }
}

// ---------------------------------------------------------------------------
// Fichiers
// ---------------------------------------------------------------------------

export function exportFile(league: League): void {
  const blob = new Blob([serializeLeague(league)], { type: 'application/json' });
  const a = document.createElement('a');
  const safe = league.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-');
  a.href = URL.createObjectURL(blob);
  a.download = `ringkings-${safe}-${league.currentDate}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Lit un fichier exporté ; lève une erreur lisible s'il n'est pas valide. */
export async function importFile(file: File): Promise<League> {
  const text = await file.text();
  let raw: Partial<League>;
  try { raw = JSON.parse(text) as Partial<League>; } catch { throw new Error('Ce fichier n’est pas un fichier JSON valide.'); }
  if (!raw || typeof raw !== 'object' || !raw.boxers || !raw.divisions || !raw.currentDate || !raw.saveVersion) {
    throw new Error('Ce fichier n’est pas une ligue RingKings.');
  }
  try {
    return deserializeLeague(text);
  } catch (e) {
    throw new Error(`Ligue illisible : ${(e as Error).message}`);
  }
}
