import { normalizeQuestions, type RawQuestion } from '../analysis/questions';
import type { DatasetDesign, DatasetItem, QuestionSpec } from '../types';
import { uid } from '../util';

export interface RawDesign {
  title?: string;
  summary?: string;
  setting?: { speaker?: string; recipient?: string; channel?: string; decision?: string };
  questions?: RawQuestion[];
}

export interface RawItems {
  items?: { text?: string; labels?: { question?: string; label?: string }[]; difficulty?: string; note?: string }[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function normalizeDesign(raw: RawDesign, questionCount: number): DatasetDesign {
  const specs = normalizeQuestions(raw.questions, questionCount);
  return {
    title: str(raw.title) || 'Untitled dataset',
    summary: str(raw.summary),
    setting: {
      speaker: str(raw.setting?.speaker),
      recipient: str(raw.setting?.recipient),
      channel: str(raw.setting?.channel),
      decision: str(raw.setting?.decision)
    },
    specs
  };
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function matchSpec(specs: QuestionSpec[], name: string): QuestionSpec | undefined {
  const key = squash(name);
  return specs.find(s => squash(s.name) === key) ?? specs.find(s => squash(s.name).includes(key) || key.includes(squash(s.name)));
}

function matchOption(spec: QuestionSpec, label: string): string | undefined {
  const key = squash(label);
  const exact = spec.options.find(o => squash(o.label) === key);
  if (exact) return exact.label;
  return spec.options.find(o => squash(o.label).startsWith(key) || key.startsWith(squash(o.label)))?.label;
}

export function normalizeItems(raw: RawItems, specs: QuestionSpec[]): DatasetItem[] {
  const out: DatasetItem[] = [];
  const seen = new Set<string>();
  for (const it of raw.items ?? []) {
    const text = str(it.text).replace(/\s+/g, ' ');
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    const labels: Record<string, string> = {};
    for (const l of it.labels ?? []) {
      const spec = matchSpec(specs, str(l.question));
      const label = spec && matchOption(spec, str(l.label));
      if (spec && label) labels[spec.id] = label;
    }
    out.push({ id: uid(), text, labels, difficulty: it.difficulty === 'borderline' ? 'borderline' : 'typical', note: str(it.note) });
  }
  return out;
}

export type Coverage = Record<string, Record<string, number>>;

export function coverageOf(specs: QuestionSpec[], items: DatasetItem[]): Coverage {
  const cov: Coverage = {};
  for (const s of specs) {
    cov[s.id] = Object.fromEntries(s.options.map(o => [o.label, 0]));
    for (const it of items) {
      const label = it.labels[s.id];
      if (label && label in cov[s.id]) cov[s.id][label]++;
    }
  }
  return cov;
}

export function missingOptions(specs: QuestionSpec[], items: DatasetItem[]): string[] {
  const cov = coverageOf(specs, items);
  const missing: string[] = [];
  for (const s of specs) for (const o of s.options) if (!cov[s.id][o.label]) missing.push(`${s.name}: ${o.label}`);
  return missing;
}
