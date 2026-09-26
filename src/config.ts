export const JEV_DIRECT_URL = 'https://api.typesafe.ai/v1/systemone';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const DEFAULT_LLM = 'openai/gpt-oss-120b:nitro';
export const FALLBACK_LLMS = ['openai/gpt-oss-20b:nitro', 'meta-llama/llama-3.3-70b-instruct:nitro'];
export const LLM_CHOICES = [DEFAULT_LLM, ...FALLBACK_LLMS, 'inception/mercury-2.5'];
export const DEFAULT_QUESTION_LLM = 'google/gemini-3.8-flash';
export const QUESTION_FALLBACK_LLMS = ['anthropic/claude-opus-5.5', DEFAULT_LLM];
export const QUESTION_LLM_CHOICES = [DEFAULT_QUESTION_LLM, 'anthropic/claude-opus-5.5', DEFAULT_LLM];
export const DEFAULT_JEV = 'jev-latest';

export const SEED_SENTENCE = 'The food was good, but the service was pretty slow and our waiter seemed annoyed.';

export const MAX_STEPS = 8;
export const WHEEL_STEP_PX = 55;
export const WHEEL_STICKY_MS = 450;
export const RECLASSIFY_DEBOUNCE_MS = 350;
export const LLM_MAX_CONCURRENT = 3;
export const QUESTION_COUNT = 3;
