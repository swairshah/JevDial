import { MAX_STEPS } from '../config';
import { feedback } from '../feedback';
import type { Backend, Direction, Rung } from '../types';
import { Emitter, errorMessage, h, num, replay } from '../util';
import { applyHue, hueFor } from './colors';
import { pitchOf, rungOf, tokenize, type Token } from './token';

export type ChangeReason = 'dial' | 'reset' | 'load' | 'swap';
export type StatusKind = 'idle' | 'busy' | 'error';

export interface DialEvents extends Record<string, unknown> {
  change: { text: string; reason: ChangeReason };
  status: { kind: StatusKind; text: string };
  warning: string;
  ladder: Token;
  pick: { index: number };
}

const registry = new WeakMap<HTMLElement, DialSentence>();

export function locateToken(target: EventTarget | null): { dial: DialSentence; tok: Token } | null {
  if (!(target instanceof Element)) return null;
  const tokEl = target.closest<HTMLElement>('.tok.dial');
  const root = tokEl?.closest<HTMLElement>('.dial-sentence');
  const dial = root && registry.get(root);
  if (!tokEl || !dial) return null;
  const tok = dial.tokens[Number(tokEl.dataset.i)];
  return tok?.kind ? { dial, tok } : null;
}

export class DialSentence {
  readonly el = h('div', { class: 'dial-sentence' });
  readonly events = new Emitter<DialEvents>();
  tokens: Token[];
  private generation = 0;
  private inflight = new Map<string, Promise<Rung | null>>();

  private picked: number | null = null;

  constructor(text: string, private readonly backend: () => Backend) {
    this.tokens = tokenize(text);
    registry.set(this.el, this);
    this.el.addEventListener('click', ev => {
      const el = ev.target instanceof Element ? ev.target.closest<HTMLElement>('.tok.word') : null;
      if (!el || !this.el.contains(el)) return;
      this.events.emit('pick', { index: Number(el.dataset.i) });
    });
    this.render();
  }

  setPicked(index: number | null): void {
    this.picked = index;
    for (const t of this.tokens) t.el?.classList.toggle('picked', t.i === index);
  }

  marked(index: number, replacement?: string): string {
    return this.tokens.map(t => (t.i === index ? `⟦${replacement ?? t.text}⟧` : t.text)).join('');
  }

  withReplacement(index: number, replacement: string): string {
    return this.tokens.map(t => (t.i === index ? replacement : t.text)).join('');
  }

  replaceToken(index: number, text: string): void {
    const t = this.tokens[index];
    if (!t || !text.trim() || t.text === text) return;
    const dir = 1;
    t.text = text;
    t.orig = text;
    t.level = 0;
    t.limit = { up: null, down: null };
    const base = t.ladder.get(0);
    t.ladder = new Map();
    if (t.kind) t.ladder.set(0, { text, valence: base?.valence ?? 0, intensity: base?.intensity ?? 0.5 });
    for (const key of [...this.inflight.keys()]) if (key.split(':')[1] === String(index)) this.inflight.delete(key);
    if (t.el) {
      if (t.kind) this.swapText(t, dir);
      else t.el.textContent = text;
      replay(t.el, 'flash', 500);
    }
    this.fixArticle(t);
    this.events.emit('ladder', t);
    this.events.emit('change', { text: this.text, reason: 'swap' });
  }

  get text(): string {
    return this.tokens.map(t => t.text).join('');
  }

  get dials(): Token[] {
    return this.tokens.filter(t => t.kind);
  }

  alive(t: Token): boolean {
    return this.tokens[t.i] === t;
  }

  async load(text: string = this.text): Promise<void> {
    const gen = ++this.generation;
    const changed = text !== this.text;
    this.inflight.clear();
    this.tokens = tokenize(text);
    this.render(true);
    if (changed) this.events.emit('change', { text, reason: 'load' });
    this.status('busy', 'Finding dial words…');
    try {
      const words = this.tokens.filter(t => t.word).map(t => ({ index: t.i, text: t.text }));
      const { tags, warning } = await this.backend().tagWords(text, words);
      if (gen !== this.generation) return;
      for (const tag of tags) {
        const t = this.tokens[tag.index];
        if (!t?.word) continue;
        t.kind = tag.kind;
        t.confidence = tag.confidence;
        t.ladder.set(0, { text: t.orig, valence: tag.valence, intensity: tag.intensity });
      }
      this.render();
      if (warning) this.events.emit('warning', warning);
      this.status('idle', '');
    } catch (err) {
      if (gen !== this.generation) return;
      this.render();
      this.status('error', errorMessage(err));
    }
  }

  isPending(t: Token, level: number): boolean {
    return this.inflight.has(`${this.generation}:${t.i}:${level}`);
  }

  isLimited(t: Token, dir: Direction): boolean {
    const edge = dir > 0 ? t.limit.up : t.limit.down;
    if (edge !== null && (dir > 0 ? t.level >= edge : t.level <= edge)) return true;
    return Math.abs(t.level + dir) > MAX_STEPS;
  }

  prefetch(t: Token, dir: Direction): void {
    if (!t.kind || this.isLimited(t, dir) || t.ladder.has(t.level + dir)) return;
    this.fetchRung(t, t.level, dir).catch(() => {});
  }

  async go(t: Token, dir: Direction): Promise<void> {
    if (!t.kind || !this.alive(t)) return;
    if (t.busy) {
      t.queued = dir;
      return;
    }
    if (this.isLimited(t, dir)) {
      feedback('limit', t.el, dir);
      return;
    }
    const target = t.level + dir;
    if (t.ladder.has(target)) {
      this.setLevel(t, target, dir, 'dial');
      this.prefetch(t, dir);
      return;
    }
    t.busy = true;
    t.el?.classList.add('pending', dir > 0 ? 'up' : 'down');
    try {
      const rung = await this.fetchRung(t, t.level, dir);
      if (!this.alive(t)) return;
      if (rung) {
        this.setLevel(t, target, dir, 'dial');
        this.prefetch(t, dir);
      } else feedback('limit', t.el, dir);
    } catch (err) {
      feedback('error', t.el, dir);
      this.events.emit('warning', errorMessage(err));
    } finally {
      t.busy = false;
      t.el?.classList.remove('pending', 'up', 'down');
      if (this.alive(t) && t.queued) {
        const q = t.queued;
        t.queued = 0;
        void this.go(t, q);
      }
    }
  }

  reset(t: Token): void {
    if (!t.kind || t.level === 0) return;
    this.setLevel(t, 0, t.level > 0 ? -1 : 1, 'reset');
  }

  resetAll(): void {
    for (const t of this.dials) this.reset(t);
  }

  private status(kind: StatusKind, text: string): void {
    this.events.emit('status', { kind, text });
  }

  private fetchRung(t: Token, from: number, dir: Direction): Promise<Rung | null> {
    const target = from + dir;
    const existing = t.ladder.get(target);
    if (existing) return Promise.resolve(existing);
    const key = `${this.generation}:${t.i}:${target}`;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const current = rungOf(t, from).text;
    const request = {
      marked: this.tokens.map(x => (x === t ? `⟦${current}⟧` : x.text)).join(''),
      current,
      ladder: [...t.ladder.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.text),
      kind: t.kind ?? 'evaluative',
      dir
    };
    const promise = this.backend()
      .nextRung(request)
      .then(res => {
        this.inflight.delete(key);
        if (!this.alive(t)) return null;
        const text = this.matchCase(t, res.replacement);
        const seen = [...t.ladder.values()].some(r => r.text.toLowerCase() === text.toLowerCase());
        if (!text || res.atLimit || seen || text.split(/\s+/).length > 5) {
          if (dir > 0) t.limit.up = from;
          else t.limit.down = from;
          this.events.emit('ladder', t);
          return null;
        }
        const rung: Rung = { text, valence: num(res.valence, -1, 1, rungOf(t, from).valence), intensity: num(res.intensity, 0, 1, 0.5) };
        t.ladder.set(target, rung);
        this.events.emit('ladder', t);
        return rung;
      })
      .catch(err => {
        this.inflight.delete(key);
        this.events.emit('ladder', t);
        throw err;
      });
    this.inflight.set(key, promise);
    this.events.emit('ladder', t);
    return promise;
  }

  private setLevel(t: Token, level: number, dir: Direction, reason: ChangeReason): void {
    const rung = t.ladder.get(level);
    if (!rung) return;
    t.level = level;
    t.text = level === 0 ? t.orig : this.matchCase(t, rung.text);
    this.swapText(t, dir);
    this.fixArticle(t);
    this.paint(t);
    this.events.emit('ladder', t);
    feedback('step', t.el, dir, pitchOf(t, rung));
    this.events.emit('change', { text: this.text, reason });
  }

  private matchCase(t: Token, raw: string): string {
    const s = raw.trim().replace(/^["'“”‘’⟦[]+|["'“”‘’⟧\].,;:!?]+$/g, '');
    const first = t.orig[0] ?? '';
    const upper = first !== first.toLowerCase();
    if (upper) return s.charAt(0).toUpperCase() + s.slice(1);
    if (s.length > 1 && s !== s.toUpperCase()) return s.charAt(0).toLowerCase() + s.slice(1);
    return s;
  }

  private fixArticle(t: Token): void {
    let j = t.i - 1;
    while (j >= 0 && !this.tokens[j].word) {
      if (/\S/.test(this.tokens[j].text)) return;
      j--;
    }
    const prev = this.tokens[j];
    if (!prev || prev.kind || !/^an?$/i.test(prev.text)) return;
    const want = /^[aeiou]/i.test(t.text) && !/^(uni|use|one|eu)/i.test(t.text) ? 'an' : 'a';
    const next = prev.text[0] === 'A' ? want[0].toUpperCase() + want.slice(1) : want;
    if (next === prev.text || !prev.el) return;
    prev.text = next;
    prev.el.textContent = next;
    replay(prev.el, 'flash', 500);
  }

  private swapText(t: Token, dir: Direction): void {
    const el = t.el;
    if (!el) return;
    const before = el.getBoundingClientRect().width;
    const inner = h('span', { class: `inner ${dir > 0 ? 'in-up' : 'in-down'}`, text: t.text });
    el.style.width = '';
    el.replaceChildren(inner);
    const after = el.getBoundingClientRect().width;
    el.style.width = `${before}px`;
    void el.offsetWidth;
    el.style.width = `${after}px`;
    window.setTimeout(() => {
      el.style.width = '';
    }, 220);
  }

  private paint(t: Token): void {
    if (t.el && t.kind) applyHue(t.el, hueFor(t.kind, rungOf(t)));
  }

  private render(scanning = false): void {
    let k = 0;
    const nodes = this.tokens.map(t => {
      const el = h('span', { class: 'tok', attrs: { 'data-i': String(t.i) } });
      if (t.word) {
        el.classList.add('word');
        el.style.setProperty('--k', String(k++));
        if (scanning) el.classList.add('scanning');
      }
      if (t.kind) {
        el.classList.add('dial', `kind-${t.kind}`);
        if (t.confidence < 0.72) el.classList.add('soft');
        el.tabIndex = 0;
        el.setAttribute('role', 'slider');
        el.setAttribute('aria-label', t.text);
        el.append(h('span', { class: 'inner', text: t.text }));
      } else el.textContent = t.text;
      t.el = el;
      if (t.i === this.picked) el.classList.add('picked');
      if (t.kind) this.paint(t);
      return el;
    });
    this.el.replaceChildren(...nodes);
  }
}
