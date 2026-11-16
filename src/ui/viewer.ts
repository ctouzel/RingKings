/**
 * Fenêtre de visionnage d'un combat (lecteur 8-bit).
 * Elle vit en dehors de #app : le reste de l'interface peut se ré-afficher
 * sans interrompre l'animation.
 */
import { replayFight } from '../league/events';
import { formatDate } from '../core/date';
import { fullName, recordString } from '../model/boxer';
import { NATIONALITY_INFO, WEIGHT_CLASS_INFO } from '../model/labels';
import type { Boxer, CareerStats, Corner, Fight, FightResult, League } from '../model/types';
import { TRUNKS_COLORS } from '../gen/generator';
import type { SimEvent } from '../sim/engine';
import { drawFighter } from '../viz/fighterSprite';
import { FightPlayer, type PlayerCorner } from '../viz/player';
import { POSES } from '../viz/poses';

let current: { player: FightPlayer; host: HTMLElement; onKey: (e: KeyboardEvent) => void } | null = null;

function corner(b: Boxer, extra: string, record: CareerStats, trunks?: string): PlayerCorner {
  return {
    name: fullName(b),
    flag: NATIONALITY_INFO[b.nationality].flag,
    look: { appearance: trunks ? { ...b.appearance, trunksColor: trunks } : b.appearance, heightCm: b.heightCm },
    sub: `${recordString(record)}${extra}`,
  };
}

/** Si les deux shorts se ressemblent, le coin bleu porte une autre couleur. */
function contrastingTrunks(red: string, blue: string): string | undefined {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [rgb(red), rgb(blue)];
  const dist = Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
  if (dist > 90) return undefined;
  return TRUNKS_COLORS.map((c) => ({ c, d: Math.hypot(...rgb(c).map((v, i) => v - a[i]!)) }))
    .sort((x, y) => y.d - x.d)[0]!.c;
}

/** Palmarès d'un boxeur juste avant un combat (sans ce combat ni les suivants). */
export function recordBefore(league: League, b: Boxer, fight: Fight | null): CareerStats {
  const s = { ...b.stats };
  if (!fight) return s;
  const idx = b.fightIds.indexOf(fight.id);
  if (idx < 0) return s;
  for (const id of b.fightIds.slice(idx)) {
    const f = league.fights[id]!, r = f.result!;
    const me: Corner = f.red === b.id ? 'red' : 'blue';
    const ko = r.method === 'KO' || r.method === 'TKO';
    s.fights--;
    if (r.winner === null) s.draws--;
    else if (r.winner === me) { s.wins--; if (ko) s.koWins--; }
    else { s.losses--; if (ko) s.koLosses--; }
  }
  return s;
}

export function closeViewer(): void {
  if (!current) return;
  current.player.destroy();
  current.host.remove();
  document.removeEventListener('keydown', current.onKey);
  document.body.classList.remove('no-scroll');
  current = null;
}

export function openViewer(opts: {
  events: SimEvent[]; result: FightResult; red: Boxer; blue: Boxer; title: string;
  rank?: Record<Corner, number | null>; records?: Record<Corner, CareerStats>; onClose?: () => void;
}): void {
  closeViewer();
  const host = document.createElement('div');
  host.className = 'viewer-modal';
  document.body.appendChild(host);
  document.body.classList.add('no-scroll');
  const rankTxt = (r: number | null | undefined) => (r === 0 ? ' · Champion' : r ? ` · n°${r}` : '');
  const player = new FightPlayer(host, {
    events: opts.events, result: opts.result, title: opts.title,
    red: corner(opts.red, rankTxt(opts.rank?.red), opts.records?.red ?? opts.red.stats),
    blue: corner(opts.blue, rankTxt(opts.rank?.blue), opts.records?.blue ?? opts.blue.stats,
      contrastingTrunks(opts.red.appearance.trunksColor, opts.blue.appearance.trunksColor)),
    onClose: () => { closeViewer(); opts.onClose?.(); },
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { closeViewer(); opts.onClose?.(); } else player.key(e);
  };
  document.addEventListener('keydown', onKey);
  current = { player, host, onKey };
  // Accès de débogage depuis la console du navigateur.
  (window as unknown as { ringkingsPlayer: FightPlayer }).ringkingsPlayer = player;
}

/** Regarder un combat disputé de la ligue (rejoué à l'identique). */
export function watchFight(league: League, fight: Fight, onClose?: () => void): void {
  const ev = league.events[fight.eventId]!;
  const { events } = replayFight(league, fight);
  const title = `${ev.name} · ${WEIGHT_CLASS_INFO[fight.weightClass].label}${fight.isTitleFight ? ' · Championnat' : ''} · ${formatDate(fight.date)}`;
  const red = league.boxers[fight.red]!, blue = league.boxers[fight.blue]!;
  openViewer({
    events, result: fight.result!, red, blue, title, rank: fight.rankAtFight, onClose,
    records: { red: recordBefore(league, red, fight), blue: recordBefore(league, blue, fight) },
  });
}

/** Dessine les aperçus de sprites (<canvas data-sprite="id">) après un rendu. */
export function paintSprites(league: League, root: ParentNode): void {
  for (const cv of root.querySelectorAll<HTMLCanvasElement>('canvas[data-sprite]')) {
    const b = league.boxers[cv.dataset.sprite!];
    if (!b) continue;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, cv.width, cv.height);
    drawFighter(g, POSES.guard, { appearance: b.appearance, heightCm: b.heightCm }, Math.floor(cv.width / 2) - 2, cv.height - 3, 1);
  }
}
