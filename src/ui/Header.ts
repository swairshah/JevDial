import { settings, settingsEvents, updateSettings } from '../settings';
import { h } from '../util';
import { icons } from './icons';
import { nextTheme } from './theme';

const THEME_ICON = { system: icons.system, light: icons.sun, dark: icons.moon } as const;
const THEME_LABEL = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' } as const;

export class Header {
  readonly el: HTMLElement;
  private readonly themeBtn: HTMLButtonElement;
  private readonly soundBtn: HTMLButtonElement;
  private readonly modePill: HTMLElement;

  constructor(onOpenSettings: () => void) {
    this.themeBtn = h('button', { class: 'icon-btn', on: { click: () => updateSettings({ theme: nextTheme(settings.theme) }) } });
    this.soundBtn = h('button', { class: 'icon-btn', on: { click: () => updateSettings({ sound: !settings.sound }) } });
    const gear = h('button', { class: 'icon-btn', html: icons.settings, attrs: { title: 'Settings', 'aria-label': 'Settings' }, on: { click: onOpenSettings } });
    this.modePill = h('span', { class: 'pill', text: 'demo' });
    this.el = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand' }, h('h1', { text: 'Word Dial' }), this.modePill),
      h('div', { class: 'tools' }, this.themeBtn, this.soundBtn, gear)
    );
    this.sync();
    settingsEvents.on('change', () => this.sync());
  }

  private sync(): void {
    this.themeBtn.innerHTML = THEME_ICON[settings.theme];
    this.themeBtn.title = THEME_LABEL[settings.theme];
    this.themeBtn.setAttribute('aria-label', THEME_LABEL[settings.theme]);
    this.soundBtn.innerHTML = settings.sound ? icons.soundOn : icons.soundOff;
    this.soundBtn.title = settings.sound ? 'Sound on' : 'Sound off';
    this.soundBtn.classList.toggle('off', !settings.sound);
    this.modePill.hidden = !settings.mock;
  }
}
