import { LLM_CHOICES, QUESTION_LLM_CHOICES } from '../config';
import { proxy } from '../services/proxy';
import { settings, updateSettings, type Settings } from '../settings';
import { h } from '../util';

type TextKey = 'orKey' | 'tsKey' | 'llmModel' | 'questionModel' | 'jevModel' | 'jevEndpoint';
type BoolKey = 'haptics' | 'sound' | 'invertScroll' | 'rememberKeys' | 'mock';

const TEXT_FIELDS: { key: TextKey; label: string; secret?: boolean; list?: string[] }[] = [
  { key: 'orKey', label: 'OpenRouter API key', secret: true },
  { key: 'tsKey', label: 'TypeSafe API key', secret: true },
  { key: 'llmModel', label: 'Word model', list: LLM_CHOICES },
  { key: 'questionModel', label: 'Question model', list: QUESTION_LLM_CHOICES },
  { key: 'jevModel', label: 'Jev model' },
  { key: 'jevEndpoint', label: 'Jev endpoint' }
];

const TOGGLES: { key: BoolKey; label: string }[] = [
  { key: 'haptics', label: 'Haptics' },
  { key: 'sound', label: 'Sound' },
  { key: 'invertScroll', label: 'Invert scroll' },
  { key: 'rememberKeys', label: 'Remember keys here' },
  { key: 'mock', label: 'Demo mode (offline)' }
];

export class SettingsDialog {
  private readonly dialog: HTMLDialogElement;
  private readonly inputs = new Map<TextKey, HTMLInputElement>();
  private readonly checks = new Map<BoolKey, HTMLInputElement>();
  private readonly note = h('p', { class: 'note' });

  constructor() {
    const fields = TEXT_FIELDS.map(f => {
      const id = `set-${f.key}`;
      const input = h('input', { attrs: { id, type: f.secret ? 'password' : 'text', autocomplete: 'off', spellcheck: 'false' } });
      this.inputs.set(f.key, input);
      const list = f.list ? h('datalist', { attrs: { id: `${id}-list` } }, ...f.list.map(v => h('option', { attrs: { value: v } }))) : null;
      if (list) input.setAttribute('list', `${id}-list`);
      return h('div', { class: `field${f.key === 'llmModel' || f.key === 'questionModel' ? ' half' : ''}` }, h('label', { text: f.label, attrs: { for: id } }), input, list);
    });
    const toggles = TOGGLES.map(t => {
      const input = h('input', { attrs: { type: 'checkbox' } });
      this.checks.set(t.key, input);
      return h('label', { class: 'toggle' }, input, h('span', { text: t.label }));
    });
    const form = h(
      'form',
      { attrs: { method: 'dialog' } },
      h('h2', { text: 'Settings' }),
      this.note,
      h('div', { class: 'fields' }, ...fields),
      h('div', { class: 'toggles' }, ...toggles),
      h('div', { class: 'actions' }, h('button', { class: 'btn', text: 'Cancel', attrs: { value: 'cancel' } }), h('button', { class: 'btn primary', text: 'Save', attrs: { value: 'save' } }))
    );
    form.addEventListener('submit', ev => {
      if ((ev.submitter as HTMLButtonElement | null)?.value === 'save') this.save();
    });
    this.dialog = h('dialog', { class: 'settings' }, form);
    document.body.append(this.dialog);
  }

  open(): void {
    for (const [key, input] of this.inputs) input.value = String(settings[key]);
    for (const [key, input] of this.checks) input.checked = settings[key];
    const mark = (b: boolean) => (b ? '✓' : '–');
    this.note.textContent = proxy.available
      ? `Local proxy · .env keys: TypeSafe ${mark(proxy.hasJevKey)} OpenRouter ${mark(proxy.hasLlmKey)}. Blank key fields use .env.`
      : 'No local proxy. Keys typed here are sent from the browser.';
    this.dialog.showModal();
  }

  private save(): void {
    const patch: Partial<Settings> = {};
    for (const [key, input] of this.inputs) patch[key] = input.value.trim();
    for (const [key, input] of this.checks) patch[key] = input.checked;
    patch.llmModel ||= settings.llmModel;
    patch.questionModel ||= settings.questionModel;
    patch.jevModel ||= settings.jevModel;
    patch.jevEndpoint ||= 'auto';
    updateSettings(patch);
  }
}
