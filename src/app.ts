import { currentBackend } from './backends';
import { SEED_SENTENCE } from './config';
import { settings, settingsEvents, storage } from './settings';
import { Composer } from './ui/Composer';
import { DatasetPage, type OpenMode } from './dataset/DatasetPage';
import type { Dataset } from './types';
import { Header, type Route } from './ui/Header';
import { SentenceCard, type CardRecord } from './ui/SentenceCard';
import { SettingsDialog } from './ui/SettingsDialog';
import { SwapPanel } from './ui/SwapPanel';
import { applyTheme } from './ui/theme';
import { h, uid } from './util';

const STORE_KEY = 'cards';

export class App {
  private readonly cards: SentenceCard[] = [];
  private readonly list = h('div', { class: 'cards' });
  private readonly settingsDialog = new SettingsDialog();
  private readonly composer = new Composer(text => this.add(text));
  private readonly shell = h('div', { class: 'shell' });
  private readonly playground = h('div', { class: 'page' });
  private readonly datasetPage = new DatasetPage({ backend: currentBackend, onOpen: (ds, mode) => this.openDataset(ds, mode) });
  private header!: Header;
  private readonly swap = new SwapPanel({
    backend: currentBackend,
    onVisibilityChange: open => this.shell.classList.toggle('with-swap', open)
  });

  constructor(root: HTMLElement) {
    this.header = new Header(() => this.openSettings());
    this.playground.append(this.composer.el, this.list);
    this.shell.append(h('div', { class: 'wrap' }, this.header.el, this.playground, this.datasetPage.el), this.swap.el);
    root.append(this.shell);
    addEventListener('hashchange', () => this.route());
    this.route();
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && !this.swap.el.hidden && !(ev.target instanceof HTMLInputElement) && !(ev.target instanceof HTMLTextAreaElement)) this.swap.close();
    });
    settingsEvents.on('change', ({ previous }) => {
      applyTheme(settings.theme);
      const backendChanged =
        previous.mock !== settings.mock ||
        previous.llmModel !== settings.llmModel ||
        previous.jevModel !== settings.jevModel ||
        previous.kevModel !== settings.kevModel ||
        previous.jevEndpoint !== settings.jevEndpoint;
      const keysAdded = (!previous.orKey && !!settings.orKey) || (!previous.tsKey && !!settings.tsKey);
      if (backendChanged || keysAdded) {
        this.swap.close();
        for (const card of this.cards) void card.restart();
      } else if (previous.s1.join() !== settings.s1.join()) {
        for (const card of this.cards) void card.modelsChanged();
        this.swap.modelsChanged();
      }
    });
    const stored = storage.getJSON<CardRecord[]>(STORE_KEY, []);
    if (stored.length) for (const record of [...stored].reverse()) this.mount(record, false);
    else this.add(SEED_SENTENCE);
    if (!this.playground.hidden) this.composer.focus();
  }

  private route(): void {
    const route: Route = location.hash.startsWith('#/dataset') ? 'dataset' : 'playground';
    this.header.setRoute(route);
    this.playground.hidden = route !== 'playground';
    this.datasetPage.el.hidden = route !== 'dataset';
    if (route !== 'playground') this.swap.close();
    else this.composer.focus();
  }

  private openDataset(ds: Dataset, mode: OpenMode): void {
    if (mode === 'replace') for (const card of [...this.cards]) this.remove(card, false);
    for (const item of [...ds.items].reverse()) {
      this.mount(
        {
          id: uid(),
          original: item.text,
          text: item.text,
          specs: ds.specs.map(s => ({ ...s, options: s.options.map(o => ({ ...o })) })),
          baselines: {},
          expected: item.labels,
          source: { dataset: ds.title, difficulty: item.difficulty, note: item.note }
        },
        false
      );
    }
    this.persist();
    location.hash = '#/';
    window.scrollTo({ top: 0 });
  }

  openSettings(): void {
    this.settingsDialog.open();
  }

  add(text: string): void {
    this.mount({ id: uid(), original: text, text, specs: null, baselines: {} }, true);
    this.persist();
  }

  private mount(record: CardRecord, animate: boolean): void {
    const card = new SentenceCard(record, {
      backend: currentBackend,
      onChange: () => this.persist(),
      onRemove: c => this.remove(c),
      onPick: (c, index) => this.swap.open(c, index)
    });
    this.cards.unshift(card);
    this.list.prepend(card.el);
    if (animate) card.el.classList.add('enter');
    void card.start();
  }

  private remove(card: SentenceCard, animate = true): void {
    const i = this.cards.indexOf(card);
    if (i < 0) return;
    this.cards.splice(i, 1);
    this.swap.closeIfCard(card);
    card.dispose();
    this.persist();
    const el = card.el;
    if (!animate) {
      el.remove();
      return;
    }
    el.style.height = `${el.offsetHeight}px`;
    void el.offsetWidth;
    el.classList.add('leave');
    el.style.height = '0px';
    window.setTimeout(() => el.remove(), 260);
  }

  private persist(): void {
    storage.setJSON(
      STORE_KEY,
      this.cards.map(c => c.record)
    );
  }
}
