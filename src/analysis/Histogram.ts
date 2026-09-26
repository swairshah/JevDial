import type { Distribution, QuestionSpec } from '../types';
import { h } from '../util';
import { topLabel } from './questions';

interface Row {
  root: HTMLElement;
  fill: HTMLElement;
  ghost: HTMLElement;
  pct: HTMLElement;
  delta: HTMLElement;
}

export class Histogram {
  readonly el: HTMLElement;
  private rows = new Map<string, Row>();

  constructor(readonly spec: QuestionSpec) {
    const rows = spec.options.map(option => {
      const fill = h('div', { class: 'fill' });
      const ghost = h('div', { class: 'ghost' });
      const pct = h('span', { class: 'pct', text: '–' });
      const delta = h('span', { class: 'delta' });
      const root = h(
        'div',
        { class: 'hrow', attrs: { title: option.description } },
        h('span', { class: 'hlabel', text: option.label }),
        h('div', { class: 'track' }, fill, ghost),
        h('span', { class: 'hval' }, pct, delta)
      );
      this.rows.set(option.label, { root, fill, ghost, pct, delta });
      return root;
    });
    this.el = h('section', { class: 'hist' }, h('h3', { text: spec.name, attrs: { title: spec.question } }), h('div', { class: 'hrows' }, ...rows));
  }

  update(dist: Distribution, baseline?: Distribution): void {
    const top = topLabel(dist);
    for (const [label, row] of this.rows) {
      const p = dist[label] ?? 0;
      const b = baseline?.[label];
      row.fill.style.width = `${(p * 100).toFixed(1)}%`;
      row.pct.textContent = `${Math.round(p * 100)}%`;
      row.root.classList.toggle('top', label === top);
      const shift = b === undefined ? 0 : Math.round((p - b) * 100);
      row.ghost.style.left = `${((b ?? p) * 100).toFixed(1)}%`;
      row.ghost.classList.toggle('show', shift !== 0);
      row.delta.textContent = shift === 0 ? '' : `${shift > 0 ? '+' : '−'}${Math.abs(shift)}`;
      row.delta.className = `delta${shift > 0 ? ' up' : shift < 0 ? ' down' : ''}`;
    }
  }
}
