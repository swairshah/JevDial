import { topLabel } from '../analysis/questions';
import { activeModels, S1_MODELS } from '../services/systemone';
import type { Backend, Distribution, MultiClassification, QuestionSpec, S1Id, SwapKind } from '../types';
import { errorMessage, h } from '../util';
import { icons } from './icons';
import type { SentenceCard } from './SentenceCard';

type SortMode = 'kind' | 'flips';

interface Variant {
  text: string;
  kind: SwapKind | 'original';
  result: MultiClassification | null;
  error?: boolean;
}

const KIND_LABEL: Record<Variant['kind'], string> = {
  original: 'original',
  synonym: 'synonym',
  stronger: 'stronger',
  weaker: 'weaker',
  opposite: 'opposite',
  formal: 'formal',
  casual: 'casual',
  shift: 'shift',
  custom: 'yours'
};

export interface SwapPanelDeps {
  backend: () => Backend;
  onVisibilityChange: (open: boolean) => void;
}

export class SwapPanel {
  readonly el = h('aside', { class: 'swap', attrs: { 'aria-label': 'Word swaps' } });
  private readonly wordEl = h('span', { class: 'swap-word' });
  private readonly contextEl = h('p', { class: 'swap-context' });
  private readonly markEl = h('mark');
  private readonly input = h('input', { class: 'swap-input', attrs: { type: 'text', placeholder: 'Try your own word…', spellcheck: 'false', 'aria-label': 'Your own replacement' } });
  private readonly sortButtons = new Map<SortMode, HTMLButtonElement>();
  private readonly infoEl = h('div', { class: 'swap-info' });
  private readonly staleEl = h('div', { class: 'swap-stale' });
  private readonly colgroup = h('colgroup');
  private readonly thead = h('thead');
  private readonly tbody = h('tbody');
  private readonly resize = new ResizeObserver(() => {
    if (this.contextEl.clientWidth !== this.lastWidth) this.lockContextHeight();
  });

  private card: SentenceCard | null = null;
  private index = -1;
  private variants: Variant[] = [];
  private baseIdx = 0;
  private sort: SortMode = 'kind';
  private status = '';
  private stale = false;
  private applying = false;
  private seq = 0;
  private specKey = '';
  private lastWidth = 0;
  private unsubscribe: (() => void)[] = [];

  constructor(private readonly deps: SwapPanelDeps) {
    this.el.hidden = true;
    this.input.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const value = this.input.value;
      this.input.value = '';
      void this.addCustom(value);
    });
    const seg = h('div', { class: 'seg', attrs: { role: 'group', 'aria-label': 'Sort' } });
    for (const mode of ['kind', 'flips'] as SortMode[]) {
      const b = h('button', { text: mode === 'kind' ? 'By kind' : 'Most flips' });
      b.addEventListener('click', () => {
        this.sort = mode;
        this.syncSort();
        this.renderBody();
      });
      this.sortButtons.set(mode, b);
      seg.append(b);
    }
    this.staleEl.append(
      h('span', { text: 'The sentence changed.' }),
      h('button', { class: 'link', text: 'Re-run for this sentence', on: { click: () => this.card && this.reopen() } })
    );
    const close = h('button', { class: 'icon-btn sm', html: icons.close, attrs: { title: 'Close', 'aria-label': 'Close swaps' }, on: { click: () => this.close() } });
    this.el.append(
      h('div', { class: 'swap-head' }, h('span', { class: 'swap-eyebrow', text: 'Swap' }), this.wordEl, h('span', { class: 'grow' }), close),
      this.contextEl,
      h('div', { class: 'swap-tools' }, this.input, seg),
      this.staleEl,
      this.infoEl,
      h('div', { class: 'swap-table' }, h('table', {}, this.colgroup, this.thead, this.tbody))
    );
    this.tbody.addEventListener('mouseleave', () => this.showPreview(null));
    this.resize.observe(this.contextEl);
    this.syncSort();
  }

  open(card: SentenceCard, index: number): void {
    const tok = card.dial.tokens[index];
    if (!tok?.word) return;
    if (this.card === card && this.index === index && !this.stale) return;
    this.detach();
    this.card = card;
    this.index = index;
    this.variants = [{ text: tok.text, kind: 'original', result: null }];
    this.baseIdx = 0;
    this.stale = false;
    this.specKey = '';
    card.dial.setPicked(index);
    this.unsubscribe.push(
      card.dial.events.on('change', ({ reason }) => {
        if (this.applying || reason === 'swap') return;
        this.stale = true;
        this.renderChrome();
      }),
      card.events.on('specs', () => void this.classifyAll())
    );
    this.el.hidden = false;
    this.deps.onVisibilityChange(true);
    this.renderContext();
    this.renderChrome();
    this.renderBody();
    void this.run();
  }

  close(): void {
    this.detach();
    this.card = null;
    this.el.hidden = true;
    this.deps.onVisibilityChange(false);
  }

  closeIfCard(card: SentenceCard): void {
    if (this.card === card) this.close();
  }

  private reopen(): void {
    const card = this.card;
    if (!card) return;
    this.stale = true;
    this.open(card, this.index);
  }

  private detach(): void {
    this.seq++;
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    this.card?.dial.setPicked(null);
  }

  private get specs(): QuestionSpec[] {
    return this.card?.specs ?? [];
  }

  private get base(): Variant {
    return this.variants[this.baseIdx];
  }

  private range(from: number, to: number): number[] {
    return Array.from({ length: to - from }, (_, i) => from + i);
  }

  private async run(): Promise<void> {
    const card = this.card;
    if (!card) return;
    const seq = ++this.seq;
    this.setStatus('Finding replacements…');
    const classifyOriginal = this.classifyVariants([0], seq);
    try {
      const options = await this.deps.backend().proposeSwaps({
        sentence: card.dial.text,
        marked: card.dial.marked(this.index),
        word: this.variants[0].text,
        specs: this.specs
      });
      if (seq !== this.seq) return;
      const start = this.variants.length;
      this.variants.push(...options.map(o => ({ text: o.text, kind: o.kind, result: null })));
      this.lockContextHeight();
      this.renderBody();
      await Promise.all([classifyOriginal, this.classifyVariants(this.range(start, this.variants.length), seq)]);
    } catch (err) {
      if (seq === this.seq) this.setStatus(errorMessage(err));
    }
  }

  private async classifyAll(): Promise<void> {
    for (const v of this.variants) v.result = null;
    this.renderBody();
    await this.classifyVariants(this.range(0, this.variants.length), this.seq);
  }

  private async classifyVariants(indices: number[], seq: number): Promise<void> {
    const card = this.card;
    const specs = this.specs;
    if (!card || !indices.length) return;
    if (!specs.length) {
      this.setStatus('Waiting for this card’s questions…');
      return;
    }
    const models = activeModels();
    this.setStatus(`Classifying ${indices.length} variant${indices.length > 1 ? 's' : ''} with ${models.map(m => S1_MODELS[m].label).join(' and ')}…`);
    const sentences = indices.map(i => card.dial.withReplacement(this.index, this.variants[i].text));
    const settled = await Promise.allSettled(models.map(m => this.deps.backend().classifyMany(sentences, specs, m)));
    if (seq !== this.seq) return;
    const errors: string[] = [];
    settled.forEach((res, mi) => {
      const m = models[mi];
      if (res.status === 'rejected') {
        errors.push(errorMessage(res.reason));
        return;
      }
      indices.forEach((vi, k) => {
        const v = this.variants[vi];
        const c = res.value[k];
        if (c) v.result = { ...(v.result ?? {}), [m]: c };
      });
    });
    for (const vi of indices) this.variants[vi].error = !this.variants[vi].result;
    this.setStatus(errors.join(' · '));
    this.renderBody();
  }

  modelsChanged(): void {
    if (!this.card) return;
    this.specKey = '';
    void this.classifyAll();
  }

  private async addCustom(text: string): Promise<void> {
    const clean = text.trim();
    if (!clean || !this.card) return;
    if (this.variants.some(v => v.text.toLowerCase() === clean.toLowerCase())) return;
    this.variants.push({ text: clean, kind: 'custom', result: null });
    this.lockContextHeight();
    this.renderBody();
    await this.classifyVariants([this.variants.length - 1], this.seq);
  }

  private apply(i: number): void {
    const card = this.card;
    const v = this.variants[i];
    if (!card || !v || i === this.baseIdx) return;
    this.applying = true;
    card.dial.replaceToken(this.index, v.text);
    this.applying = false;
    this.baseIdx = i;
    this.renderContext();
    this.renderChrome();
    this.renderBody();
    this.showPreview(null);
  }

  private flipsFor(v: Variant, m: S1Id): number {
    const base = this.base?.result?.[m];
    const res = v.result?.[m];
    if (!base || !res) return 0;
    let n = 0;
    for (const s of this.specs) {
      const b = base[s.id];
      const r = res[s.id];
      if (b && r && topLabel(r) !== topLabel(b)) n++;
    }
    return n;
  }

  private flips(v: Variant): number {
    return activeModels().reduce((n, m) => n + this.flipsFor(v, m), 0);
  }

  private shift(v: Variant): number {
    let total = 0;
    for (const m of activeModels()) {
      const base = this.base?.result?.[m];
      const res = v.result?.[m];
      if (!base || !res) continue;
      for (const s of this.specs) {
        const b = base[s.id];
        const r = res[s.id];
        if (!b || !r) continue;
        for (const label of Object.keys(b)) total += Math.abs((r[label] ?? 0) - b[label]);
      }
    }
    return total;
  }

  private ordered(): number[] {
    const rest = this.range(0, this.variants.length).filter(i => i !== this.baseIdx);
    if (this.sort === 'flips') {
      rest.sort((a, b) => this.flips(this.variants[b]) - this.flips(this.variants[a]) || this.shift(this.variants[b]) - this.shift(this.variants[a]));
    }
    return [this.baseIdx, ...rest];
  }

  private setStatus(text: string): void {
    this.status = text;
    this.renderChrome();
  }

  private syncSort(): void {
    for (const [mode, b] of this.sortButtons) b.classList.toggle('on', mode === this.sort);
  }

  private renderContext(): void {
    const card = this.card;
    if (!card) return;
    this.wordEl.textContent = this.base.text;
    this.markEl.textContent = this.base.text;
    this.markEl.classList.remove('preview');
    const before = card.dial.tokens.slice(0, this.index).map(t => t.text).join('');
    const after = card.dial.tokens.slice(this.index + 1).map(t => t.text).join('');
    this.contextEl.replaceChildren(before, this.markEl, after);
    this.lockContextHeight();
  }

  private lockContextHeight(): void {
    if (this.el.hidden || !this.card) return;
    const width = this.contextEl.clientWidth;
    if (!width) return;
    const shown = this.markEl.textContent;
    this.contextEl.style.minHeight = '';
    let max = this.contextEl.offsetHeight;
    for (const v of this.variants) {
      this.markEl.textContent = v.text;
      max = Math.max(max, this.contextEl.offsetHeight);
    }
    this.markEl.textContent = shown;
    this.contextEl.style.minHeight = `${max}px`;
    this.lastWidth = width;
  }

  private showPreview(text: string | null): void {
    const shown = text ?? this.base.text;
    this.markEl.textContent = shown;
    this.markEl.classList.toggle('preview', shown !== this.base.text);
  }

  private renderChrome(): void {
    this.staleEl.hidden = !this.stale;
    const done = this.variants.filter((v, i) => i !== this.baseIdx && v.result);
    this.infoEl.replaceChildren();
    this.infoEl.classList.remove('flipped');
    if (this.status) {
      this.infoEl.textContent = this.status;
    } else if (done.length) {
      const models = activeModels();
      const parts = models.map(m => {
        const flipped = done.filter(v => this.flipsFor(v, m) > 0).length;
        if (flipped) this.infoEl.classList.add('flipped');
        return h('span', { class: `swap-info-m m-${m}` }, models.length > 1 ? h('i', { class: 'mdot' }) : null, models.length > 1 ? `${S1_MODELS[m].label} ` : '', h('b', { text: `${flipped} of ${done.length}` }));
      });
      this.infoEl.append(...parts, ' replacements flip at least one answer');
    }
  }

  private renderHead(specs: QuestionSpec[]): void {
    const key = specs.map(s => `${s.id}:${s.name}`).join('|');
    if (key === this.specKey) return;
    this.specKey = key;
    this.colgroup.replaceChildren(h('col', { class: 'c-word' }), ...specs.map(() => h('col', { class: 'c-q' })));
    this.thead.replaceChildren(h('tr', {}, h('th', { text: 'Word' }), ...specs.map(s => h('th', { attrs: { title: `${s.name}: ${s.question}` } }, h('span', { class: 'th-text', text: s.name })))));
  }

  private renderBody(): void {
    if (!this.card) return;
    const specs = this.specs;
    this.renderHead(specs);
    this.tbody.replaceChildren(...this.ordered().map(i => this.renderRow(i, specs)));
    this.renderChrome();
  }

  private renderRow(i: number, specs: QuestionSpec[]): HTMLElement {
    const v = this.variants[i];
    const base = this.base.result;
    const isBase = i === this.baseIdx;
    const tag = isBase ? 'current' : KIND_LABEL[v.kind];
    const nameCell = h('td', { class: 'swap-name' }, h('div', { class: 'swap-text', text: v.text }), h('div', { class: `kind kind-${isBase ? 'current' : v.kind}`, text: tag }));
    const models = activeModels();
    const cells = specs.map(s => {
      const lines: HTMLElement[] = [];
      let anyFlip = false;
      let waiting = false;
      const titles: string[] = [];
      for (const m of models) {
        const dist: Distribution | undefined = v.result?.[m]?.[s.id];
        if (!dist) {
          waiting = true;
          continue;
        }
        const top = topLabel(dist);
        const b = base?.[m]?.[s.id];
        const baseTop = b ? topLabel(b) : top;
        const flip = !isBase && top !== baseTop;
        anyFlip ||= flip;
        const p = Math.round((dist[top] ?? 0) * 100);
        const drift = models.length === 1 && !isBase && !flip && b ? Math.round(((dist[baseTop] ?? 0) - (b[baseTop] ?? 0)) * 100) : 0;
        titles.push(`${S1_MODELS[m].label}: ${Object.entries(dist).map(([l, q]) => `${l} ${Math.round(q * 100)}%`).join(', ')}`);
        lines.push(
          h(
            'div',
            { class: `cline m-${m}${flip ? ' flip' : ''}` },
            models.length > 1 ? h('i', { class: 'mdot' }) : null,
            h('span', { class: 'cl', text: top }),
            h('span', { class: 'cn' }, h('span', { class: 'cp', text: `${p}%` }), drift ? h('span', { class: `cd ${drift > 0 ? 'up' : 'down'}`, text: `${drift > 0 ? '+' : '−'}${Math.abs(drift)}` }) : null)
          )
        );
      }
      if (!lines.length) return h('td', { class: `swap-cell${v.error ? ' err' : ' wait'}` }, h('div', { class: 'shimmer' }), h('div', { class: 'shimmer short' }));
      if (waiting) lines.push(h('div', { class: 'shimmer short' }));
      return h('td', { class: `swap-cell${anyFlip ? ' flip' : ''}${models.length > 1 ? ' multi' : ''}`, attrs: { title: titles.join('\n') } }, ...lines);
    });
    const row = h('tr', { class: isBase ? 'base' : '' }, nameCell, ...cells);
    if (!isBase) {
      row.tabIndex = 0;
      row.title = 'Click to use this word';
      row.addEventListener('click', () => this.apply(i));
      row.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') this.apply(i);
      });
      row.addEventListener('mouseenter', () => this.showPreview(v.text));
      row.addEventListener('focus', () => {
        if (row.matches(':focus-visible')) this.showPreview(v.text);
      });
      row.addEventListener('blur', () => this.showPreview(null));
    } else {
      row.addEventListener('mouseenter', () => this.showPreview(null));
    }
    return row;
  }
}
