import { settings, settingsEvents, updateSettings } from '../settings';
import { S1_MODELS, S1_ORDER } from '../services/systemone';
import { h, replay } from '../util';
import { icons } from './icons';
import { nextTheme } from './theme';

export type Route = 'playground' | 'dataset';
export const ROUTES: { route: Route; label: string; hash: string }[] = [
  { route: 'playground', label: 'Playground', hash: '#/' },
  { route: 'dataset', label: 'Dataset', hash: '#/dataset' }
];

const THEME_ICON = { system: icons.system, light: icons.sun, dark: icons.moon } as const;
const THEME_LABEL = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' } as const;

export class Header {
  readonly el: HTMLElement;
  private readonly themeBtn: HTMLButtonElement;
  private readonly soundBtn: HTMLButtonElement;
  private readonly modePill: HTMLElement;
  private readonly tabs = new Map<Route, HTMLAnchorElement>();
  private readonly s1Buttons = new Map<string, HTMLButtonElement>();

  constructor(onOpenSettings: () => void) {
    this.themeBtn = h('button', { class: 'icon-btn', on: { click: () => updateSettings({ theme: nextTheme(settings.theme) }) } });
    this.soundBtn = h('button', { class: 'icon-btn', on: { click: () => updateSettings({ sound: !settings.sound }) } });
    const gear = h('button', { class: 'icon-btn', html: icons.settings, attrs: { title: 'Settings', 'aria-label': 'Settings' }, on: { click: onOpenSettings } });
    this.modePill = h('span', { class: 'pill', text: 'demo' });
    this.el = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand' }, h('h1', { text: 'Word Dial' }), this.modePill),
      h(
        'nav',
        { class: 'tabs' },
        ...ROUTES.map(r => {
          const a = h('a', { text: r.label, attrs: { href: r.hash } });
          this.tabs.set(r.route, a);
          return a;
        })
      ),
      h(
        'div',
        { class: 's1-toggle', attrs: { role: 'group', 'aria-label': 'System-1 models' } },
        ...S1_ORDER.map(m => {
          const b = h('button', { class: `s1-chip m-${m}`, attrs: { title: `${S1_MODELS[m].label} (${S1_MODELS[m].provider})` } }, h('i', { class: 'mdot' }), S1_MODELS[m].label);
          b.addEventListener('click', () => {
            const on = settings.s1.includes(m);
            if (on && settings.s1.length === 1) {
              replay(b, 'reject');
              return;
            }
            updateSettings({ s1: on ? settings.s1.filter(x => x !== m) : [...settings.s1, m] });
          });
          this.s1Buttons.set(m, b);
          return b;
        })
      ),
      h('div', { class: 'tools' }, this.themeBtn, this.soundBtn, gear)
    );
    this.sync();
    settingsEvents.on('change', () => this.sync());
  }

  setRoute(route: Route): void {
    for (const [r, a] of this.tabs) {
      a.classList.toggle('on', r === route);
      if (r === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  }

  private sync(): void {
    this.themeBtn.innerHTML = THEME_ICON[settings.theme];
    this.themeBtn.title = THEME_LABEL[settings.theme];
    this.themeBtn.setAttribute('aria-label', THEME_LABEL[settings.theme]);
    this.soundBtn.innerHTML = settings.sound ? icons.soundOn : icons.soundOff;
    this.soundBtn.title = settings.sound ? 'Sound on' : 'Sound off';
    this.soundBtn.classList.toggle('off', !settings.sound);
    this.modePill.hidden = !settings.mock;
    for (const [m, b] of this.s1Buttons) {
      const on = settings.s1.includes(m as never);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }
}
