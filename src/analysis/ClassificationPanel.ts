import { QUESTION_COUNT } from '../config';
import type { Classification, QuestionSpec } from '../types';
import { h } from '../util';
import { Histogram } from './Histogram';

export class ClassificationPanel {
  readonly el = h('div', { class: 'panel' });
  private histograms: Histogram[] = [];

  showSkeleton(): void {
    this.histograms = [];
    const block = () => h('section', { class: 'hist skeleton' }, h('h3'), h('div', { class: 'hrows' }, ...Array.from({ length: 4 }, () => h('div', { class: 'hrow' }, h('div', { class: 'track' })))));
    this.el.replaceChildren(...Array.from({ length: QUESTION_COUNT }, block));
  }

  setSpecs(specs: QuestionSpec[]): void {
    this.histograms = specs.map(spec => new Histogram(spec));
    this.el.replaceChildren(...this.histograms.map(x => x.el));
    this.el.classList.add('pending');
  }

  update(result: Classification, baseline: Classification | null): void {
    for (const hist of this.histograms) {
      const dist = result[hist.spec.id];
      if (dist) hist.update(dist, baseline?.[hist.spec.id]);
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
