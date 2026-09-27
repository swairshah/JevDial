import { QUESTION_COUNT } from '../config';
import type { MultiClassification, QuestionSpec, S1Id } from '../types';
import { h } from '../util';
import { toast } from '../ui/toast';
import { Histogram } from './Histogram';

export class ClassificationPanel {
  readonly el = h('div', { class: 'panel' });
  private histograms: Histogram[] = [];
  private readonly addBtn = h('button', { class: 'add-question', text: '+', attrs: { title: 'Add a category', 'aria-label': 'Add a category' } });
  private adder: HTMLElement | null = null;
  private pending: HTMLElement[] = [];
  private onAdd: ((name: string) => Promise<void>) | null = null;
  private onRemove: ((id: string) => void) | null = null;

  constructor() {
    this.addBtn.hidden = true;
    this.addBtn.addEventListener('click', () => this.openAdder());
  }

  setHandlers(onAdd: (name: string) => Promise<void>, onRemove: (id: string) => void): void {
    this.onAdd = onAdd;
    this.onRemove = onRemove;
  }

  private openAdder(): void {
    if (this.adder) {
      this.adder.querySelector('input')?.focus();
      return;
    }
    const input = h('input', { class: 'adder-input', attrs: { type: 'text', placeholder: 'New category, e.g. complaint type', spellcheck: 'false', 'aria-label': 'New category name' } });
    const close = () => {
      this.adder?.remove();
      this.adder = null;
    };
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') close();
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const name = input.value.trim();
      if (!name) return close();
      close();
      void this.add(name);
    });
    input.addEventListener('blur', () => {
      if (!input.value.trim()) window.setTimeout(close, 120);
    });
    this.adder = h('div', { class: 'adder' }, input, h('span', { class: 'adder-hint', text: 'Enter — the model writes the options' }));
    this.el.prepend(this.adder);
    input.focus();
  }

  private async add(name: string): Promise<void> {
    if (!this.onAdd) return;
    const ghost = h('section', { class: 'hist skeleton named' }, h('h3', { text: name }), h('div', { class: 'hrows' }, ...Array.from({ length: 4 }, () => h('div', { class: 'hrow' }, h('div', { class: 'track' })))));
    this.pending.push(ghost);
    this.el.append(ghost);
    try {
      await this.onAdd(name);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    } finally {
      ghost.remove();
      this.pending = this.pending.filter(p => p !== ghost);
    }
  }

  showSkeleton(): void {
    this.histograms = [];
    const block = () => h('section', { class: 'hist skeleton' }, h('h3'), h('div', { class: 'hrows' }, ...Array.from({ length: 4 }, () => h('div', { class: 'hrow' }, h('div', { class: 'track' })))));
    this.el.replaceChildren(...Array.from({ length: QUESTION_COUNT }, block));
  }

  setSpecs(specs: QuestionSpec[], models: S1Id[], onEdit?: (next: QuestionSpec) => void, expected?: Record<string, string>): void {
    const removable = specs.length > 1 && this.onRemove;
    this.histograms = specs.map(spec => new Histogram(spec, onEdit ?? null, expected?.[spec.id], models, removable ? () => this.onRemove?.(spec.id) : null));
    this.el.classList.toggle('multi', models.length > 1);
    this.el.dataset.count = String(specs.length);
    this.addBtn.hidden = !this.onAdd;
    this.el.replaceChildren(this.addBtn, ...(this.adder ? [this.adder] : []), ...this.histograms.map(x => x.el), ...this.pending);
    this.el.classList.add('pending');
  }

  update(results: MultiClassification, baselines: MultiClassification): void {
    for (const hist of this.histograms) {
      const id = hist.spec.id;
      const pick = (src: MultiClassification) => Object.fromEntries(Object.entries(src).flatMap(([m, c]) => (c?.[id] ? [[m, c[id]]] : [])));
      hist.update(pick(results), pick(baselines));
    }
    this.el.classList.remove('pending');
  }

  setBusy(busy: boolean): void {
    this.el.classList.toggle('busy', busy);
  }

  showError(message: string, retry: () => void): void {
    const note = h('div', { class: 'panel-error' }, h('span', { text: message }), h('button', { class: 'link', text: 'Retry', on: { click: retry } }));
    this.el.querySelector('.panel-error')?.remove();
    if (!this.histograms.length) this.el.replaceChildren(note);
    else this.el.append(note);
  }

  clearError(): void {
    this.el.querySelector('.panel-error')?.remove();
  }
}
