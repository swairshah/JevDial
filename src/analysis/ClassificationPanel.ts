import { QUESTION_COUNT } from '../config';
import type { MultiClassification, QuestionSpec, S1Id } from '../types';
import { h } from '../util';
import { Histogram } from './Histogram';

export class ClassificationPanel {
  readonly el = h('div', { class: 'panel' });
  private histograms: Histogram[] = [];

  showSkeleton(): void {
    this.histograms = [];
    const block = () => h('section', { class: 'hist skeleton' }, h('h3'), h('div', { class: 'hrows' }, ...Array.from({ length: 4 }, () => h('div', { class: 'hrow' }, h('div', { class: 'track' })) )));
    this.el.replaceChildren(...Array.from({ length: QUESTION_COUNT }, block));
  }

  setSpecs(specs: QuestionSpec[], models: S1Id[], onEdit?: (next: QuestionSpec) => void, expected?: Record<string, string>): void {
    this.histograms = specs.map(spec => new Histogram(spec, onEdit ?? null, expected?.[spec.id], models));
    this.el.classList.toggle('multi', models.length > 1);
    this.el.dataset.count = String(specs.length);
    this.el.replaceChildren(...this.histograms.map(x => x.el));
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
