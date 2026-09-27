import type { Distribution, QuestionSpec } from '../types';
import { h, replay } from '../util';
import { topLabel } from './questions';

interface Row {
  root: HTMLElement;
  fill: HTMLElement;
  ghost: HTMLElement;
  pct: HTMLElement;
  delta: HTMLElement;
}

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
  readonly el = h('section', { class: 'hist' });
  private rows = new Map<string, Row>();
  private last: { dist: Distribution; baseline?: Distribution } | null = null;

  constructor(readonly spec: QuestionSpec, private readonly edit: SpecEditor | null = null) {
    this.render();
  }

  update(dist: Distribution, baseline?: Distribution): void {
    this.last = { dist, baseline };
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
    if (this.last) this.update(this.last.dist, this.last.baseline);
  }

  private renderRow(label: string, description: string): HTMLElement {
    const fill = h('div', { class: 'fill' });
    const ghost = h('div', { class: 'ghost' });
    const pct = h('span', { class: 'pct', text: '–' });
    const delta = h('span', { class: 'delta' });
    const labelEl = h('span', { class: 'hlabel', text: label, attrs: { title: description ? `${label}: ${description}` : label } });
    const parts: HTMLElement[] = [labelEl, h('div', { class: 'track' }, fill, ghost), h('span', { class: 'hval' }, pct, delta)];
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
    const root = h('div', { class: 'hrow' }, ...parts);
    this.rows.set(label, { root, fill, ghost, pct, delta });
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
