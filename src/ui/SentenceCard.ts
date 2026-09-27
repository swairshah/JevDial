import { ClassificationPanel } from '../analysis/ClassificationPanel';
import { RECLASSIFY_DEBOUNCE_MS } from '../config';
import { DialSentence } from '../dial/DialSentence';
import { attachDial } from '../dial/interactions';
import { ladder } from '../dial/Ladder';
import type { Backend, Classification, QuestionSpec } from '../types';
import { debounce, Emitter, errorMessage, h } from '../util';
import { icons } from './icons';
import { toast } from './toast';

export interface CardRecord {
  id: string;
  original: string;
  text: string;
  specs: QuestionSpec[] | null;
  baseline: Classification | null;
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
    this.dial = new DialSentence(record.text, deps.backend);
    const actions = h(
      'div',
      { class: 'card-actions' },
      h('button', { class: 'icon-btn sm', html: icons.sparkle, attrs: { title: 'New questions', 'aria-label': 'New questions' }, on: { click: () => void this.regenerateQuestions() } }),
      h('button', { class: 'icon-btn sm', html: icons.reset, attrs: { title: 'Reset to original', 'aria-label': 'Reset' }, on: { click: () => this.resetToOriginal() } }),
      h('button', { class: 'icon-btn sm', html: icons.close, attrs: { title: 'Remove', 'aria-label': 'Remove' }, on: { click: () => this.deps.onRemove(this) } })
    );
    this.el = h('article', { class: 'card' }, actions, this.dial.el, this.statusEl, this.panel.el);
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
    this.record.baseline = null;
    this.deps.onChange(this);
    const specs = await this.prepareQuestions();
    if (!specs) return;
    if (this.dial.text !== this.record.original) {
      const seq = ++this.classifySeq;
      try {
        const baseline = await this.deps.backend().classify(this.record.original, specs);
        if (seq !== this.classifySeq) return;
        this.record.baseline = baseline;
        this.deps.onChange(this);
      } catch {}
    }
    await this.classify();
  }

  get specs(): QuestionSpec[] | null {
    return this.record.specs;
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

  private showSpecs(specs: QuestionSpec[]): void {
    this.panel.setSpecs(specs, next => this.editSpec(next));
  }

  private editSpec(next: QuestionSpec): void {
    const specs = (this.record.specs ?? []).map(s => (s.id === next.id ? next : s));
    this.record.specs = specs;
    this.record.baseline = null;
    this.deps.onChange(this);
    this.showSpecs(specs);
    this.events.emit('specs', specs);
    void this.regenerateBaseline(specs);
  }

  private async regenerateBaseline(specs: QuestionSpec[]): Promise<void> {
    if (this.dial.text !== this.record.original) {
      const seq = ++this.classifySeq;
      try {
        const baseline = await this.deps.backend().classify(this.record.original, specs);
        if (seq !== this.classifySeq) return;
        this.record.baseline = baseline;
        this.deps.onChange(this);
      } catch {}
    }
    await this.classify();
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
    this.panel.setBusy(true);
    try {
      const result = await this.deps.backend().classify(text, specs);
      if (seq !== this.classifySeq) return;
      if (!this.record.baseline && text === this.record.original) {
        this.record.baseline = result;
        this.deps.onChange(this);
      }
      this.panel.clearError();
      this.panel.update(result, this.record.baseline);
    } catch (err) {
      if (seq === this.classifySeq) this.panel.showError(errorMessage(err), () => void this.classify());
    } finally {
      if (seq === this.classifySeq) this.panel.setBusy(false);
    }
  }

  private setStatus(text: string, error: boolean): void {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('show', !!text);
    this.statusEl.classList.toggle('error', error);
  }
}
