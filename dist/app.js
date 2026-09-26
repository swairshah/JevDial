// src/config.ts
var JEV_DIRECT_URL = "https://api.typesafe.ai/v1/systemone";
var OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
var DEFAULT_LLM = "openai/gpt-oss-120b:nitro";
var FALLBACK_LLMS = ["openai/gpt-oss-20b:nitro", "meta-llama/llama-3.3-70b-instruct:nitro"];
var LLM_CHOICES = [DEFAULT_LLM, ...FALLBACK_LLMS, "inception/mercury-2.5"];
var DEFAULT_QUESTION_LLM = "google/gemini-3.8-flash";
var QUESTION_FALLBACK_LLMS = ["anthropic/claude-opus-5.5", DEFAULT_LLM];
var QUESTION_LLM_CHOICES = [DEFAULT_QUESTION_LLM, "anthropic/claude-opus-5.5", DEFAULT_LLM];
var DEFAULT_JEV = "jev-latest";
var SEED_SENTENCE = "The food was good, but the service was pretty slow and our waiter seemed annoyed.";
var MAX_STEPS = 8;
var WHEEL_STEP_PX = 55;
var WHEEL_STICKY_MS = 450;
var RECLASSIFY_DEBOUNCE_MS = 350;
var LLM_MAX_CONCURRENT = 3;
var QUESTION_COUNT = 3;

// src/util.ts
var clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
var num = (x, lo, hi, fallback) => {
  const n = Number(x);
  return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
};
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var uid = () => Math.random().toString(36).slice(2, 10);
var errorMessage = (err) => err instanceof Error ? err.message : String(err);
function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
function debounce(fn, ms) {
  let timer2;
  const run = ((...args) => {
    clearTimeout(timer2);
    timer2 = setTimeout(() => fn(...args), ms);
  });
  run.cancel = () => clearTimeout(timer2);
  return run;
}
function tryJSON(raw) {
  if (!raw) return null;
  const s = raw.replace(/```(?:json)?/gi, "").trim();
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object") return v;
  } catch {
  }
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try {
    return JSON.parse(s.slice(i, j + 1));
  } catch {
    return null;
  }
}
function replay(el2, cls, ms = 420) {
  el2.classList.remove(cls);
  void el2.offsetWidth;
  el2.classList.add(cls);
  setTimeout(() => el2.classList.remove(cls), ms);
}
function h(tag, props = {}, ...children) {
  const el2 = document.createElement(tag);
  if (props.class) el2.className = props.class;
  if (props.text !== void 0) el2.textContent = props.text;
  if (props.html !== void 0) el2.innerHTML = props.html;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el2.setAttribute(k, v);
  for (const [k, v] of Object.entries(props.style ?? {})) el2.style.setProperty(k, v);
  for (const [k, fn] of Object.entries(props.on ?? {})) el2.addEventListener(k, fn);
  for (const c of children) if (c !== null && c !== void 0 && c !== false) el2.append(c);
  return el2;
}
var Emitter = class {
  listeners = /* @__PURE__ */ new Map();
  on(event, fn) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, set = /* @__PURE__ */ new Set());
    set.add(fn);
    return () => set.delete(fn);
  }
  emit(event, payload) {
    for (const fn of this.listeners.get(event) ?? []) fn(payload);
  }
  clear() {
    this.listeners.clear();
  }
};

// src/settings.ts
var PREFS_VERSION = 3;
var PREFIX = "worddial:";
var storage = {
  get(key2) {
    try {
      return localStorage.getItem(PREFIX + key2);
    } catch {
      return null;
    }
  },
  set(key2, value) {
    try {
      if (value === null) localStorage.removeItem(PREFIX + key2);
      else localStorage.setItem(PREFIX + key2, value);
    } catch {
    }
  },
  getJSON(key2, fallback) {
    const raw = this.get(key2);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  setJSON(key2, value) {
    this.set(key2, JSON.stringify(value));
  }
};
var settings = {
  orKey: "",
  tsKey: "",
  llmModel: DEFAULT_LLM,
  questionModel: DEFAULT_QUESTION_LLM,
  jevModel: DEFAULT_JEV,
  jevEndpoint: "auto",
  haptics: true,
  sound: true,
  invertScroll: false,
  rememberKeys: false,
  mock: false,
  theme: "system"
};
var settingsEvents = new Emitter();
function loadSettings() {
  const prefs = storage.getJSON("prefs", {});
  const { version, invert, remember, ...rest } = prefs;
  Object.assign(settings, rest);
  if (invert !== void 0) settings.invertScroll = invert;
  if (remember !== void 0) settings.rememberKeys = remember;
  if ((version ?? 0) < PREFS_VERSION) settings.llmModel = DEFAULT_LLM;
  if (settings.rememberKeys) {
    settings.orKey = storage.get("orKey") ?? "";
    settings.tsKey = storage.get("tsKey") ?? "";
  }
  const query = new URLSearchParams(location.search);
  if (query.has("mock")) settings.mock = true;
  persist();
}
function persist() {
  const { orKey, tsKey, ...prefs } = settings;
  storage.setJSON("prefs", { ...prefs, version: PREFS_VERSION });
  storage.set("orKey", settings.rememberKeys && orKey ? orKey : null);
  storage.set("tsKey", settings.rememberKeys && tsKey ? tsKey : null);
}
function updateSettings(patch) {
  const previous = { ...settings };
  Object.assign(settings, patch);
  persist();
  settingsEvents.emit("change", { previous });
}

// src/analysis/questions.ts
var clean = (v) => typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
function normalizeQuestions(raw) {
  const specs = [];
  for (const q of raw ?? []) {
    const name = clean(q.name);
    const seen = /* @__PURE__ */ new Set();
    const options = (q.options ?? []).map((o) => ({ label: clean(o.label).toLowerCase(), description: clean(o.description) })).filter((o) => o.label && !seen.has(o.label) && seen.add(o.label)).slice(0, 8);
    if (!name || options.length < 2) continue;
    specs.push({ id: `q${specs.length + 1}`, name, question: clean(q.question) || name, options });
    if (specs.length === QUESTION_COUNT) break;
  }
  if (!specs.length) throw new Error("The model did not propose any usable questions");
  return specs;
}
function normalizeDistribution(spec, probabilities) {
  const out = {};
  let total = 0;
  for (const { label } of spec.options) {
    const p = Math.max(0, Number(probabilities?.[label]) || 0);
    out[label] = p;
    total += p;
  }
  for (const label of Object.keys(out)) out[label] = total > 0 ? out[label] / total : 1 / spec.options.length;
  return out;
}
function topLabel(dist) {
  let best = "";
  let bestP = -1;
  for (const [label, p] of Object.entries(dist)) if (p > bestP) [best, bestP] = [label, p];
  return best;
}

// src/prompts.ts
var STEP_SYSTEM = `You are a lexical dial. You receive a sentence in which exactly one span is wrapped in \u27E6 \u27E7, the ladder of rungs already discovered for that span, an axis and a direction.
Return the NEXT rung: a replacement for the span only, one small but clearly perceptible step from the CURRENT rung in the requested direction.
Rules:
- Never repeat any rung already on the ladder, and never skip past a rung that is already there.
- The replacement must drop into the sentence exactly where the span is, with nothing else changed, and read naturally. Keep the grammatical role and inflection.
- 1 to 4 words, no punctuation, no quotes.
- For the valence axis keep going through neutral into the opposite polarity (e.g. terrible \u2192 bad \u2192 meh \u2192 okay \u2192 good \u2192 great \u2192 amazing \u2192 phenomenal).
- If no natural further step exists, set "at_limit": true.
Reply with JSON only: {"replacement": string, "valence": number in [-1,1] for how negative/positive the span reads in this sentence, "intensity": number in [0,1] for how strong it is, "at_limit": boolean}`;
var STEP_SCHEMA = {
  type: "object",
  properties: {
    replacement: { type: "string" },
    valence: { type: "number" },
    intensity: { type: "number" },
    at_limit: { type: "boolean" }
  },
  required: ["replacement", "valence", "intensity", "at_limit"],
  additionalProperties: false
};
var AXES = {
  degree: {
    up: "stronger degree (slightly \u2192 somewhat \u2192 very \u2192 extremely)",
    down: "weaker degree (extremely \u2192 very \u2192 somewhat \u2192 slightly \u2192 barely)"
  },
  evaluative: {
    up: "more positive: praise gets stronger or criticism softens",
    down: "more negative: criticism gets harsher or praise weakens"
  }
};
var TAG_SYSTEM = `You tag words that can be dialed along a scale. "evaluative": carries a judgment, feeling or quality with stronger/weaker or more positive/negative alternatives. "degree": only sets strength (very, slightly). Do not return any other words.
Reply with JSON only: {"items":[{"index":int,"kind":"evaluative"|"degree","valence":number -1..1,"intensity":number 0..1}]}`;
var TAG_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          kind: { type: "string", enum: ["evaluative", "degree"] },
          valence: { type: "number" },
          intensity: { type: "number" }
        },
        required: ["index", "kind", "valence", "intensity"],
        additionalProperties: false
      }
    }
  },
  required: ["items"],
  additionalProperties: false
};
var QUESTIONS_SYSTEM = `You design classification questions for a single sentence. Each question has a small set of mutually exclusive options, and a classifier will later answer it for this sentence and for reworded versions of it.

Start by reading the sentence the way a real recipient would: who is probably writing it, to whom, in what setting, and what they want. Then brainstorm at least 8 candidate questions across different families before choosing:

- What kind of message it is: speech act (request, complaint, praise, question, instruction, report), request type, complaint type.
- What it is about: domain or department it would be routed to, topic, product area, affected party.
- How it is said: sentiment, tone, politeness, formality, emotional temperature, confidence, sarcasm.
- What happens next: urgency, expected response, escalation risk, likelihood of churn or of a follow-up.
- Who is involved: who is credited or blamed, target audience, speaker's role or relationship.

Examples of the range we want:
- "I want that UI button fixed. and the color of the page changed" \u2192 Complaint Type [technical, design, business, billing]; Request Type [bug fix, change request, feature request, question]; Politeness [rude, blunt, neutral, polite].
- "The food was good, but the service was pretty slow" \u2192 Aspect Criticised [food, service, price, ambience]; Sentiment [very negative, negative, mixed, positive, very positive]; Would Return [definitely, probably, unsure, unlikely].
- "Can someone please look at the invoice from March? It's wrong again." \u2192 Department [accounting, sales, support, legal]; Frustration [calm, mildly annoyed, frustrated, angry]; Recurrence [first time, happened before, ongoing].
- "Honestly, this update is a disaster." \u2192 Target [product, company, specific person, process]; Sarcasm [sincere, possibly sarcastic, clearly sarcastic]; Escalation Risk [low, medium, high].

Choose the best 3 questions:
- At least one must be categorical and about content (what kind of message, what it is about, where it would be routed), not a scale.
- At least one must be a scale that would visibly shift if individual words were made stronger, weaker, more positive or more negative.
- Every question must be genuinely uncertain or informative for this sentence. Avoid questions whose answer is trivially fixed by the wording (like counting things), and avoid near-duplicates of each other.

For each question give:
- "name": 1 to 3 words, Title Case
- "question": one sentence, asked about the sentence
- "options": 3 to 6 mutually exclusive options that cover the realistic space. For a scale, order them from one end to the other. Each has a short lowercase "label" (1 to 3 words) and a one-line "description" that makes its boundary clear.

Reply with JSON only: {"questions":[{"name":string,"question":string,"options":[{"label":string,"description":string}]}]}`;
var QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          question: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, description: { type: "string" } },
              required: ["label", "description"],
              additionalProperties: false
            }
          }
        },
        required: ["name", "question", "options"],
        additionalProperties: false
      }
    }
  },
  required: ["questions"],
  additionalProperties: false
};
var WORD_KIND_CRITERIA = {
  evaluative: "The word carries a judgment, feeling or quality that sits on a scale, so a writer could swap it for a stronger, weaker, more positive or more negative word: good, awful, cheap, slow, tasty, love, hate, disaster, delighted, annoyed, beautiful, boring.",
  degree: "The word only sets how strongly something holds: very, pretty, slightly, extremely, barely, somewhat, totally, really, quite, a bit.",
  fixed: "Function words, names, numbers and neutral content words with no natural stronger or weaker version: the, a, of, and, but, was, seemed, apple, table, food, waiter, service, Tuesday, Paris."
};
var VALENCE_LEVELS = [
  "Strongly negative in this sentence: terrible, hate, disaster, furious",
  "Mildly negative: meh, slow, dislike, annoyed, bland",
  "Neutral or mixed",
  "Mildly positive: fine, nice, like, decent",
  "Strongly positive: amazing, love, perfect, thrilled"
];
var DEGREE_LEVELS = ["Weak: barely, slightly, a bit", "Moderate: somewhat, fairly, pretty", "Strong: very, really, quite", "Extreme: extremely, utterly, incredibly"];

// src/services/proxy.ts
var proxy = {
  available: false,
  hasJevKey: false,
  hasLlmKey: false
};
async function detectProxy() {
  if (!location.protocol.startsWith("http")) return;
  try {
    const r = await fetch("/api/jev/health", { cache: "no-store", signal: AbortSignal.timeout(900) });
    if (!r.ok) return;
    const d = await r.json();
    proxy.available = !!d.ok;
    proxy.hasJevKey = !!d.has_key;
    proxy.hasLlmKey = !!d.has_llm_key;
  } catch {
  }
}

// src/services/openrouter.ts
var hasLlmAccess = () => !!settings.orKey || proxy.hasLlmKey;
var active = 0;
var waiting = [];
async function limited(task) {
  while (active >= LLM_MAX_CONCURRENT) await new Promise((resolve) => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}
async function post(body) {
  const url = settings.orKey ? OPENROUTER_URL : "/api/llm";
  const headers = { "Content-Type": "application/json" };
  if (settings.orKey) headers.Authorization = `Bearer ${settings.orKey}`;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const retryable = r.status === 429 || r.status >= 500;
    if (retryable && attempt < 2) {
      await sleep(400 * 2 ** attempt + Math.random() * 200);
      continue;
    }
    return r;
  }
}
function contentOf(response) {
  const choice = response.choices?.[0];
  const msg = choice?.message;
  const raw = msg?.content;
  const content = Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : raw ?? "";
  return { content, reasoning: msg?.reasoning ?? "", finish: choice?.finish_reason ?? "?" };
}
function chatJSON(messages, schema, options = {}) {
  return limited(async () => {
    if (!hasLlmAccess()) throw new Error("Add OPENROUTER_API_KEY to .env or paste it in Settings");
    const primary = options.model ?? settings.llmModel;
    const models = [primary, ...(options.fallbacks ?? FALLBACK_LLMS).filter((m) => m !== primary)].slice(0, 3);
    const reasoning = { effort: options.reasoning ?? "low" };
    const formats = [
      { reasoning, response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema } } },
      { reasoning, response_format: { type: "json_object" } },
      {}
    ];
    let maxTokens = options.maxTokens ?? 1500;
    let lastError = "";
    for (const format of formats) {
      const r = await post({ model: models[0], models, messages, temperature: options.temperature ?? 0.4, max_tokens: maxTokens, ...format });
      if (r.status === 400) {
        lastError = await r.text();
        continue;
      }
      if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 180)}`);
      const data = await r.json();
      const { content, reasoning: reasoning2, finish } = contentOf(data);
      const parsed = tryJSON(content) ?? tryJSON(reasoning2);
      if (parsed) return parsed;
      console.warn("Word Dial: unparseable LLM response", data);
      lastError = `finish_reason=${finish}, content=${JSON.stringify(content.slice(0, 80))}`;
      if (finish === "length") maxTokens = Math.min(maxTokens * 2, 6e3);
    }
    throw new Error(`Model did not return JSON (${lastError.slice(0, 200)})`);
  });
}

// src/services/jev.ts
var hasJevAccess = () => !!settings.tsKey || proxy.hasJevKey;
function endpoint() {
  if (settings.jevEndpoint && settings.jevEndpoint !== "auto") return settings.jevEndpoint;
  return proxy.available ? "/api/jev" : JEV_DIRECT_URL;
}
async function systemOne(state, questions) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (settings.tsKey) headers.Authorization = `Bearer ${settings.tsKey}`;
  let r;
  try {
    r = await fetch(endpoint(), { method: "POST", headers, body: JSON.stringify({ model: settings.jevModel, state, questions }) });
  } catch {
    throw new Error(proxy.available ? "Could not reach Jev through the local proxy" : "Browser could not reach Jev directly (CORS). Open the page from jev_proxy.py.");
  }
  if (!r.ok) throw new Error(`Jev ${r.status}: ${(await r.text()).slice(0, 180)}`);
  const data = await r.json();
  return data.answers ?? {};
}
async function systemOneBatched(state, questions, size = 40) {
  const parts = chunk(Object.entries(questions), size);
  const results = await Promise.all(parts.map((part) => systemOne(state, Object.fromEntries(part))));
  return Object.assign({}, ...results);
}

// src/backends/live.ts
var key = (index) => `w${index}`;
async function tagWithJev(sentence, words) {
  const state = { sentence, words: Object.fromEntries(words.map((w) => [key(w.index), w.text])) };
  const kindQuestions = {};
  for (const w of words) {
    kindQuestions[key(w.index)] = {
      type: "choice",
      instructions: `Look at the word \`words.${key(w.index)}\` exactly as it is used in \`sentence\`. Could a writer dial it up or down on a scale by swapping in a different word, without changing what the sentence is about?`,
      criteria: WORD_KIND_CRITERIA
    };
  }
  const kinds = await systemOneBatched(state, kindQuestions);
  const flagged = [];
  for (const word of words) {
    const a = kinds[key(word.index)];
    if (a?.type !== "choice" || a.choice === "fixed") continue;
    const p = a.probabilities ?? {};
    if ((p[a.choice] ?? 0) < 0.45) continue;
    flagged.push({ word, kind: a.choice, confidence: 1 - (p.fixed ?? 0) });
  }
  if (!flagged.length) return [];
  const scoreQuestions = {};
  for (const { word, kind } of flagged) {
    scoreQuestions[key(word.index)] = kind === "degree" ? { type: "score", instructions: `How strong a degree does \`words.${key(word.index)}\` express as used in \`sentence\`?`, criteria: DEGREE_LEVELS } : { type: "score", instructions: `How negative or positive does \`words.${key(word.index)}\` read as used in \`sentence\`?`, criteria: VALENCE_LEVELS };
  }
  const scores = await systemOneBatched(state, scoreQuestions);
  return flagged.map(({ word, kind, confidence }) => {
    const a = scores[key(word.index)];
    const s = a?.type === "score" ? a.score : null;
    if (kind === "degree") return { index: word.index, kind, confidence, valence: 0, intensity: s === null ? 0.5 : s / 3 };
    return { index: word.index, kind, confidence, valence: s === null ? 0 : (s - 2) / 2, intensity: s === null ? 0.5 : Math.abs(s - 2) / 2 };
  });
}
async function tagWithLlm(sentence, words) {
  const res = await chatJSON(
    [
      { role: "system", content: TAG_SYSTEM },
      { role: "user", content: JSON.stringify({ sentence, words: words.map((w) => ({ index: w.index, word: w.text })) }) }
    ],
    TAG_SCHEMA,
    { maxTokens: 3e3 }
  );
  const valid = new Set(words.map((w) => w.index));
  return (res.items ?? []).filter((it) => valid.has(Number(it.index)) && (it.kind === "evaluative" || it.kind === "degree")).map((it) => ({
    index: Number(it.index),
    kind: it.kind,
    confidence: 0.8,
    valence: num(it.valence, -1, 1, 0),
    intensity: num(it.intensity, 0, 1, 0.5)
  }));
}
var liveBackend = {
  id: "live",
  async tagWords(sentence, words) {
    try {
      return { tags: await tagWithJev(sentence, words), source: "Jev" };
    } catch (err) {
      if (!hasLlmAccess()) throw err;
      const tags = await tagWithLlm(sentence, words);
      return { tags, source: `${settings.llmModel} (fallback)`, warning: `${errorMessage(err)} Used the LLM to find dial words instead.` };
    }
  },
  async nextRung(req) {
    const axis = AXES[req.kind];
    const user = JSON.stringify(
      {
        sentence: req.marked,
        current: req.current,
        ladder_low_to_high: req.ladder,
        axis: req.kind === "degree" ? "degree" : "valence",
        direction: req.dir > 0 ? "UP" : "DOWN",
        meaning_of_direction: req.dir > 0 ? axis.up : axis.down,
        task: `Give the rung directly ${req.dir > 0 ? "above" : "below"} "${req.current}".`
      },
      null,
      1
    );
    const res = await chatJSON(
      [
        { role: "system", content: STEP_SYSTEM },
        { role: "user", content: user }
      ],
      STEP_SCHEMA
    );
    return {
      replacement: String(res.replacement ?? "").trim(),
      valence: num(res.valence, -1, 1, 0),
      intensity: num(res.intensity, 0, 1, 0.5),
      atLimit: !!res.at_limit
    };
  },
  async proposeQuestions(sentence) {
    const res = await chatJSON(
      [
        { role: "system", content: QUESTIONS_SYSTEM },
        { role: "user", content: sentence }
      ],
      QUESTIONS_SCHEMA,
      { maxTokens: 4e3, temperature: 0.8, model: settings.questionModel, fallbacks: QUESTION_FALLBACK_LLMS, reasoning: "medium" }
    );
    return normalizeQuestions(res.questions);
  },
  async classify(sentence, specs) {
    const questions = {};
    for (const spec of specs) {
      questions[spec.id] = {
        type: "choice",
        instructions: `${spec.question} Answer about \`sentence\`.`,
        criteria: Object.fromEntries(spec.options.map((o) => [o.label, o.description || null]))
      };
    }
    const answers = await systemOne({ sentence }, questions);
    return Object.fromEntries(
      specs.map((spec) => {
        const a = answers[spec.id];
        return [spec.id, normalizeDistribution(spec, a?.type === "choice" ? a.probabilities : a?.type === "score" ? a.probabilities : void 0)];
      })
    );
  }
};

// src/backends/mock.ts
var EVALUATIVE_SCALES = [
  ["abysmal", "terrible", "bad", "poor", "meh", "okay", "fine", "decent", "good", "great", "excellent", "amazing", "phenomenal"],
  ["glacial", "painfully slow", "slow", "a bit slow", "unhurried", "prompt", "quick", "lightning-fast"],
  ["furious", "irritated", "annoyed", "a little impatient", "neutral", "calm", "cheerful", "delighted"],
  ["hate", "dislike", "tolerate", "like", "enjoy", "love", "adore"],
  ["boring", "dull", "fine", "interesting", "fascinating", "riveting"]
];
var DEGREE_SCALE = ["barely", "slightly", "somewhat", "fairly", "pretty", "quite", "very", "extremely", "incredibly"];
function locate(word) {
  const w = word.toLowerCase();
  const d = DEGREE_SCALE.indexOf(w);
  if (d >= 0) return { scale: DEGREE_SCALE, i: d, degree: true };
  for (const scale of EVALUATIVE_SCALES) {
    const i = scale.indexOf(w);
    if (i >= 0) return { scale, i, degree: false };
  }
  return null;
}
function position(scale, i, degree) {
  const x = i / (scale.length - 1);
  return degree ? { valence: 0, intensity: x } : { valence: x * 2 - 1, intensity: Math.abs(x * 2 - 1) };
}
function sentenceValence(sentence) {
  const words = sentence.toLowerCase().match(/[a-z-]+(?: slow| impatient)?/g) ?? [];
  let sum = 0;
  let n = 0;
  let boost = 1;
  for (const w of words) {
    const hit = locate(w) ?? locate(w.split(" ")[0]);
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
var mockBackend = {
  id: "mock",
  async tagWords(_sentence, words) {
    await sleep(400);
    const tags = [];
    for (const w of words) {
      const hit = locate(w.text);
      if (hit) tags.push({ index: w.index, kind: hit.degree ? "degree" : "evaluative", confidence: 0.9, ...position(hit.scale, hit.i, hit.degree) });
    }
    return { tags, source: "demo lexicon" };
  },
  async nextRung(req) {
    await sleep(160 + Math.random() * 200);
    const hit = locate(req.current);
    const next = hit?.scale[hit.i + req.dir];
    if (!hit || !next) return { replacement: "", valence: 0, intensity: 0, atLimit: true };
    return { replacement: next, ...position(hit.scale, hit.i + req.dir, hit.degree), atLimit: false };
  },
  async proposeQuestions() {
    await sleep(700);
    return normalizeQuestions([
      {
        name: "Sentiment",
        question: "What is the overall sentiment of the sentence?",
        options: ["very positive", "positive", "neutral", "negative", "very negative"].map((label) => ({ label, description: label }))
      },
      {
        name: "Tone",
        question: "How would you describe the tone?",
        options: ["warm", "mild", "neutral", "aggressive"].map((label) => ({ label, description: label }))
      },
      {
        name: "Would Return",
        question: "How likely is the speaker to come back?",
        options: ["definitely", "probably", "unsure", "unlikely", "never"].map((label) => ({ label, description: label }))
      }
    ]);
  },
  async classify(sentence, specs) {
    await sleep(250 + Math.random() * 200);
    const v = sentenceValence(sentence);
    return Object.fromEntries(
      specs.map((spec) => {
        const n = spec.options.length;
        const center = (1 - v) / 2 * (n - 1);
        const raw = Object.fromEntries(spec.options.map((o, i) => [o.label, Math.exp(-((i - center) ** 2) / 0.9)]));
        return [spec.id, normalizeDistribution(spec, raw)];
      })
    );
  }
};

// src/backends/index.ts
var currentBackend = () => settings.mock ? mockBackend : liveBackend;

// src/ui/icons.ts
var svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
var icons = {
  close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  sparkle: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  settings: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
  ),
  soundOn: svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
  soundOff: svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  system: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/>'),
  enter: svg('<path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>')
};

// src/ui/Composer.ts
var Composer = class {
  el;
  input;
  constructor(onSubmit) {
    this.input = h("textarea", { class: "composer-input", attrs: { rows: "1", placeholder: "Add a sentence\u2026", spellcheck: "true", "aria-label": "New sentence" } });
    const submit = () => {
      const text = this.input.value.replace(/\s+/g, " ").trim();
      if (!text) return;
      onSubmit(text);
      this.input.value = "";
      this.autosize();
    };
    this.input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
        ev.preventDefault();
        submit();
      }
    });
    this.input.addEventListener("input", () => this.autosize());
    const button = h("button", { class: "composer-go", html: icons.enter, attrs: { title: "Add (Enter)", "aria-label": "Add sentence" }, on: { click: submit } });
    this.el = h("div", { class: "composer" }, this.input, button);
  }
  focus() {
    this.input.focus();
  }
  autosize() {
    this.input.style.height = "auto";
    this.input.style.height = `${this.input.scrollHeight}px`;
  }
};

// src/ui/theme.ts
var THEME_ORDER = ["system", "light", "dark"];
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme;
  else root.dataset.theme = mode;
}
var nextTheme = (mode) => THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length];

// src/ui/Header.ts
var THEME_ICON = { system: icons.system, light: icons.sun, dark: icons.moon };
var THEME_LABEL = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" };
var Header = class {
  el;
  themeBtn;
  soundBtn;
  modePill;
  constructor(onOpenSettings) {
    this.themeBtn = h("button", { class: "icon-btn", on: { click: () => updateSettings({ theme: nextTheme(settings.theme) }) } });
    this.soundBtn = h("button", { class: "icon-btn", on: { click: () => updateSettings({ sound: !settings.sound }) } });
    const gear = h("button", { class: "icon-btn", html: icons.settings, attrs: { title: "Settings", "aria-label": "Settings" }, on: { click: onOpenSettings } });
    this.modePill = h("span", { class: "pill", text: "demo" });
    this.el = h(
      "header",
      { class: "topbar" },
      h("div", { class: "brand" }, h("h1", { text: "Word Dial" }), this.modePill),
      h("div", { class: "tools" }, this.themeBtn, this.soundBtn, gear)
    );
    this.sync();
    settingsEvents.on("change", () => this.sync());
  }
  sync() {
    this.themeBtn.innerHTML = THEME_ICON[settings.theme];
    this.themeBtn.title = THEME_LABEL[settings.theme];
    this.themeBtn.setAttribute("aria-label", THEME_LABEL[settings.theme]);
    this.soundBtn.innerHTML = settings.sound ? icons.soundOn : icons.soundOff;
    this.soundBtn.title = settings.sound ? "Sound on" : "Sound off";
    this.soundBtn.classList.toggle("off", !settings.sound);
    this.modePill.hidden = !settings.mock;
  }
};

// src/analysis/Histogram.ts
var Histogram = class {
  constructor(spec) {
    this.spec = spec;
    const rows = spec.options.map((option) => {
      const fill = h("div", { class: "fill" });
      const ghost = h("div", { class: "ghost" });
      const pct = h("span", { class: "pct", text: "\u2013" });
      const delta = h("span", { class: "delta" });
      const root = h(
        "div",
        { class: "hrow", attrs: { title: option.description } },
        h("span", { class: "hlabel", text: option.label }),
        h("div", { class: "track" }, fill, ghost),
        h("span", { class: "hval" }, pct, delta)
      );
      this.rows.set(option.label, { root, fill, ghost, pct, delta });
      return root;
    });
    this.el = h("section", { class: "hist" }, h("h3", { text: spec.name, attrs: { title: spec.question } }), h("div", { class: "hrows" }, ...rows));
  }
  spec;
  el;
  rows = /* @__PURE__ */ new Map();
  update(dist, baseline) {
    const top = topLabel(dist);
    for (const [label, row] of this.rows) {
      const p = dist[label] ?? 0;
      const b = baseline?.[label];
      row.fill.style.width = `${(p * 100).toFixed(1)}%`;
      row.pct.textContent = `${Math.round(p * 100)}%`;
      row.root.classList.toggle("top", label === top);
      const shift = b === void 0 ? 0 : Math.round((p - b) * 100);
      row.ghost.style.left = `${((b ?? p) * 100).toFixed(1)}%`;
      row.ghost.classList.toggle("show", shift !== 0);
      row.delta.textContent = shift === 0 ? "" : `${shift > 0 ? "+" : "\u2212"}${Math.abs(shift)}`;
      row.delta.className = `delta${shift > 0 ? " up" : shift < 0 ? " down" : ""}`;
    }
  }
};

// src/analysis/ClassificationPanel.ts
var ClassificationPanel = class {
  el = h("div", { class: "panel" });
  histograms = [];
  showSkeleton() {
    this.histograms = [];
    const block = () => h("section", { class: "hist skeleton" }, h("h3"), h("div", { class: "hrows" }, ...Array.from({ length: 4 }, () => h("div", { class: "hrow" }, h("div", { class: "track" })))));
    this.el.replaceChildren(...Array.from({ length: QUESTION_COUNT }, block));
  }
  setSpecs(specs) {
    this.histograms = specs.map((spec) => new Histogram(spec));
    this.el.replaceChildren(...this.histograms.map((x) => x.el));
    this.el.classList.add("pending");
  }
  update(result, baseline) {
    for (const hist of this.histograms) {
      const dist = result[hist.spec.id];
      if (dist) hist.update(dist, baseline?.[hist.spec.id]);
    }
    this.el.classList.remove("pending");
  }
  setBusy(busy) {
    this.el.classList.toggle("busy", busy);
  }
  showError(message, retry) {
    const note = h("div", { class: "panel-error" }, h("span", { text: message }), h("button", { class: "link", text: "Retry", on: { click: retry } }));
    this.el.querySelector(".panel-error")?.remove();
    if (!this.histograms.length) this.el.replaceChildren(note);
    else this.el.append(note);
  }
  clearError() {
    this.el.querySelector(".panel-error")?.remove();
  }
};

// src/feedback/haptics.ts
var PATTERNS = { step: [6], limit: [14, 50, 14], error: [30, 40, 30] };
var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
var iosSwitch = null;
function switchLabel() {
  if (iosSwitch) return iosSwitch;
  const label = document.createElement("label");
  label.style.cssText = "position:fixed;left:-99px;top:0;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.append(input);
  document.body.append(label);
  return iosSwitch = label;
}
function haptic(kind) {
  if (!settings.haptics) return;
  if ("vibrate" in navigator) {
    navigator.vibrate(PATTERNS[kind]);
    return;
  }
  if (!isIOS) return;
  const label = switchLabel();
  label.click();
  if (kind !== "step") setTimeout(() => label.click(), 90);
}

// src/feedback/sound.ts
var ctx = null;
var noise = null;
function context() {
  if (!settings.sound) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {
  });
  return ctx.state === "running" ? ctx : null;
}
function noiseBuffer(c) {
  if (noise) return noise;
  const n = Math.floor(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
  return noise = buf;
}
function click({ freq = 3e3, gain = 0.5, delay = 0, q = 2.5, decay = 0.012 } = {}) {
  const c = context();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = q;
  const high = c.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 400;
  const amp = c.createGain();
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(1e-4, t0 + decay);
  src.connect(band).connect(high).connect(amp).connect(c.destination);
  src.start(t0);
  src.stop(t0 + decay + 0.01);
}
function unlockAudio() {
  context();
}

// src/feedback/index.ts
function feedback(kind, el2, dir = 1, pitch = 0) {
  if (el2) replay(el2, kind === "step" ? dir > 0 ? "bump-up" : "bump-down" : kind === "limit" ? "limit" : "err");
  haptic(kind);
  if (kind === "step") click({ freq: 2600 * Math.pow(2, pitch * 0.6), gain: 0.55 });
  else if (kind === "limit") {
    click({ freq: 900, gain: 0.7, q: 1.2, decay: 0.02 });
    click({ freq: 750, gain: 0.6, delay: 0.07, q: 1.2, decay: 0.02 });
  } else {
    for (let i = 0; i < 3; i++) click({ freq: 500, gain: 0.6 - i * 0.1, delay: i * 0.05, q: 0.8, decay: 0.03 });
  }
}

// src/dial/colors.ts
function hueFor(kind, rung) {
  if (kind === "degree") return { h: 290, c: 0.03 + 0.16 * clamp(rung.intensity, 0, 1) };
  const v = clamp(rung.valence, -1, 1);
  return { h: v >= 0 ? 152 : 27, c: 0.015 + 0.17 * Math.abs(v) };
}
function applyHue(el2, hue) {
  el2.style.setProperty("--h", String(hue.h));
  el2.style.setProperty("--cc", hue.c.toFixed(3));
}

// src/dial/token.ts
var PIECES = /[\p{L}\p{M}\p{N}’'\-]+|\s+|[^\s\p{L}\p{M}\p{N}]+/gu;
function tokenize(sentence) {
  return (sentence.match(PIECES) ?? []).map((text, i) => ({
    i,
    orig: text,
    word: /^\p{L}/u.test(text),
    text,
    kind: null,
    confidence: 0,
    ladder: /* @__PURE__ */ new Map(),
    level: 0,
    limit: { up: null, down: null },
    busy: false,
    queued: 0,
    coolUntil: 0,
    el: null
  }));
}
var rungOf = (t, level = t.level) => t.ladder.get(level) ?? { text: t.text, valence: 0, intensity: 0.5 };
var pitchOf = (t, r = rungOf(t)) => t.kind === "degree" ? r.intensity * 2 - 1 : r.valence;

// src/dial/DialSentence.ts
var registry = /* @__PURE__ */ new WeakMap();
function locateToken(target) {
  if (!(target instanceof Element)) return null;
  const tokEl = target.closest(".tok.dial");
  const root = tokEl?.closest(".dial-sentence");
  const dial = root && registry.get(root);
  if (!tokEl || !dial) return null;
  const tok = dial.tokens[Number(tokEl.dataset.i)];
  return tok?.kind ? { dial, tok } : null;
}
var DialSentence = class {
  constructor(text, backend) {
    this.backend = backend;
    this.tokens = tokenize(text);
    registry.set(this.el, this);
    this.render();
  }
  backend;
  el = h("div", { class: "dial-sentence" });
  events = new Emitter();
  tokens;
  generation = 0;
  inflight = /* @__PURE__ */ new Map();
  get text() {
    return this.tokens.map((t) => t.text).join("");
  }
  get dials() {
    return this.tokens.filter((t) => t.kind);
  }
  alive(t) {
    return this.tokens[t.i] === t;
  }
  async load(text = this.text) {
    const gen = ++this.generation;
    const changed = text !== this.text;
    this.inflight.clear();
    this.tokens = tokenize(text);
    this.render(true);
    if (changed) this.events.emit("change", { text, reason: "load" });
    this.status("busy", "Finding dial words\u2026");
    try {
      const words = this.tokens.filter((t) => t.word).map((t) => ({ index: t.i, text: t.text }));
      const { tags, warning } = await this.backend().tagWords(text, words);
      if (gen !== this.generation) return;
      for (const tag of tags) {
        const t = this.tokens[tag.index];
        if (!t?.word) continue;
        t.kind = tag.kind;
        t.confidence = tag.confidence;
        t.ladder.set(0, { text: t.orig, valence: tag.valence, intensity: tag.intensity });
      }
      this.render();
      if (warning) this.events.emit("warning", warning);
      this.status("idle", "");
    } catch (err) {
      if (gen !== this.generation) return;
      this.render();
      this.status("error", errorMessage(err));
    }
  }
  isPending(t, level) {
    return this.inflight.has(`${this.generation}:${t.i}:${level}`);
  }
  isLimited(t, dir) {
    const edge = dir > 0 ? t.limit.up : t.limit.down;
    if (edge !== null && (dir > 0 ? t.level >= edge : t.level <= edge)) return true;
    return Math.abs(t.level + dir) > MAX_STEPS;
  }
  prefetch(t, dir) {
    if (!t.kind || this.isLimited(t, dir) || t.ladder.has(t.level + dir)) return;
    this.fetchRung(t, t.level, dir).catch(() => {
    });
  }
  async go(t, dir) {
    if (!t.kind || !this.alive(t)) return;
    if (t.busy) {
      t.queued = dir;
      return;
    }
    if (this.isLimited(t, dir)) {
      feedback("limit", t.el, dir);
      return;
    }
    const target = t.level + dir;
    if (t.ladder.has(target)) {
      this.setLevel(t, target, dir, "dial");
      this.prefetch(t, dir);
      return;
    }
    t.busy = true;
    t.el?.classList.add("pending", dir > 0 ? "up" : "down");
    try {
      const rung = await this.fetchRung(t, t.level, dir);
      if (!this.alive(t)) return;
      if (rung) {
        this.setLevel(t, target, dir, "dial");
        this.prefetch(t, dir);
      } else feedback("limit", t.el, dir);
    } catch (err) {
      feedback("error", t.el, dir);
      this.events.emit("warning", errorMessage(err));
    } finally {
      t.busy = false;
      t.el?.classList.remove("pending", "up", "down");
      if (this.alive(t) && t.queued) {
        const q = t.queued;
        t.queued = 0;
        void this.go(t, q);
      }
    }
  }
  reset(t) {
    if (!t.kind || t.level === 0) return;
    this.setLevel(t, 0, t.level > 0 ? -1 : 1, "reset");
  }
  resetAll() {
    for (const t of this.dials) this.reset(t);
  }
  status(kind, text) {
    this.events.emit("status", { kind, text });
  }
  fetchRung(t, from, dir) {
    const target = from + dir;
    const existing = t.ladder.get(target);
    if (existing) return Promise.resolve(existing);
    const key2 = `${this.generation}:${t.i}:${target}`;
    const pending = this.inflight.get(key2);
    if (pending) return pending;
    const current = rungOf(t, from).text;
    const request = {
      marked: this.tokens.map((x) => x === t ? `\u27E6${current}\u27E7` : x.text).join(""),
      current,
      ladder: [...t.ladder.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.text),
      kind: t.kind ?? "evaluative",
      dir
    };
    const promise = this.backend().nextRung(request).then((res) => {
      this.inflight.delete(key2);
      if (!this.alive(t)) return null;
      const text = res.replacement.trim();
      const seen = [...t.ladder.values()].some((r) => r.text.toLowerCase() === text.toLowerCase());
      if (!text || res.atLimit || seen || text.split(/\s+/).length > 5) {
        if (dir > 0) t.limit.up = from;
        else t.limit.down = from;
        this.events.emit("ladder", t);
        return null;
      }
      const rung = { text, valence: num(res.valence, -1, 1, rungOf(t, from).valence), intensity: num(res.intensity, 0, 1, 0.5) };
      t.ladder.set(target, rung);
      this.events.emit("ladder", t);
      return rung;
    }).catch((err) => {
      this.inflight.delete(key2);
      this.events.emit("ladder", t);
      throw err;
    });
    this.inflight.set(key2, promise);
    this.events.emit("ladder", t);
    return promise;
  }
  setLevel(t, level, dir, reason) {
    const rung = t.ladder.get(level);
    if (!rung) return;
    t.level = level;
    t.text = level === 0 ? t.orig : this.matchCase(t, rung.text);
    this.swapText(t, dir);
    this.fixArticle(t);
    this.paint(t);
    this.events.emit("ladder", t);
    feedback("step", t.el, dir, pitchOf(t, rung));
    this.events.emit("change", { text: this.text, reason });
  }
  matchCase(t, raw) {
    const s = raw.trim().replace(/^["'“”‘’⟦[]+|["'“”‘’⟧\].,;:!?]+$/g, "");
    const first = t.orig[0] ?? "";
    const upper = first !== first.toLowerCase();
    if (upper) return s.charAt(0).toUpperCase() + s.slice(1);
    if (s.length > 1 && s !== s.toUpperCase()) return s.charAt(0).toLowerCase() + s.slice(1);
    return s;
  }
  fixArticle(t) {
    let j = t.i - 1;
    while (j >= 0 && !this.tokens[j].word) {
      if (/\S/.test(this.tokens[j].text)) return;
      j--;
    }
    const prev = this.tokens[j];
    if (!prev || prev.kind || !/^an?$/i.test(prev.text)) return;
    const want = /^[aeiou]/i.test(t.text) && !/^(uni|use|one|eu)/i.test(t.text) ? "an" : "a";
    const next = prev.text[0] === "A" ? want[0].toUpperCase() + want.slice(1) : want;
    if (next === prev.text || !prev.el) return;
    prev.text = next;
    prev.el.textContent = next;
    replay(prev.el, "flash", 500);
  }
  swapText(t, dir) {
    const el2 = t.el;
    if (!el2) return;
    const before = el2.getBoundingClientRect().width;
    const inner = h("span", { class: `inner ${dir > 0 ? "in-up" : "in-down"}`, text: t.text });
    el2.style.width = "";
    el2.replaceChildren(inner);
    const after = el2.getBoundingClientRect().width;
    el2.style.width = `${before}px`;
    void el2.offsetWidth;
    el2.style.width = `${after}px`;
    window.setTimeout(() => {
      el2.style.width = "";
    }, 220);
  }
  paint(t) {
    if (t.el && t.kind) applyHue(t.el, hueFor(t.kind, rungOf(t)));
  }
  render(scanning = false) {
    let k = 0;
    const nodes = this.tokens.map((t) => {
      const el2 = h("span", { class: "tok", attrs: { "data-i": String(t.i) } });
      if (t.word) {
        el2.classList.add("word");
        el2.style.setProperty("--k", String(k++));
        if (scanning) el2.classList.add("scanning");
      }
      if (t.kind) {
        el2.classList.add("dial", `kind-${t.kind}`);
        if (t.confidence < 0.72) el2.classList.add("soft");
        el2.tabIndex = 0;
        el2.setAttribute("role", "slider");
        el2.setAttribute("aria-label", t.text);
        el2.append(h("span", { class: "inner", text: t.text }));
      } else el2.textContent = t.text;
      t.el = el2;
      if (t.kind) this.paint(t);
      return el2;
    });
    this.el.replaceChildren(...nodes);
  }
};

// src/dial/Ladder.ts
var WINDOW = 4;
var Ladder = class {
  el = h("div", { class: "ladder", attrs: { "aria-hidden": "true" } });
  target = null;
  hideTimer;
  mount() {
    document.body.append(this.el);
  }
  get active() {
    return this.target?.tok ?? null;
  }
  show(dial, tok) {
    window.clearTimeout(this.hideTimer);
    if (this.target && this.target.tok !== tok) this.target.tok.el?.classList.remove("active");
    this.target = { dial, tok };
    tok.el?.classList.add("active");
    this.render();
    this.el.classList.add("show");
    dial.prefetch(tok, 1);
    dial.prefetch(tok, -1);
  }
  hide(delay = 0) {
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.el.classList.remove("show");
      this.target?.tok.el?.classList.remove("active");
      this.target = null;
    }, delay);
  }
  hideIfInside(root) {
    if (this.target?.tok.el && root.contains(this.target.tok.el)) this.hide();
  }
  refresh(tok) {
    if (this.target?.tok === tok) this.render();
  }
  reposition() {
    const el2 = this.target?.tok.el;
    if (!el2?.isConnected) return;
    const r = el2.getBoundingClientRect();
    const cur = this.el.querySelector(".row.cur");
    const pw = this.el.offsetWidth;
    const ph = this.el.offsetHeight;
    let left = r.right + 14;
    if (left + pw > innerWidth - 8) left = Math.max(8, r.left - pw - 14);
    const anchor = cur ? cur.offsetTop + cur.offsetHeight / 2 : ph / 2;
    const top = clamp(r.top + r.height / 2 - anchor, 8, innerHeight - ph - 8);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }
  edge(dial, t, dir) {
    const levels = [...t.ladder.keys()];
    const end = dir > 0 ? Math.max(...levels) : Math.min(...levels);
    const limit = dir > 0 ? t.limit.up : t.limit.down;
    const word = t.kind === "degree" ? dir > 0 ? "stronger" : "weaker" : dir > 0 ? "more positive" : "more negative";
    if (limit !== null && limit === end) return h("div", { class: "edge end", text: "end of scale" });
    if (dial.isPending(t, end + dir)) return h("div", { class: "edge pend", text: word });
    return h("div", { class: "edge", text: `${dir > 0 ? "\u2191" : "\u2193"} ${word}` });
  }
  render() {
    const target = this.target;
    if (!target?.tok.el?.isConnected) return;
    const { dial, tok } = target;
    const levels = [...tok.ladder.keys()].sort((a, b) => b - a).filter((l) => Math.abs(l - tok.level) <= WINDOW);
    const rows = levels.map((level) => {
      const rung = tok.ladder.get(level);
      const row = h(
        "div",
        { class: `row${level === tok.level ? " cur" : ""}${level === 0 ? " orig" : ""}` },
        h("span", { class: "sw" }),
        h("span", { class: "t", text: level === 0 ? tok.orig : rung.text })
      );
      applyHue(row, hueFor(tok.kind, rung));
      return row;
    });
    this.el.replaceChildren(this.edge(dial, tok, 1), ...rows, this.edge(dial, tok, -1));
    this.reposition();
  }
};
var ladder = new Ladder();

// src/dial/interactions.ts
var installed = false;
function attachDial(dial) {
  return dial.events.on("ladder", (tok) => ladder.refresh(tok));
}
function installDialInteractions() {
  if (installed) return;
  installed = true;
  ladder.mount();
  let wheelAcc = 0;
  let wheelTarget = null;
  let wheelLast = 0;
  let wheelIdle;
  document.addEventListener(
    "wheel",
    (ev) => {
      const now = performance.now();
      let target = locateToken(ev.target);
      if (!target && wheelTarget && wheelTarget.dial.alive(wheelTarget.tok) && now - wheelLast < WHEEL_STICKY_MS) target = wheelTarget;
      if (!target) return;
      ev.preventDefault();
      wheelLast = now;
      if (wheelTarget?.tok !== target.tok) wheelAcc = 0;
      wheelTarget = target;
      window.clearTimeout(wheelIdle);
      wheelIdle = window.setTimeout(() => wheelAcc = 0, 260);
      const unit = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 400 : 1;
      const dy = -ev.deltaY * unit * (settings.invertScroll ? -1 : 1);
      if (now < target.tok.coolUntil) return;
      wheelAcc += dy;
      if (Math.abs(wheelAcc) < WHEEL_STEP_PX) return;
      const dir = Math.sign(wheelAcc);
      wheelAcc = 0;
      target.tok.coolUntil = now + 150;
      void target.dial.go(target.tok, dir);
    },
    { passive: false }
  );
  document.addEventListener("mouseover", (ev) => {
    const t = locateToken(ev.target);
    if (t) ladder.show(t.dial, t.tok);
  });
  document.addEventListener("mouseout", (ev) => {
    const t = locateToken(ev.target);
    if (t && !(ev.relatedTarget instanceof Node && t.tok.el?.contains(ev.relatedTarget))) ladder.hide(160);
  });
  document.addEventListener("focusin", (ev) => {
    const t = locateToken(ev.target);
    if (t) ladder.show(t.dial, t.tok);
  });
  document.addEventListener("focusout", (ev) => {
    if (locateToken(ev.target)) ladder.hide(100);
  });
  document.addEventListener("dblclick", (ev) => {
    const t = locateToken(ev.target);
    if (!t) return;
    ev.preventDefault();
    t.dial.reset(t.tok);
  });
  document.addEventListener("keydown", (ev) => {
    unlockAudio();
    const t = locateToken(ev.target);
    if (!t) return;
    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      ev.preventDefault();
      void t.dial.go(t.tok, ev.key === "ArrowUp" ? 1 : -1);
    } else if (ev.key === "Escape" || ev.key === "0" || ev.key === "Backspace") {
      ev.preventDefault();
      t.dial.reset(t.tok);
    }
  });
  let drag = null;
  document.addEventListener(
    "pointerdown",
    (ev) => {
      unlockAudio();
      const t = locateToken(ev.target);
      if (!t?.tok.el) return;
      drag = { ...t, y: ev.clientY, id: ev.pointerId };
      t.tok.el.setPointerCapture(ev.pointerId);
      ladder.show(t.dial, t.tok);
    },
    { capture: true }
  );
  document.addEventListener("pointermove", (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dy = drag.y - ev.clientY;
    const step = ev.pointerType === "mouse" ? 18 : 26;
    if (Math.abs(dy) < step) return;
    drag.y = ev.clientY;
    void drag.dial.go(drag.tok, Math.sign(dy));
  });
  const endDrag = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    if (ev.pointerType !== "mouse") ladder.hide(700);
    drag = null;
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  addEventListener("scroll", () => ladder.reposition(), { passive: true });
  addEventListener("resize", () => ladder.reposition());
}

// src/ui/toast.ts
var el = h("div", { class: "toast", attrs: { role: "status" } });
var timer;
function mountToast() {
  document.body.append(el);
}
function toast(message, ms = 4200) {
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove("show"), ms);
}

// src/ui/SentenceCard.ts
var SentenceCard = class {
  constructor(record, deps) {
    this.record = record;
    this.deps = deps;
    this.dial = new DialSentence(record.text, deps.backend);
    const actions = h(
      "div",
      { class: "card-actions" },
      h("button", { class: "icon-btn sm", html: icons.sparkle, attrs: { title: "New questions", "aria-label": "New questions" }, on: { click: () => void this.regenerateQuestions() } }),
      h("button", { class: "icon-btn sm", html: icons.reset, attrs: { title: "Reset to original", "aria-label": "Reset" }, on: { click: () => this.resetToOriginal() } }),
      h("button", { class: "icon-btn sm", html: icons.close, attrs: { title: "Remove", "aria-label": "Remove" }, on: { click: () => this.deps.onRemove(this) } })
    );
    this.el = h("article", { class: "card" }, actions, this.dial.el, this.statusEl, this.panel.el);
    this.unsubscribe.push(
      attachDial(this.dial),
      this.dial.events.on("change", ({ text }) => {
        this.record.text = text;
        this.deps.onChange(this);
        this.panel.setBusy(true);
        this.scheduleClassify();
      }),
      this.dial.events.on("status", ({ kind, text }) => this.setStatus(kind === "idle" ? "" : text, kind === "error")),
      this.dial.events.on("warning", (message) => toast(message))
    );
  }
  record;
  deps;
  el;
  dial;
  panel = new ClassificationPanel();
  statusEl = h("div", { class: "card-status" });
  unsubscribe = [];
  classifySeq = 0;
  questionsPromise = null;
  scheduleClassify = debounce(() => void this.classify(), RECLASSIFY_DEBOUNCE_MS);
  async start() {
    await Promise.all([this.dial.load(), this.prepareQuestions().then(() => this.classify())]);
  }
  async restart() {
    this.scheduleClassify.cancel();
    await Promise.all([this.dial.load(), this.classify()]);
  }
  async regenerateQuestions() {
    if (this.questionsPromise) return;
    this.classifySeq++;
    this.record.specs = null;
    this.record.baseline = null;
    this.deps.onChange(this);
    const specs = await this.prepareQuestions();
    if (!specs) return;
    if (this.dial.text !== this.record.original) {
      const seq = ++this.classifySeq;
      try {
        const baseline = await this.deps.backend().classify(this.record.original, specs);
        if (seq !== this.classifySeq) return;
        this.record.baseline = baseline;
        this.deps.onChange(this);
      } catch {
      }
    }
    await this.classify();
  }
  resetToOriginal() {
    this.dial.resetAll();
    if (this.dial.text !== this.record.original) void this.dial.load(this.record.original);
  }
  dispose() {
    this.scheduleClassify.cancel();
    this.classifySeq++;
    ladder.hideIfInside(this.el);
    for (const off of this.unsubscribe) off();
    this.dial.events.clear();
  }
  prepareQuestions() {
    if (this.record.specs) {
      this.panel.setSpecs(this.record.specs);
      return Promise.resolve(this.record.specs);
    }
    if (this.questionsPromise) return this.questionsPromise;
    this.panel.showSkeleton();
    this.questionsPromise = this.deps.backend().proposeQuestions(this.record.original).then((specs) => {
      this.record.specs = specs;
      this.deps.onChange(this);
      this.panel.setSpecs(specs);
      return specs;
    }).catch((err) => {
      this.panel.showError(errorMessage(err), () => void this.prepareQuestions().then(() => this.classify()));
      return null;
    }).finally(() => {
      this.questionsPromise = null;
    });
    return this.questionsPromise;
  }
  async classify() {
    const specs = this.record.specs;
    if (!specs) return;
    const seq = ++this.classifySeq;
    const text = this.dial.text;
    this.panel.setBusy(true);
    try {
      const result = await this.deps.backend().classify(text, specs);
      if (seq !== this.classifySeq) return;
      if (!this.record.baseline && text === this.record.original) {
        this.record.baseline = result;
        this.deps.onChange(this);
      }
      this.panel.clearError();
      this.panel.update(result, this.record.baseline);
    } catch (err) {
      if (seq === this.classifySeq) this.panel.showError(errorMessage(err), () => void this.classify());
    } finally {
      if (seq === this.classifySeq) this.panel.setBusy(false);
    }
  }
  setStatus(text, error) {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle("show", !!text);
    this.statusEl.classList.toggle("error", error);
  }
};

// src/ui/SettingsDialog.ts
var TEXT_FIELDS = [
  { key: "orKey", label: "OpenRouter API key", secret: true },
  { key: "tsKey", label: "TypeSafe API key", secret: true },
  { key: "llmModel", label: "Word model", list: LLM_CHOICES },
  { key: "questionModel", label: "Question model", list: QUESTION_LLM_CHOICES },
  { key: "jevModel", label: "Jev model" },
  { key: "jevEndpoint", label: "Jev endpoint" }
];
var TOGGLES = [
  { key: "haptics", label: "Haptics" },
  { key: "sound", label: "Sound" },
  { key: "invertScroll", label: "Invert scroll" },
  { key: "rememberKeys", label: "Remember keys here" },
  { key: "mock", label: "Demo mode (offline)" }
];
var SettingsDialog = class {
  dialog;
  inputs = /* @__PURE__ */ new Map();
  checks = /* @__PURE__ */ new Map();
  note = h("p", { class: "note" });
  constructor() {
    const fields = TEXT_FIELDS.map((f) => {
      const id = `set-${f.key}`;
      const input = h("input", { attrs: { id, type: f.secret ? "password" : "text", autocomplete: "off", spellcheck: "false" } });
      this.inputs.set(f.key, input);
      const list = f.list ? h("datalist", { attrs: { id: `${id}-list` } }, ...f.list.map((v) => h("option", { attrs: { value: v } }))) : null;
      if (list) input.setAttribute("list", `${id}-list`);
      return h("div", { class: `field${f.key === "llmModel" || f.key === "questionModel" ? " half" : ""}` }, h("label", { text: f.label, attrs: { for: id } }), input, list);
    });
    const toggles = TOGGLES.map((t) => {
      const input = h("input", { attrs: { type: "checkbox" } });
      this.checks.set(t.key, input);
      return h("label", { class: "toggle" }, input, h("span", { text: t.label }));
    });
    const form = h(
      "form",
      { attrs: { method: "dialog" } },
      h("h2", { text: "Settings" }),
      this.note,
      h("div", { class: "fields" }, ...fields),
      h("div", { class: "toggles" }, ...toggles),
      h("div", { class: "actions" }, h("button", { class: "btn", text: "Cancel", attrs: { value: "cancel" } }), h("button", { class: "btn primary", text: "Save", attrs: { value: "save" } }))
    );
    form.addEventListener("submit", (ev) => {
      if (ev.submitter?.value === "save") this.save();
    });
    this.dialog = h("dialog", { class: "settings" }, form);
    document.body.append(this.dialog);
  }
  open() {
    for (const [key2, input] of this.inputs) input.value = String(settings[key2]);
    for (const [key2, input] of this.checks) input.checked = settings[key2];
    const mark = (b) => b ? "\u2713" : "\u2013";
    this.note.textContent = proxy.available ? `Local proxy \xB7 .env keys: TypeSafe ${mark(proxy.hasJevKey)} OpenRouter ${mark(proxy.hasLlmKey)}. Blank key fields use .env.` : "No local proxy. Keys typed here are sent from the browser.";
    this.dialog.showModal();
  }
  save() {
    const patch = {};
    for (const [key2, input] of this.inputs) patch[key2] = input.value.trim();
    for (const [key2, input] of this.checks) patch[key2] = input.checked;
    patch.llmModel ||= settings.llmModel;
    patch.questionModel ||= settings.questionModel;
    patch.jevModel ||= settings.jevModel;
    patch.jevEndpoint ||= "auto";
    updateSettings(patch);
  }
};

// src/app.ts
var STORE_KEY = "cards";
var App = class {
  cards = [];
  list = h("div", { class: "cards" });
  settingsDialog = new SettingsDialog();
  composer = new Composer((text) => this.add(text));
  constructor(root) {
    const header = new Header(() => this.openSettings());
    root.append(h("div", { class: "wrap" }, header.el, this.composer.el, this.list));
    settingsEvents.on("change", ({ previous }) => {
      applyTheme(settings.theme);
      const backendChanged = previous.mock !== settings.mock || previous.llmModel !== settings.llmModel || previous.jevModel !== settings.jevModel || previous.jevEndpoint !== settings.jevEndpoint;
      const keysAdded = !previous.orKey && !!settings.orKey || !previous.tsKey && !!settings.tsKey;
      if (backendChanged || keysAdded) for (const card of this.cards) void card.restart();
    });
    const stored = storage.getJSON(STORE_KEY, []);
    if (stored.length) for (const record of [...stored].reverse()) this.mount(record, false);
    else this.add(SEED_SENTENCE);
    this.composer.focus();
  }
  openSettings() {
    this.settingsDialog.open();
  }
  add(text) {
    this.mount({ id: uid(), original: text, text, specs: null, baseline: null }, true);
    this.persist();
  }
  mount(record, animate) {
    const card = new SentenceCard(record, {
      backend: currentBackend,
      onChange: () => this.persist(),
      onRemove: (c) => this.remove(c)
    });
    this.cards.unshift(card);
    this.list.prepend(card.el);
    if (animate) card.el.classList.add("enter");
    void card.start();
  }
  remove(card) {
    const i = this.cards.indexOf(card);
    if (i < 0) return;
    this.cards.splice(i, 1);
    card.dispose();
    this.persist();
    const el2 = card.el;
    el2.style.height = `${el2.offsetHeight}px`;
    void el2.offsetWidth;
    el2.classList.add("leave");
    el2.style.height = "0px";
    window.setTimeout(() => el2.remove(), 260);
  }
  persist() {
    storage.setJSON(
      STORE_KEY,
      this.cards.map((c) => c.record)
    );
  }
};

// src/main.ts
async function main() {
  loadSettings();
  applyTheme(settings.theme);
  await detectProxy();
  mountToast();
  installDialInteractions();
  const root = document.getElementById("app");
  if (!root) throw new Error("#app not found");
  const app = new App(root);
  if (!settings.mock && !hasLlmAccess() && !hasJevAccess()) app.openSettings();
}
void main();
//# sourceMappingURL=app.js.map
