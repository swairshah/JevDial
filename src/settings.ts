import { DEFAULT_JEV, DEFAULT_LLM, DEFAULT_QUESTION_LLM } from './config';
import { Emitter } from './util';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  orKey: string;
  tsKey: string;
  llmModel: string;
  questionModel: string;
  jevModel: string;
  jevEndpoint: string;
  haptics: boolean;
  sound: boolean;
  invertScroll: boolean;
  rememberKeys: boolean;
  mock: boolean;
  theme: ThemeMode;
}

const PREFS_VERSION = 3;
const PREFIX = 'worddial:';

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(PREFIX + key);
      else localStorage.setItem(PREFIX + key, value);
    } catch {}
  },
  getJSON<T>(key: string, fallback: T): T {
    const raw = this.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  setJSON(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  }
};

export const settings: Settings = {
  orKey: '',
  tsKey: '',
  llmModel: DEFAULT_LLM,
  questionModel: DEFAULT_QUESTION_LLM,
  jevModel: DEFAULT_JEV,
  jevEndpoint: 'auto',
  haptics: true,
  sound: true,
  invertScroll: false,
  rememberKeys: false,
  mock: false,
  theme: 'system'
};

export const settingsEvents = new Emitter<{ change: { previous: Settings } }>();

type StoredPrefs = Partial<Omit<Settings, 'orKey' | 'tsKey'>> & { version?: number; invert?: boolean; remember?: boolean };

export function loadSettings(): void {
  const prefs = storage.getJSON<StoredPrefs>('prefs', {});
  const { version, invert, remember, ...rest } = prefs;
  Object.assign(settings, rest);
  if (invert !== undefined) settings.invertScroll = invert;
  if (remember !== undefined) settings.rememberKeys = remember;
  if ((version ?? 0) < PREFS_VERSION) settings.llmModel = DEFAULT_LLM;
  if (settings.rememberKeys) {
    settings.orKey = storage.get('orKey') ?? '';
    settings.tsKey = storage.get('tsKey') ?? '';
  }
  const query = new URLSearchParams(location.search);
  if (query.has('mock')) settings.mock = true;
  persist();
}

function persist(): void {
  const { orKey, tsKey, ...prefs } = settings;
  storage.setJSON('prefs', { ...prefs, version: PREFS_VERSION });
  storage.set('orKey', settings.rememberKeys && orKey ? orKey : null);
  storage.set('tsKey', settings.rememberKeys && tsKey ? tsKey : null);
}

export function updateSettings(patch: Partial<Settings>): void {
  const previous = { ...settings };
  Object.assign(settings, patch);
  persist();
  settingsEvents.emit('change', { previous });
}
