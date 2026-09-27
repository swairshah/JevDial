import { FALLBACK_LLMS, LLM_MAX_CONCURRENT, OPENROUTER_URL } from '../config';
import { settings } from '../settings';
import { sleep, tryJSON } from '../util';
import { proxy } from './proxy';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  fallbacks?: string[];
  reasoning?: 'low' | 'medium' | 'high';
}

interface ChatResponse {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | { text?: string }[] | null; reasoning?: string | null };
  }[];
}

export const hasLlmAccess = (): boolean => !!settings.orKey || proxy.hasLlmKey;

let active = 0;
const waiting: (() => void)[] = [];

async function limited<T>(task: () => Promise<T>): Promise<T> {
  while (active >= LLM_MAX_CONCURRENT) await new Promise<void>(resolve => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

async function post(body: object): Promise<Response> {
  const url = settings.orKey ? OPENROUTER_URL : '/api/llm';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.orKey) headers.Authorization = `Bearer ${settings.orKey}`;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const retryable = r.status === 429 || r.status >= 500;
    if (retryable && attempt < 2) {
      await sleep(400 * 2 ** attempt + Math.random() * 200);
      continue;
    }
    return r;
  }
}

function contentOf(response: ChatResponse): { content: string; reasoning: string; finish: string } {
  const choice = response.choices?.[0];
  const msg = choice?.message;
  const raw = msg?.content;
  const content = Array.isArray(raw) ? raw.map(p => p.text ?? '').join('') : raw ?? '';
  return { content, reasoning: msg?.reasoning ?? '', finish: choice?.finish_reason ?? '?' };
}

export function chatJSON<T>(messages: ChatMessage[], schema: object, options: ChatOptions = {}): Promise<T> {
  return limited(async () => {
    if (!hasLlmAccess()) throw new Error('Add OPENROUTER_API_KEY to .env or paste it in Settings');
    const primary = options.model ?? settings.llmModel;
    const models = [primary, ...(options.fallbacks ?? FALLBACK_LLMS).filter(m => m !== primary)].slice(0, 3);
    const reasoning = { effort: options.reasoning ?? 'low' };
    const formats: object[] = [
      { reasoning, response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } } },
      { reasoning, response_format: { type: 'json_object' } },
      {}
    ];
    let maxTokens = options.maxTokens ?? 1500;
    let lastError = '';
    for (const format of formats) {
      const r = await post({ model: models[0], models, messages, temperature: options.temperature ?? 0.4, max_tokens: maxTokens, ...format });
      if (r.status === 400) {
        lastError = await r.text();
        continue;
      }
      if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 180)}`);
      const data = (await r.json()) as ChatResponse;
      const { content, reasoning, finish } = contentOf(data);
      const parsed = tryJSON<T>(content) ?? tryJSON<T>(reasoning);
      if (parsed) return parsed;
      console.warn('Word Dial: unparseable LLM response', data);
      lastError = `finish_reason=${finish}, content=${JSON.stringify(content.slice(0, 80))}`;
      if (finish === 'length') maxTokens = Math.min(maxTokens * 2, 16000);
    }
    throw new Error(`Model did not return JSON (${lastError.slice(0, 200)})`);
  });
}
