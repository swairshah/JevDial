import { h } from '../util';
import { icons } from './icons';

export class Composer {
  readonly el: HTMLElement;
  private readonly input: HTMLTextAreaElement;

  constructor(onSubmit: (text: string) => void) {
    this.input = h('textarea', { class: 'composer-input', attrs: { rows: '1', placeholder: 'Add a sentence…', spellcheck: 'true', 'aria-label': 'New sentence' } });
    const submit = () => {
      const text = this.input.value.replace(/\s+/g, ' ').trim();
      if (!text) return;
      onSubmit(text);
      this.input.value = '';
      this.autosize();
    };
    this.input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
        ev.preventDefault();
        submit();
      }
    });
    this.input.addEventListener('input', () => this.autosize());
    const button = h('button', { class: 'composer-go', html: icons.enter, attrs: { title: 'Add (Enter)', 'aria-label': 'Add sentence' }, on: { click: submit } });
    this.el = h('div', { class: 'composer' }, this.input, button);
  }

  focus(): void {
    this.input.focus();
  }

  private autosize(): void {
    this.input.style.height = 'auto';
    this.input.style.height = `${this.input.scrollHeight}px`;
  }
}
