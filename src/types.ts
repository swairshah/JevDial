export type WordKind = 'evaluative' | 'degree';
export type Direction = 1 | -1;

export interface Rung {
  text: string;
  valence: number;
  intensity: number;
}

export interface WordRef {
  index: number;
  text: string;
}

export interface WordTag {
  index: number;
  kind: WordKind;
  confidence: number;
  valence: number;
  intensity: number;
}

export interface TagResult {
  tags: WordTag[];
  source: string;
  warning?: string;
}

export interface StepRequest {
  marked: string;
  current: string;
  ladder: string[];
  kind: WordKind;
  dir: Direction;
}

export interface StepResult {
  replacement: string;
  valence: number;
  intensity: number;
  atLimit: boolean;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionSpec {
  id: string;
  name: string;
  question: string;
  options: QuestionOption[];
}

export type Distribution = Record<string, number>;
export type Classification = Record<string, Distribution>;

export interface Backend {
  readonly id: 'live' | 'mock';
  tagWords(sentence: string, words: WordRef[]): Promise<TagResult>;
  nextRung(request: StepRequest): Promise<StepResult>;
  proposeQuestions(sentence: string): Promise<QuestionSpec[]>;
  classify(sentence: string, specs: QuestionSpec[]): Promise<Classification>;
}
