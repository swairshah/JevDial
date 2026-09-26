import type { Rung, WordKind } from '../types';

export interface Token {
  readonly i: number;
  orig: string;
  readonly word: boolean;
  text: string;
  kind: WordKind | null;
  confidence: number;
  ladder: Map<number, Rung>;
  level: number;
  limit: { up: number | null; down: number | null };
  busy: boolean;
  queued: 0 | 1 | -1;
  coolUntil: number;
  el: HTMLElement | null;
}

const PIECES = /[\p{L}\p{M}\p{N}’'\-]+|\s+|[^\s\p{L}\p{M}\p{N}]+/gu;

export function tokenize(sentence: string): Token[] {
  return (sentence.match(PIECES) ?? []).map((text, i) => ({
    i,
    orig: text,
    word: /^\p{L}/u.test(text),
    text,
    kind: null,
    confidence: 0,
    ladder: new Map(),
    level: 0,
    limit: { up: null, down: null },
    busy: false,
    queued: 0,
    coolUntil: 0,
    el: null
  }));
}

export const rungOf = (t: Token, level = t.level): Rung => t.ladder.get(level) ?? { text: t.text, valence: 0, intensity: 0.5 };

export const pitchOf = (t: Token, r: Rung = rungOf(t)): number => (t.kind === 'degree' ? r.intensity * 2 - 1 : r.valence);
