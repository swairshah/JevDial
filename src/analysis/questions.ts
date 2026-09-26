import { QUESTION_COUNT } from '../config';
import type { Distribution, QuestionSpec } from '../types';

export interface RawQuestion {
  name?: unknown;
  question?: unknown;
  options?: { label?: unknown; description?: unknown }[];
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

export function normalizeQuestions(raw: RawQuestion[] | undefined): QuestionSpec[] {
  const specs: QuestionSpec[] = [];
  for (const q of raw ?? []) {
    const name = clean(q.name);
    const seen = new Set<string>();
    const options = (q.options ?? [])
      .map(o => ({ label: clean(o.label).toLowerCase(), description: clean(o.description) }))
      .filter(o => o.label && !seen.has(o.label) && seen.add(o.label))
      .slice(0, 8);
    if (!name || options.length < 2) continue;
    specs.push({ id: `q${specs.length + 1}`, name, question: clean(q.question) || name, options });
    if (specs.length === QUESTION_COUNT) break;
  }
  if (!specs.length) throw new Error('The model did not propose any usable questions');
  return specs;
}

export function normalizeDistribution(spec: QuestionSpec, probabilities: Record<string, number> | undefined): Distribution {
  const out: Distribution = {};
  let total = 0;
  for (const { label } of spec.options) {
    const p = Math.max(0, Number(probabilities?.[label]) || 0);
    out[label] = p;
    total += p;
  }
  for (const label of Object.keys(out)) out[label] = total > 0 ? out[label] / total : 1 / spec.options.length;
  return out;
}

export function topLabel(dist: Distribution): string {
  let best = '';
  let bestP = -1;
  for (const [label, p] of Object.entries(dist)) if (p > bestP) [best, bestP] = [label, p];
  return best;
}
