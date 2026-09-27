import { normalizeDistribution, normalizeQuestions } from '../analysis/questions';
import type { Backend, WordTag } from '../types';
import { sleep } from '../util';
import { mockDesign, mockItems } from './mockDataset';

const EVALUATIVE_SCALES = [
  ['abysmal', 'terrible', 'bad', 'poor', 'meh', 'okay', 'fine', 'decent', 'good', 'great', 'excellent', 'amazing', 'phenomenal'],
  ['glacial', 'painfully slow', 'slow', 'a bit slow', 'unhurried', 'prompt', 'quick', 'lightning-fast'],
  ['furious', 'irritated', 'annoyed', 'a little impatient', 'neutral', 'calm', 'cheerful', 'delighted'],
  ['hate', 'dislike', 'tolerate', 'like', 'enjoy', 'love', 'adore'],
  ['boring', 'dull', 'fine', 'interesting', 'fascinating', 'riveting']
];
const MOCK_SWAPS = ['need', 'demand', 'would like', 'would appreciate', 'wish', 'require', 'hope', 'expect', 'insist', 'prefer'];
const DEGREE_SCALE = ['barely', 'slightly', 'somewhat', 'fairly', 'pretty', 'quite', 'very', 'extremely', 'incredibly'];

function locate(word: string): { scale: string[]; i: number; degree: boolean } | null {
  const w = word.toLowerCase();
  const d = DEGREE_SCALE.indexOf(w);
  if (d >= 0) return { scale: DEGREE_SCALE, i: d, degree: true };
  for (const scale of EVALUATIVE_SCALES) {
    const i = scale.indexOf(w);
    if (i >= 0) return { scale, i, degree: false };
  }
  return null;
}

function position(scale: string[], i: number, degree: boolean) {
  const x = i / (scale.length - 1);
  return degree ? { valence: 0, intensity: x } : { valence: x * 2 - 1, intensity: Math.abs(x * 2 - 1) };
}

function sentenceValence(sentence: string): number {
  const words = sentence.toLowerCase().match(/[a-z-]+(?: slow| impatient)?/g) ?? [];
  let sum = 0;
  let n = 0;
  let boost = 1;
  for (const w of words) {
    const hit = locate(w) ?? locate(w.split(' ')[0]);
    if (!hit) continue;
    const p = position(hit.scale, hit.i, hit.degree);
    if (hit.degree) boost = 0.5 + p.intensity;
    else {
      sum += p.valence * boost;
      n += 1;
      boost = 1;
    }
  }
  return n ? Math.max(-1, Math.min(1, sum / n)) : 0;
}

export const mockBackend: Backend = {
  id: 'mock',

  async tagWords(_sentence, words) {
    await sleep(400);
    const tags: WordTag[] = [];
    for (const w of words) {
      const hit = locate(w.text);
      if (hit) tags.push({ index: w.index, kind: hit.degree ? 'degree' : 'evaluative', confidence: 0.9, ...position(hit.scale, hit.i, hit.degree) });
    }
    return { tags, source: 'demo lexicon' };
  },

  async nextRung(req) {
    await sleep(160 + Math.random() * 200);
    const hit = locate(req.current);
    const next = hit?.scale[hit.i + req.dir];
    if (!hit || !next) return { replacement: '', valence: 0, intensity: 0, atLimit: true };
    return { replacement: next, ...position(hit.scale, hit.i + req.dir, hit.degree), atLimit: false };
  },

  async proposeQuestions() {
    await sleep(700);
    return normalizeQuestions([
      {
        name: 'Sentiment',
        question: 'What is the overall sentiment of the sentence?',
        options: ['very positive', 'positive', 'neutral', 'negative', 'very negative'].map(label => ({ label, description: label }))
      },
      {
        name: 'Tone',
        question: 'How would you describe the tone?',
        options: ['warm', 'mild', 'neutral', 'aggressive'].map(label => ({ label, description: label }))
      },
      {
        name: 'Would Return',
        question: 'How likely is the speaker to come back?',
        options: ['definitely', 'probably', 'unsure', 'unlikely', 'never'].map(label => ({ label, description: label }))
      }
    ]);
  },

  async designDataset(_description, questionCount) {
    await sleep(900);
    return mockDesign(questionCount);
  },

  async writeDatasetItems(design, count) {
    await sleep(1200);
    return mockItems(design, count);
  },

  async classifyMany(sentences, specs, model) {
    return Promise.all(sentences.map(s => this.classify(s, specs, model)));
  },

  async proposeSwaps(req) {
    await sleep(500);
    const hit = locate(req.word);
    const pool = hit ? hit.scale.filter(w => w !== req.word.toLowerCase()) : MOCK_SWAPS;
    return pool.slice(0, 10).map((text, i) => ({ text, kind: (['synonym', 'stronger', 'weaker', 'opposite', 'formal', 'casual', 'shift'] as const)[i % 7] }));
  },

  async classify(sentence, specs, model) {
    await sleep(250 + Math.random() * 200);
    const raw = sentenceValence(sentence);
    const v = model === 'kev' ? Math.max(-1, Math.min(1, raw * 0.6 - 0.15)) : raw;
    const width = model === 'kev' ? 1.6 : 0.9;
    return Object.fromEntries(
      specs.map(spec => {
        const n = spec.options.length;
        const center = ((1 - v) / 2) * (n - 1);
        const raw = Object.fromEntries(spec.options.map((o, i) => [o.label, Math.exp(-((i - center) ** 2) / width)]));
        return [spec.id, normalizeDistribution(spec, raw)];
      })
    );
  }
};
