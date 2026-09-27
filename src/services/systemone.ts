import { JEV_DIRECT_URL, OPENROUTER_SYSTEMONE_URL } from '../config';
import { settings } from '../settings';
import type { S1Id } from '../types';
import { chunk } from '../util';
import { proxy } from './proxy';

type Text = string | null;

export type S1Question =
  | { type: 'choice'; instructions: string; criteria: Record<string, Text> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'noul'; instructions: string; criteria?: { true?: Text; false?: Text } };

export type S1Answer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities?: Record<string, number>; confidence: number }
  | { type: 'noul'; noul: number };

export type S1Questions = Record<string, S1Question>;
export type S1Answers = Record<string, S1Answer | undefined>;

export const S1_MODELS: Record<S1Id, { label: string; provider: string; batch: number }> = {
  jev: { label: 'Jev', provider: 'TypeSafe', batch: 60 },
  kev: { label: 'Kev', provider: 'OpenRouter', batch: 24 }
};

export const S1_ORDER: S1Id[] = ['jev', 'kev'];

export const activeModels = (): S1Id[] => S1_ORDER.filter(m => settings.s1.includes(m));

export const primaryModel = (): S1Id => activeModels()[0] ?? 'jev';

export function hasS1Access(model: S1Id): boolean {
  if (model === 'jev') return !!settings.tsKey || proxy.hasJevKey;
  return !!settings.orKey || proxy.hasLlmKey;
}

interface Target {
  url: string;
  key: string;
  model: string;
}

function target(model: S1Id): Target {
  if (model === 'jev') {
    const custom = settings.jevEndpoint && settings.jevEndpoint !== 'auto' ? settings.jevEndpoint : '';
    return { url: custom || (proxy.available ? '/api/jev' : JEV_DIRECT_URL), key: settings.tsKey, model: settings.jevModel };
  }
  const useProxy = proxy.available && !settings.orKey;
  return { url: useProxy ? '/api/kev' : OPENROUTER_SYSTEMONE_URL, key: settings.orKey, model: settings.kevModel };
}

const MAX_CONCURRENT = 4;
const active: Record<S1Id, number> = { jev: 0, kev: 0 };
const waiting: Record<S1Id, (() => void)[]> = { jev: [], kev: [] };

export async function systemOne(model: S1Id, state: unknown, questions: S1Questions): Promise<S1Answers> {
  while (active[model] >= MAX_CONCURRENT) await new Promise<void>(resolve => waiting[model].push(resolve));
  active[model]++;
  try {
    return await request(model, state, questions);
  } finally {
    active[model]--;
    waiting[model].shift()?.();
  }
}

async function request(model: S1Id, state: unknown, questions: S1Questions): Promise<S1Answers> {
  const { url, key, model: checkpoint } = target(model);
  const name = S1_MODELS[model].label;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  let r: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: checkpoint, state, questions }) });
    } catch {
      throw new Error(proxy.available ? `Could not reach ${name} through the local proxy` : `Browser could not reach ${name} directly (CORS). Open the page from jev_proxy.py.`);
    }
    if (r.status !== 429 && r.status < 500) break;
    await new Promise(res => setTimeout(res, 500 * 2 ** attempt));
  }
  if (r && r.status === 404 && url.startsWith('/api/')) throw new Error(`${name}: the running jev_proxy.py is an older version without this route. Stop it and start it again.`);
  if (!r || !r.ok) throw new Error(`${name} ${r?.status ?? ''}: ${r ? (await r.text()).slice(0, 180) : 'no response'}`);
  const data = (await r.json()) as { answers?: S1Answers };
  return data.answers ?? {};
}

export async function systemOneBatched(model: S1Id, state: unknown, questions: S1Questions, size = S1_MODELS[model].batch): Promise<S1Answers> {
  const parts = chunk(Object.entries(questions), size);
  const results = await Promise.all(parts.map(part => systemOne(model, state, Object.fromEntries(part))));
  return Object.assign({}, ...results) as S1Answers;
}
