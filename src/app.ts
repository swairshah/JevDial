import { currentBackend } from './backends';
import { SEED_SENTENCE } from './config';
import { settings, settingsEvents, storage } from './settings';
import { Composer } from './ui/Composer';
import { Header } from './ui/Header';
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
  private readonly swap = new SwapPanel({
    backend: currentBackend,
    onVisibilityChange: open => this.shell.classList.toggle('with-swap', open)
  });

  constructor(root: HTMLElement) {
    const header = new Header(() => this.openSettings());
    this.shell.append(h('div', { class: 'wrap' }, header.el, this.composer.el, this.list), this.swap.el);
    root.append(this.shell);
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && !this.swap.el.hidden && !(ev.target instanceof HTMLInputElement) && !(ev.target instanceof HTMLTextAreaElement)) this.swap.close();
    });
    settingsEvents.on('change', ({ previous }) => {
      applyTheme(settings.theme);
      const backendChanged =
        previous.mock !== settings.mock || previous.llmModel !== settings.llmModel || previous.jevModel !== settings.jevModel || previous.jevEndpoint !== settings.jevEndpoint;
      const keysAdded = (!previous.orKey && !!settings.orKey) || (!previous.tsKey && !!settings.tsKey);
      if (backendChanged || keysAdded) {
        this.swap.close();
        for (const card of this.cards) void card.restart();
      }
    });
    const stored = storage.getJSON<CardRecord[]>(STORE_KEY, []);
    if (stored.length) for (const record of [...stored].reverse()) this.mount(record, false);
    else this.add(SEED_SENTENCE);
    this.composer.focus();
  }

  openSettings(): void {
    this.settingsDialog.open();
  }

  add(text: string): void {
    this.mount({ id: uid(), original: text, text, specs: null, baseline: null }, true);
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

  private remove(card: SentenceCard): void {
    const i = this.cards.indexOf(card);
    if (i < 0) return;
    this.cards.splice(i, 1);
    this.swap.closeIfCard(card);
    card.dispose();
    this.persist();
    const el = card.el;
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
