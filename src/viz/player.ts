/**
 * Lecteur de combat 8-bit : canvas 256×224 + HUD en HTML + contrôles.
 * Rejoue fidèlement les événements du moteur (même seed => même combat).
 */
import { formatClock, type SimEvent } from '../sim/engine';
import type { Corner, FightResult } from '../model/types';
import { drawFighter, posePoint, U, type SpriteLook } from './fighterSprite';
import { frameAt, type Frame } from './frame';
import { POSES } from './poses';
import { isMuted, setMuted, sfx } from './audio';
import { TIMING } from './timeline';
import { drawBackground, drawRingFront, drawShadow, drawSpark, GROUND_Y, H, REF_Y, W } from './scene';
import { addResult, buildTimeline, type Timeline, type ViewMode } from './timeline';

export interface PlayerCorner {
  name: string;
  flag: string;
  look: SpriteLook;
  sub: string; // ex. "28-2-0 · n°1"
}

export interface PlayerOptions {
  events: SimEvent[];
  result: FightResult;
  red: PlayerCorner;
  blue: PlayerCorner;
  title?: string;
  mode?: ViewMode;
  onClose?: () => void;
}

const REFEREE: SpriteLook = {
  heightCm: 176, shirt: '#f4f4f4', pants: '#202028',
  appearance: { skinTone: 1, hairStyle: 1, hairColor: 1, trunksColor: '#202028', glovesColor: '#f0b888', build: 'slim', facialHair: 0 },
};

export class FightPlayer {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private tl!: Timeline;
  private t = 0;
  private speed = 1;
  private playing = true;
  private raf = 0;
  private lastTs = 0;
  private els: Record<string, HTMLElement> = {};
  /** Sons à déclencher (instant, action), recalculés à chaque changement de mode. */
  private cues: { at: number; play: () => void }[] = [];
  private lastSoundT = 0;
  private names: Record<Corner, string>;

  constructor(container: HTMLElement, private opts: PlayerOptions) {
    this.names = { red: opts.red.name, blue: opts.blue.name };
    container.innerHTML = this.template();
    this.root = container.querySelector('.viewer')!;
    this.canvas = this.root.querySelector('canvas')!;
    this.g = this.canvas.getContext('2d')!;
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-el]')) this.els[el.dataset.el!] = el;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.els.seek!.addEventListener('input', (e) => { this.t = Number((e.target as HTMLInputElement).value) * this.tl.duration / 1000; this.draw(); });
    this.setMode(opts.mode ?? 'summary');
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame((ts) => this.loop(ts));
  }

  private template(): string {
    const o = this.opts;
    const plate = (c: Corner, p: PlayerCorner) => `
      <div class="vw-plate ${c}">
        <div class="vw-name">${p.flag} ${escapeHtml(p.name)}</div>
        <div class="vw-sub">${escapeHtml(p.sub)}</div>
        <div class="vw-bar"><span data-el="hp-${c}"></span></div>
      </div>`;
    return `
      <div class="viewer">
        ${o.title ? `<div class="vw-title">${escapeHtml(o.title)}</div>` : ''}
        <div class="vw-hud">
          ${plate('red', o.red)}
          <div class="vw-clock"><div data-el="round">R1</div><div data-el="clock">0:00</div></div>
          ${plate('blue', o.blue)}
        </div>
        <div class="vw-stage">
          <canvas width="${W}" height="${H}"></canvas>
          <div class="vw-banner" data-el="banner"></div>
        </div>
        <div class="vw-comment" data-el="comment">&nbsp;</div>
        <input type="range" class="vw-seek" data-el="seek" min="0" max="1000" value="0" aria-label="Position dans le combat">
        <div class="vw-controls">
          <button data-ctl="play" data-el="play" title="Lecture / pause (espace)">❚❚</button>
          <span class="vw-group">${[1, 2, 4].map((s) => `<button data-ctl="speed" data-v="${s}" class="${s === 1 ? 'on' : ''}">×${s}</button>`).join('')}</span>
          <span class="vw-group"><button data-ctl="mode" data-v="summary" class="on">Résumé</button><button data-ctl="mode" data-v="full">Complet</button></span>
          <button data-ctl="next" title="Round suivant">Round ⏭</button>
          <button data-ctl="end" title="Aller au résultat">Résultat ⏩</button>
          <button data-ctl="mute" data-el="mute" title="Son">${isMuted() ? '🔇' : '🔊'}</button>
          ${this.opts.onClose ? '<button data-ctl="close" class="vw-close">Fermer ✕</button>' : ''}
        </div>
      </div>`;
  }

  setMode(mode: ViewMode): void {
    // On garde le round en cours quand on change de mode.
    const round = this.tl ? this.currentRoundIndex() : 0;
    const r = this.opts.result;
    const tl = buildTimeline(this.opts.events, this.names, mode);
    this.tl = addResult(tl, r.winner, r.summary, r.winner ? this.names[r.winner] : null);
    this.t = this.tl.roundStarts[round] ?? 0;
    this.buildCues();
    this.lastSoundT = this.t;
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-ctl="mode"]')) b.classList.toggle('on', b.dataset.v === mode);
    this.draw();
  }

  private currentRoundIndex(): number {
    let i = 0;
    this.tl.roundStarts.forEach((s, k) => { if (this.t >= s) i = k; });
    return i;
  }

  private onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ctl]');
    if (!b) return;
    switch (b.dataset.ctl) {
      case 'play':
        if (this.t >= this.tl.duration) this.t = 0;
        this.playing = !this.playing;
        break;
      case 'speed':
        this.speed = Number(b.dataset.v);
        for (const x of this.root.querySelectorAll<HTMLElement>('[data-ctl="speed"]')) x.classList.toggle('on', x === b);
        break;
      case 'mode': this.setMode(b.dataset.v as ViewMode); break;
      case 'next': {
        const next = this.tl.roundStarts.find((s) => s > this.t + 0.01);
        this.t = next ?? this.resultTime();
        break;
      }
      case 'end': this.t = this.resultTime(); this.playing = true; break;
      case 'close': this.destroy(); this.opts.onClose?.(); return;
      case 'mute':
        setMuted(!isMuted());
        b.textContent = isMuted() ? '🔇' : '🔊';
        break;
    }
    this.draw();
  }

  private resultTime(): number {
    return this.tl.beats.find((b) => b.kind === 'result')?.at ?? this.tl.duration;
  }

  /** Pour le débogage et les tests : timeline et positionnement. */
  get timeline(): Timeline { return this.tl; }
  seek(t: number, play = false): void { this.t = t; this.playing = play; this.draw(); }

  /** Raccourcis clavier (à brancher par l'écran qui affiche le lecteur). */
  key(e: KeyboardEvent): void {
    if (e.key === ' ') { e.preventDefault(); this.playing = !this.playing; this.draw(); }
    if (e.key === 'ArrowRight') { this.t = Math.min(this.tl.duration, this.t + 5); this.draw(); }
    if (e.key === 'ArrowLeft') { this.t = Math.max(0, this.t - 5); this.draw(); }
  }

  private loop(ts: number): void {
    const dt = Math.min(0.1, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (this.playing) {
      const prev = this.t;
      this.t = Math.min(this.tl.duration, this.t + dt * this.speed);
      if (this.t >= this.tl.duration) this.playing = false;
      this.playSounds(prev, this.t);
    }
    this.lastSoundT = this.t;
    this.draw();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  /** Prépare la liste des sons à partir de la timeline. */
  private buildCues(): void {
    const cues: { at: number; play: () => void }[] = [];
    let first = true;
    for (const b of this.tl.beats) {
      switch (b.kind) {
        case 'roundIntro':
          if (first) { cues.push({ at: 0, play: () => sfx.fanfare() }); first = false; }
          cues.push({ at: b.at + (b.round === 1 ? 1.1 : 0.2), play: () => sfx.bell(3) });
          break;
        case 'punch':
          cues.push({
            at: b.at + b.dur * 0.4,
            play: b.landed ? () => sfx.punch(b.damage, b.clean, b.punch === 'body') : () => { if (this.speed < 4) sfx.whoosh(); },
          });
          if (b.landed && b.clean && b.damage >= 10) cues.push({ at: b.at + b.dur * 0.5, play: () => sfx.crowd(0.6) });
          break;
        case 'knockdown': {
          cues.push({ at: b.at + 0.3, play: () => sfx.crowd(1.3) });
          const per = (b.dur - TIMING.fall - (b.getsUp ? TIMING.getUp : 0)) / b.count;
          for (let k = 1; k <= b.count; k++) cues.push({ at: b.at + TIMING.fall + (k - 1) * per, play: () => sfx.count(k) });
          if (!b.getsUp) cues.push({ at: b.at + TIMING.fall + b.count * per, play: () => sfx.ko() });
          break;
        }
        case 'stoppage': if (b.reason !== 'KO') cues.push({ at: b.at, play: () => sfx.ko() }); break;
        case 'roundEnd': cues.push({ at: b.at, play: () => sfx.bell(1) }); break;
        case 'decision': cues.push({ at: b.at, play: () => sfx.drumroll() }); break;
        case 'result': cues.push({ at: b.at + 0.2, play: () => (b.winner ? sfx.victory() : sfx.bell(2)) }); break;
      }
    }
    this.cues = cues.sort((a, b) => a.at - b.at);
  }

  /** Joue les sons entre deux instants (seulement en lecture continue, pas lors d'un saut). */
  private playSounds(from: number, to: number): void {
    if (from !== this.lastSoundT || to - from > 0.5) return;
    for (const c of this.cues) {
      if (c.at > to) break;
      if (c.at > from || (from === 0 && c.at === 0)) c.play();
    }
  }

  private draw(): void {
    const fr = frameAt(this.tl, this.t, this.names);
    this.drawCanvas(fr);
    this.drawHud(fr);
  }

  private drawCanvas(fr: Frame): void {
    const g = this.g;
    g.save();
    if (fr.shake) g.translate(Math.round(Math.sin(this.t * 90) * fr.shake), Math.round(Math.cos(this.t * 77) * fr.shake));
    drawBackground(g, this.t, fr.excitement);
    // Positions : unités de la logique (256 de large) -> pixels, à l'échelle des sprites, centrées.
    const X = (x: number) => Math.round(W / 2 + (x - 128) * U);
    drawShadow(g, X(fr.ref.x), REF_Y, 18);
    drawFighter(g, fr.ref.pose, REFEREE, X(fr.ref.x), REF_Y, fr.ref.facing);
    for (const c of ['red', 'blue'] as const) {
      const lying = fr[c].pose === POSES.down;
      drawShadow(g, X(fr[c].x) + (lying ? (c === 'red' ? -12 : 12) : 0), GROUND_Y + 1, lying ? 42 : 26);
    }
    // Le boxeur au sol est dessiné en premier ; sinon le coin rouge d'abord.
    const lying = (c: Corner) => fr[c].pose === POSES.down || fr[c].pose === POSES.kneel;
    const order: Corner[] = lying('blue') && !lying('red') ? ['blue', 'red'] : ['red', 'blue'];
    for (const c of order) {
      const look = this.opts[c].look;
      drawFighter(g, fr[c].pose, look, X(fr[c].x), GROUND_Y, c === 'red' ? 1 : -1);
    }
    if (fr.spark) {
      const c = fr.spark.on;
      const pose = fr[c].pose;
      const pt = posePoint(fr.spark.body ? { x: pose.shoulder.x + 3, y: (pose.shoulder.y + pose.hip.y) / 2 } : { x: pose.head.x + 4, y: pose.head.y - 8 },
        X(fr[c].x), GROUND_Y, c === 'red' ? 1 : -1, this.opts[c].look.heightCm);
      drawSpark(g, Math.round(pt.x), Math.round(pt.y), fr.spark.size, fr.spark.clean);
    }
    drawRingFront(g);
    g.restore();
  }

  private hudCache: Record<string, string> = {};
  private set(key: string, value: string, apply: (el: HTMLElement, v: string) => void): void {
    if (this.hudCache[key] === value) return;
    this.hudCache[key] = value;
    apply(this.els[key]!, value);
  }

  private drawHud(fr: Frame): void {
    const text = (el: HTMLElement, v: string) => { el.textContent = v; };
    for (const c of ['red', 'blue'] as const) {
      this.set(`hp-${c}`, String(Math.round(fr.hp[c])), (el, v) => {
        el.style.width = `${v}%`;
        el.className = Number(v) < 25 ? 'low' : Number(v) < 50 ? 'mid' : '';
      });
    }
    this.set('round', `ROUND ${fr.round}`, text);
    this.set('clock', formatClock(fr.clock), text);
    this.set('comment', fr.comment || ' ', text);
    this.set('banner', fr.banner ? `${fr.banner.kind}|${fr.banner.big}|${fr.banner.small ?? ''}` : '', (el) => {
      el.className = `vw-banner ${fr.banner ? `show ${fr.banner.kind ?? ''}` : ''}`;
      el.innerHTML = fr.banner ? `<div class="big">${escapeHtml(fr.banner.big)}</div>${fr.banner.small ? `<div class="small">${escapeHtml(fr.banner.small)}</div>` : ''}` : '';
    });
    this.set('play', this.playing ? '❚❚' : '▶', text);
    (this.els.seek as HTMLInputElement).value = String(Math.round((this.t / this.tl.duration) * 1000));
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
