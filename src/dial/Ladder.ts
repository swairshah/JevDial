import { clamp, h } from '../util';
import { applyHue, hueFor } from './colors';
import type { DialSentence } from './DialSentence';
import type { Token } from './token';

const WINDOW = 4;

class Ladder {
  private readonly el = h('div', { class: 'ladder', attrs: { 'aria-hidden': 'true' } });
  private target: { dial: DialSentence; tok: Token } | null = null;
  private hideTimer: number | undefined;

  mount(): void {
    document.body.append(this.el);
  }

  get active(): Token | null {
    return this.target?.tok ?? null;
  }

  show(dial: DialSentence, tok: Token): void {
    window.clearTimeout(this.hideTimer);
    if (this.target && this.target.tok !== tok) this.target.tok.el?.classList.remove('active');
    this.target = { dial, tok };
    tok.el?.classList.add('active');
    this.render();
    this.el.classList.add('show');
    dial.prefetch(tok, 1);
    dial.prefetch(tok, -1);
  }

  hide(delay = 0): void {
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.el.classList.remove('show');
      this.target?.tok.el?.classList.remove('active');
      this.target = null;
    }, delay);
  }

  hideIfInside(root: Element): void {
    if (this.target?.tok.el && root.contains(this.target.tok.el)) this.hide();
  }

  refresh(tok: Token): void {
    if (this.target?.tok === tok) this.render();
  }

  reposition(): void {
    const el = this.target?.tok.el;
    if (!el?.isConnected) return;
    const r = el.getBoundingClientRect();
    const cur = this.el.querySelector<HTMLElement>('.row.cur');
    const pw = this.el.offsetWidth;
    const ph = this.el.offsetHeight;
    let left = r.right + 14;
    if (left + pw > innerWidth - 8) left = Math.max(8, r.left - pw - 14);
    const anchor = cur ? cur.offsetTop + cur.offsetHeight / 2 : ph / 2;
    const top = clamp(r.top + r.height / 2 - anchor, 8, innerHeight - ph - 8);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  private edge(dial: DialSentence, t: Token, dir: 1 | -1): HTMLElement {
    const levels = [...t.ladder.keys()];
    const end = dir > 0 ? Math.max(...levels) : Math.min(...levels);
    const limit = dir > 0 ? t.limit.up : t.limit.down;
    const word = t.kind === 'degree' ? (dir > 0 ? 'stronger' : 'weaker') : dir > 0 ? 'more positive' : 'more negative';
    if (limit !== null && limit === end) return h('div', { class: 'edge end', text: 'end of scale' });
    if (dial.isPending(t, end + dir)) return h('div', { class: 'edge pend', text: word });
    return h('div', { class: 'edge', text: `${dir > 0 ? '↑' : '↓'} ${word}` });
  }

  private render(): void {
    const target = this.target;
    if (!target?.tok.el?.isConnected) return;
    const { dial, tok } = target;
    const levels = [...tok.ladder.keys()].sort((a, b) => b - a).filter(l => Math.abs(l - tok.level) <= WINDOW);
    const rows = levels.map(level => {
      const rung = tok.ladder.get(level)!;
      const row = h(
        'div',
        { class: `row${level === tok.level ? ' cur' : ''}${level === 0 ? ' orig' : ''}` },
        h('span', { class: 'sw' }),
        h('span', { class: 't', text: level === 0 ? tok.orig : rung.text })
      );
      applyHue(row, hueFor(tok.kind, rung));
      return row;
    });
    this.el.replaceChildren(this.edge(dial, tok, 1), ...rows, this.edge(dial, tok, -1));
    this.reposition();
  }
}

export const ladder = new Ladder();
