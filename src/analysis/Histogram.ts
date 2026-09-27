import type { Distribution, QuestionSpec, S1Id } from '../types';
import { h, replay } from '../util';
import { topLabel } from './questions';

interface Bar {
  fill: HTMLElement;
  ghost: HTMLElement;
  pct: HTMLElement;
  delta: HTMLElement;
}

interface Row {
  root: HTMLElement;
  bars: Partial<Record<S1Id, Bar>>;
}

export type ModelDistributions = Partial<Record<S1Id, Distribution>>;

export type SpecEditor = (next: QuestionSpec) => void;

function inlineInput(initial: string, onCommit: (value: string | null) => void, placeholder = ''): HTMLInputElement {
  const input = h('input', { class: 'inline-edit', attrs: { type: 'text', value: initial, placeholder, spellcheck: 'false' } });
  input.value = initial;
  let done = false;
  const finish = (value: string | null) => {
    if (done) return;
    done = true;
    onCommit(value);
  };
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      finish(input.value.trim());
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      finish(null);
    }
  });
  input.addEventListener('blur', () => finish(input.value.trim()));
  queueMicrotask(() => {
    input.focus();
    input.select();
  });
  return input;
}

export class Histogram {
  readonly el: HTMLElement;
  private rows = new Map<string, Row>();
  private last: { dists: ModelDistributions; baselines: ModelDistributions } | null = null;

  constructor(
    readonly spec: QuestionSpec,
    private readonly edit: SpecEditor | null = null,
    private readonly expected?: string,
    private readonly models: S1Id[] = ['jev']
  ) {
    this.el = h('section', { class: 'hist' });
    this.render();
  }

  update(dists: ModelDistributions, baselines: ModelDistributions = {}): void {
    this.last = { dists, baselines };
    const tops = new Map<S1Id, string>();
    for (const m of this.models) {
      const d = dists[m];
      if (d) tops.set(m, topLabel(d));
    }
    for (const [label, row] of this.rows) {
      let anyTop = false;
      for (const m of this.models) {
        const bar = row.bars[m];
        const dist = dists[m];
        if (!bar) continue;
        const isTop = tops.get(m) === label;
        anyTop ||= isTop;
        row.root.classList.toggle(`top-${m}`, isTop);
        if (!dist) {
          bar.fill.style.width = '0%';
          bar.pct.textContent = '–';
          bar.delta.textContent = '';
          bar.ghost.classList.remove('show');
          continue;
        }
        const p = dist[label] ?? 0;
        const b = baselines[m]?.[label];
        bar.fill.style.width = `${(p * 100).toFixed(1)}%`;
        bar.pct.textContent = this.models.length > 1 ? String(Math.round(p * 100)) : `${Math.round(p * 100)}%`;
        const shift = b === undefined ? 0 : Math.round((p - b) * 100);
        bar.ghost.style.left = `${((b ?? p) * 100).toFixed(1)}%`;
        bar.ghost.classList.toggle('show', shift !== 0);
        bar.delta.textContent = shift === 0 ? '' : `${shift > 0 ? '+' : '−'}${Math.abs(shift)}`;
        bar.delta.className = `delta${shift > 0 ? ' up' : shift < 0 ? ' down' : ''}`;
      }
      row.root.classList.toggle('top', anyTop);
    }
  }

  private commit(next: QuestionSpec): void {
    this.edit?.(next);
  }

  private render(): void {
    const editable = !!this.edit;
    const name = h('span', { class: 'hname', text: this.spec.name, attrs: { title: this.spec.question } });
    const title = h('h3', {}, name);
    if (editable) {
      name.classList.add('editable');
      name.addEventListener('click', () => {
        const input = inlineInput(this.spec.name, value => {
          if (value && value !== this.spec.name) this.commit({ ...this.spec, name: value });
          else this.render();
        });
        title.replaceChildren(input);
      });
    }
    this.rows.clear();
    const rows = this.spec.options.map(option => this.renderRow(option.label, option.description));
    const children: HTMLElement[] = [title, h('div', { class: 'hrows' }, ...rows)];
    if (editable) {
      const add = h('button', { class: 'add-option', text: '+ option' });
      add.addEventListener('click', () => {
        const input = inlineInput(
          '',
          value => {
            if (!value) return this.render();
            if (this.spec.options.some(o => o.label.toLowerCase() === value.toLowerCase())) {
              replay(this.el, 'reject');
              return this.render();
            }
            this.commit({ ...this.spec, options: [...this.spec.options, { label: value, description: '' }] });
          },
          'new option'
        );
        add.replaceWith(h('div', { class: 'hrow adding' }, input));
      });
      children.push(add);
    }
    this.el.replaceChildren(...children);
    if (this.last) this.update(this.last.dists, this.last.baselines);
  }

  private renderRow(label: string, description: string): HTMLElement {
    const bars: Partial<Record<S1Id, Bar>> = {};
    const tracks = h('div', { class: 'tracks' });
    const values = h('div', { class: 'hvals' });
    for (const m of this.models) {
      const fill = h('div', { class: 'fill' });
      const ghost = h('div', { class: 'ghost' });
      const pct = h('span', { class: 'pct', text: '–' });
      const delta = h('span', { class: 'delta' });
      tracks.append(h('div', { class: `track m-${m}` }, fill, ghost));
      values.append(h('span', { class: `hval m-${m}` }, pct, delta));
      bars[m] = { fill, ghost, pct, delta };
    }
    const labelEl = h('span', { class: 'hlabel', text: label, attrs: { title: description ? `${label}: ${description}` : label } });
    const parts: HTMLElement[] = [labelEl, tracks, values];
    if (this.edit) {
      labelEl.classList.add('editable');
      labelEl.addEventListener('click', () => {
        const input = inlineInput(label, value => {
          if (value === null || value === label) return this.render();
          if (!value) return this.remove(label);
          if (this.spec.options.some(o => o.label !== label && o.label.toLowerCase() === value.toLowerCase())) {
            replay(this.el, 'reject');
            return this.render();
          }
          this.commit({ ...this.spec, options: this.spec.options.map(o => (o.label === label ? { label: value, description: '' } : o)) });
        });
        labelEl.replaceChildren(input);
      });
      const remove = h('button', { class: 'remove-option', text: '×', attrs: { title: `Remove ${label}`, 'aria-label': `Remove ${label}` } });
      remove.addEventListener('click', () => this.remove(label));
      parts.push(remove);
    }
    const root = h('div', { class: `hrow${label === this.expected ? ' expected' : ''}${this.models.length > 1 ? ' multi' : ''}` }, ...parts);
    if (label === this.expected) labelEl.title = `Intended label in the dataset${description ? ` — ${description}` : ''}`;
    this.rows.set(label, { root, bars });
    return root;
  }

  private remove(label: string): void {
    if (this.spec.options.length <= 2) {
      replay(this.el, 'reject');
      return this.render();
    }
    this.commit({ ...this.spec, options: this.spec.options.filter(o => o.label !== label) });
  }
}
