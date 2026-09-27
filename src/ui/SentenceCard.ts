import { ClassificationPanel } from '../analysis/ClassificationPanel';
import { RECLASSIFY_DEBOUNCE_MS } from '../config';
import { DialSentence } from '../dial/DialSentence';
import { attachDial } from '../dial/interactions';
import { ladder } from '../dial/Ladder';
import { activeModels } from '../services/systemone';
import type { Backend, Classification, MultiClassification, QuestionSpec, S1Id } from '../types';
import { debounce, Emitter, errorMessage, h } from '../util';
import { icons } from './icons';
import { toast } from './toast';

export interface CardRecord {
  id: string;
  original: string;
  text: string;
  specs: QuestionSpec[] | null;
  baselines?: MultiClassification;
  baseline?: Classification | null;
  expected?: Record<string, string>;
  source?: { dataset: string; difficulty: 'typical' | 'borderline'; note: string };
}

export interface CardDeps {
  backend: () => Backend;
  onChange: (card: SentenceCard) => void;
  onRemove: (card: SentenceCard) => void;
  onPick: (card: SentenceCard, index: number) => void;
}

export class SentenceCard {
  readonly el: HTMLElement;
  readonly dial: DialSentence;
  readonly events = new Emitter<{ specs: QuestionSpec[] }>();
  private readonly panel = new ClassificationPanel();
  private readonly statusEl = h('div', { class: 'card-status' });
  private readonly unsubscribe: (() => void)[] = [];
  private classifySeq = 0;
  private questionsPromise: Promise<QuestionSpec[] | null> | null = null;
  private readonly scheduleClassify = debounce(() => void this.classify(), RECLASSIFY_DEBOUNCE_MS);

  constructor(readonly record: CardRecord, private readonly deps: CardDeps) {
    if (!record.baselines) record.baselines = record.baseline ? { jev: record.baseline } : {};
    delete record.baseline;
    this.dial = new DialSentence(record.text, deps.backend);
    const actions = h(
      'div',
      { class: 'card-actions' },
      h('button', { class: 'icon-btn sm', html: icons.questions, attrs: { title: 'New questions', 'aria-label': 'New questions' }, on: { click: () => void this.regenerateQuestions() } }),
      h('button', { class: 'icon-btn sm', html: icons.reset, attrs: { title: 'Reset to original', 'aria-label': 'Reset' }, on: { click: () => this.resetToOriginal() } }),
      h('button', { class: 'icon-btn sm', html: icons.close, attrs: { title: 'Remove', 'aria-label': 'Remove' }, on: { click: () => this.deps.onRemove(this) } })
    );
    const src = record.source;
    const meta = src
      ? h(
          'div',
          { class: 'card-meta' },
          h('span', { text: src.dataset }),
          src.difficulty === 'borderline' ? h('span', { class: 'pill warn', text: 'borderline', attrs: { title: src.note || 'Could reasonably be labelled two ways' } }) : null
        )
      : null;
    this.el = h('article', { class: 'card' }, actions, meta, this.dial.el, this.statusEl, this.panel.el);
    this.panel.setHandlers(
      name => this.addQuestion(name),
      id => this.removeQuestion(id)
    );
    this.unsubscribe.push(
      attachDial(this.dial),
      this.dial.events.on('change', ({ text }) => {
        this.record.text = text;
        this.deps.onChange(this);
        this.panel.setBusy(true);
        this.scheduleClassify();
      }),
      this.dial.events.on('status', ({ kind, text }) => this.setStatus(kind === 'idle' ? '' : text, kind === 'error')),
      this.dial.events.on('warning', message => toast(message)),
      this.dial.events.on('pick', ({ index }) => this.deps.onPick(this, index))
    );
  }

  async start(): Promise<void> {
    await Promise.all([this.dial.load(), this.prepareQuestions().then(() => this.classify())]);
  }

  async restart(): Promise<void> {
    this.scheduleClassify.cancel();
    await Promise.all([this.dial.load(), this.classify()]);
  }

  async regenerateQuestions(): Promise<void> {
    if (this.questionsPromise) return;
    this.classifySeq++;
    this.record.specs = null;
    this.record.baselines = {};
    this.deps.onChange(this);
    const specs = await this.prepareQuestions();
    if (specs) await this.rebaseline(specs);
  }

  get specs(): QuestionSpec[] | null {
    return this.record.specs;
  }

  private async addQuestion(name: string): Promise<void> {
    const current = this.record.specs ?? [];
    const spec = await this.deps.backend().proposeCategory(this.record.original, name, current);
    const specs = [...(this.record.specs ?? []), spec];
    this.record.specs = specs;
    this.record.baselines = {};
    this.deps.onChange(this);
    this.showSpecs(specs);
    this.events.emit('specs', specs);
    await this.rebaseline(specs);
  }

  private removeQuestion(id: string): void {
    const specs = (this.record.specs ?? []).filter(s => s.id !== id);
    if (!specs.length) return;
    this.record.specs = specs;
    if (this.record.expected) delete this.record.expected[id];
    this.deps.onChange(this);
    this.showSpecs(specs);
    this.events.emit('specs', specs);
    void this.classify();
  }

  async modelsChanged(): Promise<void> {
    const specs = this.record.specs;
    if (!specs) return;
    this.showSpecs(specs);
    await this.rebaseline(specs, true);
  }

  private get baselines(): MultiClassification {
    return (this.record.baselines ??= {});
  }

  private showSpecs(specs: QuestionSpec[]): void {
    this.panel.setSpecs(specs, activeModels(), n => this.editSpec(n), this.record.expected);
  }

  private editSpec(next: QuestionSpec): void {
    const specs = (this.record.specs ?? []).map(s => (s.id === next.id ? next : s));
    this.record.specs = specs;
    this.record.baselines = {};
    this.deps.onChange(this);
    this.showSpecs(specs);
    this.events.emit('specs', specs);
    void this.rebaseline(specs);
  }

  private async rebaseline(specs: QuestionSpec[], onlyMissing = false): Promise<void> {
    if (this.dial.text !== this.record.original) {
      const seq = ++this.classifySeq;
      const models = activeModels().filter(m => !onlyMissing || !this.baselines[m]);
      const results = await Promise.allSettled(models.map(m => this.deps.backend().classify(this.record.original, specs, m)));
      if (seq !== this.classifySeq) return;
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') this.baselines[models[i]] = res.value;
      });
      this.deps.onChange(this);
    }
    await this.classify();
  }

  resetToOriginal(): void {
    this.dial.resetAll();
    if (this.dial.text !== this.record.original) void this.dial.load(this.record.original);
  }

  dispose(): void {
    this.scheduleClassify.cancel();
    this.classifySeq++;
    ladder.hideIfInside(this.el);
    for (const off of this.unsubscribe) off();
    this.dial.events.clear();
    this.events.clear();
  }

  private prepareQuestions(): Promise<QuestionSpec[] | null> {
    if (this.record.specs) {
      this.showSpecs(this.record.specs);
      return Promise.resolve(this.record.specs);
    }
    if (this.questionsPromise) return this.questionsPromise;
    this.panel.showSkeleton();
    this.questionsPromise = this.deps
      .backend()
      .proposeQuestions(this.record.original)
      .then(specs => {
        this.record.specs = specs;
        this.deps.onChange(this);
        this.showSpecs(specs);
        this.events.emit('specs', specs);
        return specs;
      })
      .catch(err => {
        this.panel.showError(errorMessage(err), () => void this.prepareQuestions().then(() => this.classify()));
        return null;
      })
      .finally(() => {
        this.questionsPromise = null;
      });
    return this.questionsPromise;
  }

  private async classify(): Promise<void> {
    const specs = this.record.specs;
    if (!specs) return;
    const seq = ++this.classifySeq;
    const text = this.dial.text;
    const models: S1Id[] = activeModels();
    this.panel.setBusy(true);
    const settled = await Promise.allSettled(models.map(m => this.deps.backend().classify(text, specs, m)));
    if (seq !== this.classifySeq) return;
    const results: MultiClassification = {};
    const errors: string[] = [];
    settled.forEach((res, i) => {
      const m = models[i];
      if (res.status === 'fulfilled') {
        results[m] = res.value;
        if (!this.baselines[m] && text === this.record.original) this.baselines[m] = res.value;
      } else errors.push(errorMessage(res.reason));
    });
    if (text === this.record.original) this.deps.onChange(this);
    this.panel.clearError();
    this.panel.update(results, this.baselines);
    if (errors.length) this.panel.showError(errors.join(' · '), () => void this.classify());
    this.panel.setBusy(false);
  }

  private setStatus(text: string, error: boolean): void {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('show', !!text);
    this.statusEl.classList.toggle('error', error);
  }
}
