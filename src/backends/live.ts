import { normalizeDistribution, normalizeQuestions, type RawQuestion } from '../analysis/questions';
import {
  AXES,
  DEGREE_LEVELS,
  QUESTIONS_SCHEMA,
  QUESTIONS_SYSTEM,
  STEP_SCHEMA,
  STEP_SYSTEM,
  SWAP_KINDS,
  SWAP_SCHEMA,
  SWAP_SYSTEM,
  TAG_SCHEMA,
  TAG_SYSTEM,
  VALENCE_LEVELS,
  WORD_KIND_CRITERIA
} from '../prompts';
import { chatJSON, hasLlmAccess } from '../services/openrouter';
import { primaryModel, S1_MODELS, systemOne, systemOneBatched, type S1Answer, type S1Questions } from '../services/systemone';
import { QUESTION_FALLBACK_LLMS } from '../config';
import { DESIGN_SCHEMA, DESIGN_SYSTEM, ITEMS_SCHEMA, ITEMS_SYSTEM } from '../dataset/prompts';
import { normalizeDesign, normalizeItems, type RawDesign, type RawItems } from '../dataset/normalize';
import { settings } from '../settings';
import type { Backend, QuestionSpec, S1Id, StepResult, SwapKind, SwapOption, WordKind, WordRef, WordTag } from '../types';
import { errorMessage, num } from '../util';

const key = (index: number) => `w${index}`;

const levelScore = (a: S1Answer | undefined, levels: string[]): number | null => {
  if (!a) return null;
  if (a.type === 'score') return a.score;
  if (a.type !== 'choice') return null;
  let s = 0;
  let total = 0;
  levels.forEach((l, i) => {
    const p = a.probabilities?.[l] ?? 0;
    s += i * p;
    total += p;
  });
  return total > 0 ? s / total : null;
};

const levelCriteria = (levels: string[]) => Object.fromEntries(levels.map(l => [l, null]));

async function tagWithS1(model: S1Id, sentence: string, words: WordRef[]): Promise<WordTag[]> {
  const state = { sentence, words: Object.fromEntries(words.map(w => [key(w.index), w.text])) };
  const kindQuestions: S1Questions = {};
  for (const w of words) {
    kindQuestions[key(w.index)] = {
      type: 'choice',
      instructions: `Look at the word \`words.${key(w.index)}\` exactly as it is used in \`sentence\`. Could a writer dial it up or down on a scale by swapping in a different word, without changing what the sentence is about?`,
      criteria: WORD_KIND_CRITERIA
    };
  }
  const kinds = await systemOneBatched(model, state, kindQuestions);
  const flagged: { word: WordRef; kind: WordKind; confidence: number }[] = [];
  for (const word of words) {
    const a = kinds[key(word.index)];
    if (a?.type !== 'choice' || a.choice === 'fixed') continue;
    const p = a.probabilities ?? {};
    if ((p[a.choice] ?? 0) < 0.45) continue;
    flagged.push({ word, kind: a.choice as WordKind, confidence: 1 - (p.fixed ?? 0) });
  }
  if (!flagged.length) return [];
  const scoreQuestions: S1Questions = {};
  for (const { word, kind } of flagged) {
    scoreQuestions[key(word.index)] =
      kind === 'degree'
        ? { type: 'choice', instructions: `How strong a degree does \`words.${key(word.index)}\` express as used in \`sentence\`?`, criteria: levelCriteria(DEGREE_LEVELS) }
        : { type: 'choice', instructions: `How negative or positive does \`words.${key(word.index)}\` read as used in \`sentence\`?`, criteria: levelCriteria(VALENCE_LEVELS) };
  }
  const scores = await systemOneBatched(model, state, scoreQuestions);
  return flagged.map(({ word, kind, confidence }) => {
    const s = levelScore(scores[key(word.index)], kind === 'degree' ? DEGREE_LEVELS : VALENCE_LEVELS);
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

const criteriaOf = (spec: QuestionSpec) => Object.fromEntries(spec.options.map(o => [o.label, o.description || null]));

function distributionOf(spec: QuestionSpec, answer: S1Answer | undefined) {
  const probs = answer?.type === 'choice' ? answer.probabilities : answer?.type === 'score' ? answer.probabilities : undefined;
  return normalizeDistribution(spec, probs);
}

interface SwapJSON {
  alternatives?: { text?: string; kind?: string }[];
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
    const model = primaryModel();
    try {
      return { tags: await tagWithS1(model, sentence, words), source: S1_MODELS[model].label };
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

  async classify(sentence, specs, model) {
    const questions: S1Questions = {};
    for (const spec of specs) {
      questions[spec.id] = { type: 'choice', instructions: `${spec.question} Answer about \`sentence\`.`, criteria: criteriaOf(spec) };
    }
    const answers = await systemOne(model, { sentence }, questions);
    return Object.fromEntries(specs.map(spec => [spec.id, distributionOf(spec, answers[spec.id])]));
  },

  async classifyMany(sentences, specs, model) {
    const state = { sentences: Object.fromEntries(sentences.map((s, i) => [`v${i}`, s])) };
    const questions: S1Questions = {};
    sentences.forEach((_, i) => {
      for (const spec of specs) {
        questions[`v${i}_${spec.id}`] = {
          type: 'choice',
          instructions: `${spec.question} Answer about \`sentences.v${i}\` on its own; the other sentences are unrelated variants.`,
          criteria: criteriaOf(spec)
        };
      }
    });
    const answers = await systemOneBatched(model, state, questions);
    return sentences.map((_, i) => Object.fromEntries(specs.map(spec => [spec.id, distributionOf(spec, answers[`v${i}_${spec.id}`])])));
  },

  async proposeSwaps(req) {
    const questions = req.specs.map(s => ({ name: s.name, question: s.question, options: s.options.map(o => o.label) }));
    const res = await chatJSON<SwapJSON>(
      [
        { role: 'system', content: SWAP_SYSTEM },
        { role: 'user', content: JSON.stringify({ sentence: req.marked, span: req.word, classifier_questions: questions }, null, 1) }
      ],
      SWAP_SCHEMA,
      { maxTokens: 2500, temperature: 0.8 }
    );
    const seen = new Set([req.word.toLowerCase()]);
    const out: SwapOption[] = [];
    for (const alt of res.alternatives ?? []) {
      const text = String(alt.text ?? '').trim().replace(/^["'“”]+|["'“”.,;:!?]+$/g, '');
      if (!text || seen.has(text.toLowerCase()) || text.split(/\s+/).length > 5) continue;
      seen.add(text.toLowerCase());
      const kind = (SWAP_KINDS as readonly string[]).includes(alt.kind ?? '') ? (alt.kind as SwapKind) : 'synonym';
      out.push({ text, kind });
    }
    if (!out.length) throw new Error('The model did not propose any usable alternatives');
    return out;
  },

  async designDataset(description, questionCount) {
    const res = await chatJSON<RawDesign>(
      [
        { role: 'system', content: DESIGN_SYSTEM.replace('{Q}', String(questionCount)) },
        { role: 'user', content: `Dataset description:\n${description}\n\nDesign exactly ${questionCount} questions.` }
      ],
      DESIGN_SCHEMA,
      { model: settings.questionModel, fallbacks: QUESTION_FALLBACK_LLMS, reasoning: 'medium', maxTokens: 5000, temperature: 0.5 }
    );
    return normalizeDesign(res, questionCount);
  },

  async writeDatasetItems(design, count, focus) {
    const payload = {
      dataset: { title: design.title, summary: design.summary },
      setting: design.setting,
      questions: design.specs.map(s => ({ name: s.name, question: s.question, kind: s.kind ?? 'category', options: s.options.map(o => ({ label: o.label, description: o.description })) })),
      count,
      ...(focus?.length
        ? {
            focus: {
              instruction: 'These options currently have no example. Write only messages whose intended labels include them; each listed option must be the intended answer for at least one message.',
              options: focus
            }
          }
        : {})
    };
    const res = await chatJSON<RawItems>(
      [
        { role: 'system', content: ITEMS_SYSTEM },
        { role: 'user', content: `Write ${count} messages.\n\n${JSON.stringify(payload, null, 1)}` }
      ],
      ITEMS_SCHEMA,
      { model: settings.questionModel, fallbacks: QUESTION_FALLBACK_LLMS, reasoning: 'medium', maxTokens: 12000, temperature: 0.9 }
    );
    const items = normalizeItems(res, design.specs);
    if (!items.length) throw new Error('The model did not write any usable messages');
    return items;
  }
};
