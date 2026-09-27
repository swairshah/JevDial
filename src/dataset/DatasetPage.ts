import type { Backend, Dataset, QuestionSpec } from '../types';
import { errorMessage, h } from '../util';
import { icons } from '../ui/icons';
import { toast } from '../ui/toast';
import { generateDataset, regenerateItems, type Stage } from './generate';
import { coverageOf } from './normalize';
import { DATASET_PRESETS } from './prompts';
import { datasetStore } from './store';

export type OpenMode = 'replace' | 'append';

export interface DatasetPageDeps {
  backend: () => Backend;
  onOpen: (dataset: Dataset, mode: OpenMode) => void;
}

const STAGES: { stage: Exclude<Stage, 'done'>; label: string }[] = [
  { stage: 'design', label: 'Designing questions' },
  { stage: 'write', label: 'Writing sentences' },
  { stage: 'fill', label: 'Filling coverage gaps' }
];

const COUNTS = [10, 20, 30];
const QUESTION_COUNTS = [3, 4, 5];

function select(id: string, values: number[], initial: number): HTMLSelectElement {
  const el = h('select', { attrs: { id } }, ...values.map(v => h('option', { text: String(v), attrs: { value: String(v) } })));
  el.value = String(initial);
  return el;
}

export class DatasetPage {
  readonly el = h('section', { class: 'dataset-page' });
  private readonly desc = h('textarea', {
    class: 'ds-desc',
    attrs: { id: 'ds-desc', rows: '4', spellcheck: 'true', placeholder: 'Who writes these messages, to whom, about what, and what the reader has to decide…', 'aria-label': 'Dataset description' }
  });
  private readonly countSel = select('ds-count', COUNTS, 20);
  private readonly qSel = select('ds-questions', QUESTION_COUNTS, 4);
  private readonly goBtn = h('button', { class: 'btn primary', text: 'Generate' });
  private readonly progress = h('ol', { class: 'ds-progress' });
  private readonly result = h('div', { class: 'ds-result' });
  private readonly history = h('div', { class: 'ds-history' });
  private current: Dataset | null = null;
  private busy = false;
  private stage: Stage | null = null;
  private stageDetail = '';

  constructor(private readonly deps: DatasetPageDeps) {
    const presets = h(
      'div',
      { class: 'chips' },
      ...DATASET_PRESETS.map(p =>
        h('button', {
          class: 'chip',
          text: p.name,
          on: {
            click: () => {
              this.desc.value = p.description;
              this.desc.focus();
            }
          }
        })
      )
    );
    this.goBtn.addEventListener('click', () => void this.generate());
    this.desc.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        void this.generate();
      }
    });
    const form = h(
      'div',
      { class: 'ds-form' },
      presets,
      this.desc,
      h(
        'div',
        { class: 'ds-row' },
        h('label', { class: 'ds-opt', attrs: { for: 'ds-count' } }, 'Sentences', this.countSel),
        h('label', { class: 'ds-opt', attrs: { for: 'ds-questions' } }, 'Questions', this.qSel),
        h('span', { class: 'grow' }),
        this.goBtn
      )
    );
    this.el.append(form, this.progress, this.result, this.history);
    this.renderProgress();
    const last = datasetStore.list()[0];
    if (last) this.show(last);
    this.renderHistory();
  }

  private async generate(): Promise<void> {
    const description = this.desc.value.trim();
    if (this.busy) return;
    if (description.length < 12) {
      toast('Describe the dataset in a sentence or two first.');
      this.desc.focus();
      return;
    }
    this.setBusy(true);
    try {
      const dataset = await generateDataset(this.deps.backend(), {
        description,
        count: Number(this.countSel.value),
        questionCount: Number(this.qSel.value),
        onStage: (stage, detail) => this.setStage(stage, detail)
      });
      datasetStore.save(dataset);
      this.show(dataset);
      this.renderHistory();
    } catch (err) {
      toast(errorMessage(err));
      this.setStage(null);
    } finally {
      this.setBusy(false);
    }
  }

  private async regenerate(): Promise<void> {
    const ds = this.current;
    if (!ds || this.busy) return;
    this.setBusy(true);
    try {
      const next = await regenerateItems(this.deps.backend(), ds, Number(this.countSel.value), (stage, detail) => this.setStage(stage, detail));
      datasetStore.save(next);
      this.show(next);
      this.renderHistory();
    } catch (err) {
      toast(errorMessage(err));
      this.setStage(null);
    } finally {
      this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.goBtn.disabled = busy;
    this.goBtn.textContent = busy ? 'Generating…' : 'Generate';
    this.el.classList.toggle('busy', busy);
  }

  private setStage(stage: Stage | null, detail = ''): void {
    this.stage = stage;
    this.stageDetail = detail;
    this.renderProgress();
  }

  private renderProgress(): void {
    const order: Stage[] = ['design', 'write', 'fill', 'done'];
    const at = this.stage ? order.indexOf(this.stage) : -1;
    this.progress.hidden = this.stage === null;
    this.progress.replaceChildren(
      ...STAGES.map(s => {
        const i = order.indexOf(s.stage);
        const state = at > i || this.stage === 'done' ? 'done' : at === i ? 'active' : 'todo';
        return h('li', { class: state }, h('span', { class: 'dot' }), h('span', { text: s.label }), state === 'active' && this.stageDetail ? h('span', { class: 'detail', text: this.stageDetail }) : null);
      })
    );
  }

  private show(ds: Dataset): void {
    this.current = ds;
    this.desc.value = ds.description;
    const cov = coverageOf(ds.specs, ds.items);
    const setting = [ds.setting.speaker && `${ds.setting.speaker} → ${ds.setting.recipient}`, ds.setting.channel, ds.setting.decision && `decides ${ds.setting.decision}`].filter(Boolean).join(' · ');
    const borderline = ds.items.filter(i => i.difficulty === 'borderline').length;
    const gaps = ds.specs.reduce((n, s) => n + s.options.filter(o => !cov[s.id][o.label]).length, 0);

    const head = h(
      'div',
      { class: 'ds-head' },
      h('div', { class: 'ds-title' }, h('h2', { text: ds.title }), ds.summary ? h('p', { text: ds.summary }) : null, setting ? h('p', { class: 'ds-setting', text: setting }) : null),
      h(
        'div',
        { class: 'ds-actions' },
        h('button', { class: 'btn primary', text: 'Open in playground', attrs: { title: 'Replace the playground cards with these sentences' }, on: { click: () => this.deps.onOpen(ds, 'replace') } }),
        h('button', { class: 'btn', text: 'Add to playground', on: { click: () => this.deps.onOpen(ds, 'append') } }),
        h('button', { class: 'btn ghost', text: 'New sentences', attrs: { title: 'Keep the questions, write new sentences' }, on: { click: () => void this.regenerate() } })
      )
    );
    const stats = h(
      'div',
      { class: 'ds-stats' },
      h('span', {}, h('b', { text: String(ds.items.length) }), ' sentences'),
      h('span', {}, h('b', { text: String(ds.specs.length) }), ' questions'),
      h('span', {}, h('b', { text: String(borderline) }), ' borderline'),
      h('span', { class: gaps ? 'bad' : 'good' }, h('b', { text: String(gaps) }), gaps === 1 ? ' option without an example' : ' options without an example')
    );
    const questions = h('div', { class: 'ds-questions' }, ...ds.specs.map(s => this.renderQuestion(s, cov[s.id])));
    const rows = ds.items.map((item, n) => {
      const labels = h('div', { class: 'ds-labels' }, ...ds.specs.map(s => (item.labels[s.id] ? h('span', { class: 'ds-label', attrs: { title: s.name } }, h('i', { text: s.name }), item.labels[s.id]) : null)));
      const remove = h('button', { class: 'icon-btn sm', html: icons.close, attrs: { title: 'Remove sentence', 'aria-label': 'Remove sentence' } });
      remove.addEventListener('click', () => {
        const next = { ...ds, items: ds.items.filter(i => i.id !== item.id) };
        datasetStore.save(next);
        this.show(next);
        this.renderHistory();
      });
      return h(
        'li',
        { class: `ds-item${item.difficulty === 'borderline' ? ' borderline' : ''}` },
        h('span', { class: 'ds-n', text: String(n + 1) }),
        h(
          'div',
          { class: 'ds-body' },
          h('p', { class: 'ds-text', text: item.text }),
          labels,
          item.difficulty === 'borderline' ? h('p', { class: 'ds-note' }, h('span', { class: 'pill warn', text: 'borderline' }), item.note) : null
        ),
        remove
      );
    });
    this.result.replaceChildren(head, stats, questions, h('ol', { class: 'ds-items' }, ...rows));
  }

  private renderQuestion(spec: QuestionSpec, counts: Record<string, number>): HTMLElement {
    const max = Math.max(1, ...Object.values(counts));
    return h(
      'section',
      { class: 'ds-q' },
      h('h3', { attrs: { title: spec.question } }, spec.name, spec.kind ? h('span', { class: 'pill', text: spec.kind }) : null),
      h(
        'div',
        { class: 'ds-cov' },
        ...spec.options.map(o => {
          const n = counts[o.label] ?? 0;
          return h(
            'div',
            { class: `ds-cov-row${n ? '' : ' empty'}`, attrs: { title: o.description } },
            h('span', { class: 'l', text: o.label }),
            h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: `${(n / max) * 100}%` } })),
            h('span', { class: 'v', text: String(n) })
          );
        })
      )
    );
  }

  private renderHistory(): void {
    const list = datasetStore.list();
    this.history.hidden = !list.length;
    this.history.replaceChildren(
      h('h3', { text: 'Saved datasets' }),
      h(
        'ul',
        {},
        ...list.map(ds => {
          const open = h('button', { class: 'ds-hist-open' }, h('span', { class: 't', text: ds.title }), h('span', { class: 'm', text: `${ds.items.length} sentences · ${new Date(ds.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` }));
          open.addEventListener('click', () => {
            this.setStage(null);
            this.show(ds);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
          const del = h('button', { class: 'icon-btn sm', html: icons.close, attrs: { title: 'Delete dataset', 'aria-label': `Delete ${ds.title}` } });
          del.addEventListener('click', () => {
            datasetStore.remove(ds.id);
            if (this.current?.id === ds.id) {
              this.current = null;
              this.result.replaceChildren();
            }
            this.renderHistory();
          });
          return h('li', { class: this.current?.id === ds.id ? 'on' : '' }, open, del);
        })
      )
    );
  }
}
