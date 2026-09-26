import { JEV_DIRECT_URL } from '../config';
import { settings } from '../settings';
import { chunk } from '../util';
import { proxy } from './proxy';

type Text = string | null;

export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, Text> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'noul'; instructions: string; criteria?: { true?: Text; false?: Text } };

export type JevAnswer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities?: Record<string, number>; confidence: number }
  | { type: 'noul'; noul: number };

export type JevQuestions = Record<string, JevQuestion>;
export type JevAnswers = Record<string, JevAnswer | undefined>;

export const hasJevAccess = (): boolean => !!settings.tsKey || proxy.hasJevKey;

function endpoint(): string {
  if (settings.jevEndpoint && settings.jevEndpoint !== 'auto') return settings.jevEndpoint;
  return proxy.available ? '/api/jev' : JEV_DIRECT_URL;
}

export async function systemOne(state: unknown, questions: JevQuestions): Promise<JevAnswers> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (settings.tsKey) headers.Authorization = `Bearer ${settings.tsKey}`;
  let r: Response;
  try {
    r = await fetch(endpoint(), { method: 'POST', headers, body: JSON.stringify({ model: settings.jevModel, state, questions }) });
  } catch {
    throw new Error(proxy.available ? 'Could not reach Jev through the local proxy' : 'Browser could not reach Jev directly (CORS). Open the page from jev_proxy.py.');
  }
  if (!r.ok) throw new Error(`Jev ${r.status}: ${(await r.text()).slice(0, 180)}`);
  const data = (await r.json()) as { answers?: JevAnswers };
  return data.answers ?? {};
}

export async function systemOneBatched(state: unknown, questions: JevQuestions, size = 40): Promise<JevAnswers> {
  const parts = chunk(Object.entries(questions), size);
  const results = await Promise.all(parts.map(part => systemOne(state, Object.fromEntries(part))));
  return Object.assign({}, ...results) as JevAnswers;
}
