import { normalizeDistribution, normalizeQuestions, type RawQuestion } from '../analysis/questions';
import {
  AXES,
  DEGREE_LEVELS,
  QUESTIONS_SCHEMA,
  QUESTIONS_SYSTEM,
  STEP_SCHEMA,
  STEP_SYSTEM,
  TAG_SCHEMA,
  TAG_SYSTEM,
  VALENCE_LEVELS,
  WORD_KIND_CRITERIA
} from '../prompts';
import { chatJSON, hasLlmAccess } from '../services/openrouter';
import { systemOne, systemOneBatched, type JevQuestions } from '../services/jev';
import { QUESTION_FALLBACK_LLMS } from '../config';
import { settings } from '../settings';
import type { Backend, StepResult, WordKind, WordRef, WordTag } from '../types';
import { errorMessage, num } from '../util';

const key = (index: number) => `w${index}`;

async function tagWithJev(sentence: string, words: WordRef[]): Promise<WordTag[]> {
  const state = { sentence, words: Object.fromEntries(words.map(w => [key(w.index), w.text])) };
  const kindQuestions: JevQuestions = {};
  for (const w of words) {
    kindQuestions[key(w.index)] = {
      type: 'choice',
      instructions: `Look at the word \`words.${key(w.index)}\` exactly as it is used in \`sentence\`. Could a writer dial it up or down on a scale by swapping in a different word, without changing what the sentence is about?`,
      criteria: WORD_KIND_CRITERIA
    };
  }
  const kinds = await systemOneBatched(state, kindQuestions);
  const flagged: { word: WordRef; kind: WordKind; confidence: number }[] = [];
  for (const word of words) {
    const a = kinds[key(word.index)];
    if (a?.type !== 'choice' || a.choice === 'fixed') continue;
    const p = a.probabilities ?? {};
    if ((p[a.choice] ?? 0) < 0.45) continue;
    flagged.push({ word, kind: a.choice as WordKind, confidence: 1 - (p.fixed ?? 0) });
  }
  if (!flagged.length) return [];
  const scoreQuestions: JevQuestions = {};
  for (const { word, kind } of flagged) {
    scoreQuestions[key(word.index)] =
      kind === 'degree'
        ? { type: 'score', instructions: `How strong a degree does \`words.${key(word.index)}\` express as used in \`sentence\`?`, criteria: DEGREE_LEVELS }
        : { type: 'score', instructions: `How negative or positive does \`words.${key(word.index)}\` read as used in \`sentence\`?`, criteria: VALENCE_LEVELS };
  }
  const scores = await systemOneBatched(state, scoreQuestions);
  return flagged.map(({ word, kind, confidence }) => {
    const a = scores[key(word.index)];
    const s = a?.type === 'score' ? a.score : null;
    if (kind === 'degree') return { index: word.index, kind, confidence, valence: 0, intensity: s === null ? 0.5 : s / 3 };
    return { index: word.index, kind, confidence, valence: s === null ? 0 : (s - 2) / 2, intensity: s === null ? 0.5 : Math.abs(s - 2) / 2 };
  });
}

interface TagJSON {
  items?: { index?: number; kind?: string; valence?: number; intensity?: number }[];
}

async function tagWithLlm(sentence: string, words: WordRef[]): Promise<WordTag[]> {
  const res = await chatJSON<TagJSON>(
    [
      { role: 'system', content: TAG_SYSTEM },
      { role: 'user', content: JSON.stringify({ sentence, words: words.map(w => ({ index: w.index, word: w.text })) }) }
    ],
    TAG_SCHEMA,
    { maxTokens: 3000 }
  );
  const valid = new Set(words.map(w => w.index));
  return (res.items ?? [])
    .filter(it => valid.has(Number(it.index)) && (it.kind === 'evaluative' || it.kind === 'degree'))
    .map(it => ({
      index: Number(it.index),
      kind: it.kind as WordKind,
      confidence: 0.8,
      valence: num(it.valence, -1, 1, 0),
      intensity: num(it.intensity, 0, 1, 0.5)
    }));
}

interface StepJSON {
  replacement?: string;
  valence?: number;
  intensity?: number;
  at_limit?: boolean;
}

export const liveBackend: Backend = {
  id: 'live',

  async tagWords(sentence, words) {
    try {
      return { tags: await tagWithJev(sentence, words), source: 'Jev' };
    } catch (err) {
      if (!hasLlmAccess()) throw err;
      const tags = await tagWithLlm(sentence, words);
      return { tags, source: `${settings.llmModel} (fallback)`, warning: `${errorMessage(err)} Used the LLM to find dial words instead.` };
    }
  },

  async nextRung(req): Promise<StepResult> {
    const axis = AXES[req.kind];
    const user = JSON.stringify(
      {
        sentence: req.marked,
        current: req.current,
        ladder_low_to_high: req.ladder,
        axis: req.kind === 'degree' ? 'degree' : 'valence',
        direction: req.dir > 0 ? 'UP' : 'DOWN',
        meaning_of_direction: req.dir > 0 ? axis.up : axis.down,
        task: `Give the rung directly ${req.dir > 0 ? 'above' : 'below'} "${req.current}".`
      },
      null,
      1
    );
    const res = await chatJSON<StepJSON>(
      [
        { role: 'system', content: STEP_SYSTEM },
        { role: 'user', content: user }
      ],
      STEP_SCHEMA
    );
    return {
      replacement: String(res.replacement ?? '').trim(),
      valence: num(res.valence, -1, 1, 0),
      intensity: num(res.intensity, 0, 1, 0.5),
      atLimit: !!res.at_limit
    };
  },

  async proposeQuestions(sentence) {
    const res = await chatJSON<{ questions?: RawQuestion[] }>(
      [
        { role: 'system', content: QUESTIONS_SYSTEM },
        { role: 'user', content: sentence }
      ],
      QUESTIONS_SCHEMA,
      { maxTokens: 4000, temperature: 0.8, model: settings.questionModel, fallbacks: QUESTION_FALLBACK_LLMS, reasoning: 'medium' }
    );
    return normalizeQuestions(res.questions);
  },

  async classify(sentence, specs) {
    const questions: JevQuestions = {};
    for (const spec of specs) {
      questions[spec.id] = {
        type: 'choice',
        instructions: `${spec.question} Answer about \`sentence\`.`,
        criteria: Object.fromEntries(spec.options.map(o => [o.label, o.description || null]))
      };
    }
    const answers = await systemOne({ sentence }, questions);
    return Object.fromEntries(
      specs.map(spec => {
        const a = answers[spec.id];
        return [spec.id, normalizeDistribution(spec, a?.type === 'choice' ? a.probabilities : a?.type === 'score' ? a.probabilities : undefined)];
      })
    );
  }
};
