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
var DEFAULT_KEV = "jaredpalmer/kev-4b";
var OPENROUTER_SYSTEMONE_URL = "https://openrouter.ai/api/v1/systemone";
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
  kevModel: DEFAULT_KEV,
  s1: ["jev"],
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
  settings.s1 = (Array.isArray(settings.s1) ? settings.s1 : []).filter((m) => m === "jev" || m === "kev");
  if (!settings.s1.length) settings.s1 = ["jev"];
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
function normalizeQuestions(raw, max = QUESTION_COUNT) {
  const specs = [];
  for (const q of raw ?? []) {
    const name = clean(q.name);
    const seen = /* @__PURE__ */ new Set();
    const options = (q.options ?? []).map((o) => ({ label: clean(o.label).toLowerCase(), description: clean(o.description) })).filter((o) => o.label && !seen.has(o.label) && seen.add(o.label)).slice(0, 8);
    if (!name || options.length < 2) continue;
    const kind = q.kind === "scale" || q.kind === "category" ? q.kind : void 0;
    specs.push({ id: `q${specs.length + 1}`, name, question: clean(q.question) || name, options, ...kind ? { kind } : {} });
    if (specs.length === max) break;
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
var SWAP_KINDS = ["synonym", "stronger", "weaker", "opposite", "formal", "casual", "shift"];
var SWAP_SYSTEM = `You help probe a text classifier. You receive a sentence with one span wrapped in \u27E6 \u27E7 and the questions the classifier answers about the sentence.
Propose 12 replacements for the span. Each must drop into the sentence exactly where the span is, with nothing else changed, and read naturally (keep the grammatical role and inflection; 1 to 4 words; no punctuation).
Cover a spread of kinds:
- synonym: near-identical meaning
- stronger / weaker: same meaning, more or less intense
- opposite: reverses the meaning or stance
- formal / casual: same meaning, different register
- shift: changes what the sentence is about or asks for (e.g. "fixed" \u2192 "removed", "refunded", "redesigned")
Include some you expect to flip the classifier's answers and some you expect to leave them unchanged. Never repeat the original span.
Reply with JSON only: {"alternatives":[{"text":string,"kind":"synonym"|"stronger"|"weaker"|"opposite"|"formal"|"casual"|"shift"}]}`;
var SWAP_SCHEMA = {
  type: "object",
  properties: {
    alternatives: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, kind: { type: "string", enum: [...SWAP_KINDS] } },
        required: ["text", "kind"],
        additionalProperties: false
      }
    }
  },
  required: ["alternatives"],
  additionalProperties: false
};

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
      if (finish === "length") maxTokens = Math.min(maxTokens * 2, 16e3);
    }
    throw new Error(`Model did not return JSON (${lastError.slice(0, 200)})`);
  });
}

// src/services/systemone.ts
var S1_MODELS = {
  jev: { label: "Jev", provider: "TypeSafe", batch: 60 },
  kev: { label: "Kev", provider: "OpenRouter", batch: 24 }
};
var S1_ORDER = ["jev", "kev"];
var activeModels = () => S1_ORDER.filter((m) => settings.s1.includes(m));
var primaryModel = () => activeModels()[0] ?? "jev";
function hasS1Access(model) {
  if (model === "jev") return !!settings.tsKey || proxy.hasJevKey;
  return !!settings.orKey || proxy.hasLlmKey;
}
function target(model) {
  if (model === "jev") {
    const custom = settings.jevEndpoint && settings.jevEndpoint !== "auto" ? settings.jevEndpoint : "";
    return { url: custom || (proxy.available ? "/api/jev" : JEV_DIRECT_URL), key: settings.tsKey, model: settings.jevModel };
  }
  const useProxy = proxy.available && !settings.orKey;
  return { url: useProxy ? "/api/kev" : OPENROUTER_SYSTEMONE_URL, key: settings.orKey, model: settings.kevModel };
}
var MAX_CONCURRENT = 4;
var active2 = { jev: 0, kev: 0 };
var waiting2 = { jev: [], kev: [] };
async function systemOne(model, state, questions) {
  while (active2[model] >= MAX_CONCURRENT) await new Promise((resolve) => waiting2[model].push(resolve));
  active2[model]++;
  try {
    return await request(model, state, questions);
  } finally {
    active2[model]--;
    waiting2[model].shift()?.();
  }
}
async function request(model, state, questions) {
  const { url, key: key2, model: checkpoint } = target(model);
  const name = S1_MODELS[model].label;
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (key2) headers.Authorization = `Bearer ${key2}`;
  let r = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ model: checkpoint, state, questions }) });
    } catch {
      throw new Error(proxy.available ? `Could not reach ${name} through the local proxy` : `Browser could not reach ${name} directly (CORS). Open the page from jev_proxy.py.`);
    }
    if (r.status !== 429 && r.status < 500) break;
    await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
  }
  if (r && r.status === 404 && url.startsWith("/api/")) throw new Error(`${name}: the running jev_proxy.py is an older version without this route. Stop it and start it again.`);
  if (!r || !r.ok) throw new Error(`${name} ${r?.status ?? ""}: ${r ? (await r.text()).slice(0, 180) : "no response"}`);
  const data = await r.json();
  return data.answers ?? {};
}
async function systemOneBatched(model, state, questions, size = S1_MODELS[model].batch) {
  const parts = chunk(Object.entries(questions), size);
  const results = await Promise.all(parts.map((part) => systemOne(model, state, Object.fromEntries(part))));
  return Object.assign({}, ...results);
}

// src/dataset/prompts.ts
var DESIGN_SYSTEM = `You are a senior annotation-scheme designer. You are building a small evaluation set for System-1 text classifiers (such as Jev and Kev). A System-1 classifier reads one short message and answers multiple-choice questions about it, returning a probability for every option. It judges only the text it is given, using the question wording and each option's one-sentence description, so those descriptions are the decision boundaries.

The set will be explored interactively. A researcher takes each message, dials individual words (stronger or weaker, more positive or negative, synonyms, words that shift the topic) and watches whether the classifiers' answers move. So the scheme must be realistic for the domain and sensitive to wording: a single changed word should be able to move at least one answer.

STEP 1 \u2014 Understand the setting.
From the user's description, infer who writes these messages, to whom, through which channel, and what the person or system reading them must decide (route to a team, prioritise, reply, refund, escalate, flag for compliance...). Name that downstream decision explicitly. Good questions are the ones that decision depends on.

STEP 2 \u2014 Design exactly {Q} questions with this mix:
- CONTENT (at least two, categorical): what the message is about or asks for. Use the real taxonomy an operations team in this domain uses, not generic labels. Examples: issue type, product area, order status the writer reports, requested action, department to route to, feature mentioned.
- AFFECT (one, a scale): sentiment, frustration, satisfaction, politeness or tone. Pick whichever matters most for the downstream decision.
- OPERATIONAL (one): urgency, escalation risk, churn risk, required response time, or next best action.
- If more questions are needed, add another independent dimension (customer tenure signals, compliance or safety risk, sarcasm, confidence of the claim, who is blamed). No two questions may measure the same thing.

STEP 3 \u2014 Options.
- 3 to 7 options per question, mutually exclusive, together covering nearly every realistic message.
- Categorical questions end with "other" (or "not mentioned" for questions about a detail the message may omit) when the taxonomy is open.
- Scales are ordered from one end to the other (e.g. very negative, negative, neutral, positive, very positive), and each step must be distinguishable in text.
- Labels: 1 to 3 words, lowercase. Descriptions: one sentence stating the boundary with a concrete textual cue ("mentions a tracking number that hasn't updated", "threatens to cancel or leave", "asks for money back").
- Avoid options that would almost never be chosen. Avoid "mixed" or "hybrid" options unless mixing is a real, common case in this domain.

Worked example for "customer messages to an online shoe store":
- Issue Type (category): delivery, returns & refunds, product defect, sizing & fit, payment & billing, account access, other
- Order Status Reported (category): not yet shipped, in transit, delayed, delivered, lost, not mentioned
- Sentiment (scale): very negative, negative, neutral, positive, very positive
- Urgency (scale): low, normal, high, critical
This is only an illustration of depth and specificity; design for the user's actual domain.

Also return a dataset title (2 to 5 words), a one-sentence summary, and the setting (speaker, recipient, channel, decision).

Reply with JSON only: {"title":string,"summary":string,"setting":{"speaker":string,"recipient":string,"channel":string,"decision":string},"questions":[{"name":string,"question":string,"kind":"category"|"scale","options":[{"label":string,"description":string}]}]}`;
var DESIGN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    setting: {
      type: "object",
      properties: { speaker: { type: "string" }, recipient: { type: "string" }, channel: { type: "string" }, decision: { type: "string" } },
      required: ["speaker", "recipient", "channel", "decision"],
      additionalProperties: false
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          question: { type: "string" },
          kind: { type: "string", enum: ["category", "scale"] },
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
        required: ["name", "question", "kind", "options"],
        additionalProperties: false
      }
    }
  },
  required: ["title", "summary", "setting", "questions"],
  additionalProperties: false
};
var ITEMS_SYSTEM = `You write realistic example messages for an evaluation set. You receive the setting (who writes, to whom, through which channel, what the reader must decide) and a classification scheme of several questions with options and boundary descriptions. Write messages exactly as real people in this setting would write them.

COVERAGE is the most important requirement.
- Every option of every question must be the intended answer for at least one message. Spread the rest so no option dominates: roughly balanced for categorical questions; for scales, cover both extremes and the middle.
- Vary combinations. Do not always pair the same labels (not every angry message is about delivery, not every polite one is low urgency). Include some surprising but realistic combinations, such as a polite message with critical urgency, or a positive message that still reports a defect.
- About one in five messages should be borderline: a careful annotator could hesitate between two options of one question. Mark those "borderline" and say in the note which two options compete.

REALISM and VARIETY.
- Length 6 to 40 words; most between 12 and 25. Mix one-sentence messages with two- or three-sentence ones.
- Vary register (formal, casual, terse, rambling), who is writing ("I", "we", "my mom ordered"), and emotional temperature. A few can have lowercase starts, missing punctuation or one mild typo, as real messages do.
- Use concrete domain details: made-up order or ticket numbers (like #48213), product or plan names, dates, amounts, times. Never use real people's names, emails or phone numbers.
- Every message must contain at least one evaluative or intensity word that could be dialed stronger or weaker ("slow", "really", "disappointed", "great", "annoying", "a bit", "urgent"). The researcher will dial these words.
- Do not start two messages with the same word, and do not reuse distinctive phrases across messages.

LABELS.
- For every message, give the intended label for every question, using the exact option labels from the scheme.
- The label must follow from the text alone, judged by the option descriptions. If a detail is not in the text, choose the option for its absence (like "not mentioned") rather than guessing.

Reply with JSON only: {"items":[{"text":string,"labels":[{"question":string,"label":string}],"difficulty":"typical"|"borderline","note":string}]}`;
var ITEMS_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          labels: {
            type: "array",
            items: {
              type: "object",
              properties: { question: { type: "string" }, label: { type: "string" } },
              required: ["question", "label"],
              additionalProperties: false
            }
          },
          difficulty: { type: "string", enum: ["typical", "borderline"] },
          note: { type: "string" }
        },
        required: ["text", "labels", "difficulty", "note"],
        additionalProperties: false
      }
    }
  },
  required: ["items"],
  additionalProperties: false
};
var DATASET_PRESETS = [
  {
    name: "E-commerce support",
    description: "Customer messages sent through the chat widget of a mid-sized online store that sells clothing and shoes. They ask about orders, deliveries, returns, sizing, payments and their accounts. The support team needs to route each message to the right queue and decide how quickly to answer."
  },
  {
    name: "SaaS bug reports",
    description: "In-app feedback and bug reports from users of a project-management web app (boards, tasks, integrations, billing). Product and support triage them into the right team, judge severity, and decide whether to reply, fix or escalate."
  },
  {
    name: "Bank chat",
    description: "Messages to a retail bank\u2019s support chat about cards, transfers, fees, fraud, loans and the mobile app. Agents must spot fraud or compliance risk, route to the right team and prioritise."
  },
  {
    name: "Restaurant reviews",
    description: "Short online reviews of a neighbourhood restaurant covering food, service, price, ambience and wait times. The owner wants to know what each review is about, how the guest felt, and whether to respond publicly."
  },
  {
    name: "Employee feedback",
    description: "Anonymous comments from a quarterly employee survey at a 500-person tech company about managers, workload, pay, tools, culture and career growth. HR wants to group comments by theme, gauge morale and flag anything needing urgent follow-up."
  }
];

// src/dataset/normalize.ts
var str = (v) => typeof v === "string" ? v.trim() : "";
function normalizeDesign(raw, questionCount) {
  const specs = normalizeQuestions(raw.questions, questionCount);
  return {
    title: str(raw.title) || "Untitled dataset",
    summary: str(raw.summary),
    setting: {
      speaker: str(raw.setting?.speaker),
      recipient: str(raw.setting?.recipient),
      channel: str(raw.setting?.channel),
      decision: str(raw.setting?.decision)
    },
    specs
  };
}
var squash = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function matchSpec(specs, name) {
  const key2 = squash(name);
  return specs.find((s) => squash(s.name) === key2) ?? specs.find((s) => squash(s.name).includes(key2) || key2.includes(squash(s.name)));
}
function matchOption(spec, label) {
  const key2 = squash(label);
  const exact = spec.options.find((o) => squash(o.label) === key2);
  if (exact) return exact.label;
  return spec.options.find((o) => squash(o.label).startsWith(key2) || key2.startsWith(squash(o.label)))?.label;
}
function normalizeItems(raw, specs) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const it of raw.items ?? []) {
    const text = str(it.text).replace(/\s+/g, " ");
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    const labels = {};
    for (const l of it.labels ?? []) {
      const spec = matchSpec(specs, str(l.question));
      const label = spec && matchOption(spec, str(l.label));
      if (spec && label) labels[spec.id] = label;
    }
    out.push({ id: uid(), text, labels, difficulty: it.difficulty === "borderline" ? "borderline" : "typical", note: str(it.note) });
  }
  return out;
}
function coverageOf(specs, items) {
  const cov = {};
  for (const s of specs) {
    cov[s.id] = Object.fromEntries(s.options.map((o) => [o.label, 0]));
    for (const it of items) {
      const label = it.labels[s.id];
      if (label && label in cov[s.id]) cov[s.id][label]++;
    }
  }
  return cov;
}
function missingOptions(specs, items) {
  const cov = coverageOf(specs, items);
  const missing = [];
  for (const s of specs) for (const o of s.options) if (!cov[s.id][o.label]) missing.push(`${s.name}: ${o.label}`);
  return missing;
}

// src/backends/live.ts
var key = (index) => `w${index}`;
var levelScore = (a, levels) => {
  if (!a) return null;
  if (a.type === "score") return a.score;
  if (a.type !== "choice") return null;
  let s = 0;
  let total = 0;
  levels.forEach((l, i) => {
    const p = a.probabilities?.[l] ?? 0;
    s += i * p;
    total += p;
  });
  return total > 0 ? s / total : null;
};
var levelCriteria = (levels) => Object.fromEntries(levels.map((l) => [l, null]));
async function tagWithS1(model, sentence, words) {
  const state = { sentence, words: Object.fromEntries(words.map((w) => [key(w.index), w.text])) };
  const kindQuestions = {};
  for (const w of words) {
    kindQuestions[key(w.index)] = {
      type: "choice",
      instructions: `Look at the word \`words.${key(w.index)}\` exactly as it is used in \`sentence\`. Could a writer dial it up or down on a scale by swapping in a different word, without changing what the sentence is about?`,
      criteria: WORD_KIND_CRITERIA
    };
  }
  const kinds = await systemOneBatched(model, state, kindQuestions);
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
    scoreQuestions[key(word.index)] = kind === "degree" ? { type: "choice", instructions: `How strong a degree does \`words.${key(word.index)}\` express as used in \`sentence\`?`, criteria: levelCriteria(DEGREE_LEVELS) } : { type: "choice", instructions: `How negative or positive does \`words.${key(word.index)}\` read as used in \`sentence\`?`, criteria: levelCriteria(VALENCE_LEVELS) };
  }
  const scores = await systemOneBatched(model, state, scoreQuestions);
  return flagged.map(({ word, kind, confidence }) => {
    const s = levelScore(scores[key(word.index)], kind === "degree" ? DEGREE_LEVELS : VALENCE_LEVELS);
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
var criteriaOf = (spec) => Object.fromEntries(spec.options.map((o) => [o.label, o.description || null]));
function distributionOf(spec, answer) {
  const probs = answer?.type === "choice" ? answer.probabilities : answer?.type === "score" ? answer.probabilities : void 0;
  return normalizeDistribution(spec, probs);
}
var liveBackend = {
  id: "live",
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
  async classify(sentence, specs, model) {
    const questions = {};
    for (const spec of specs) {
      questions[spec.id] = { type: "choice", instructions: `${spec.question} Answer about \`sentence\`.`, criteria: criteriaOf(spec) };
    }
    const answers = await systemOne(model, { sentence }, questions);
    return Object.fromEntries(specs.map((spec) => [spec.id, distributionOf(spec, answers[spec.id])]));
  },
  async classifyMany(sentences, specs, model) {
    const state = { sentences: Object.fromEntries(sentences.map((s, i) => [`v${i}`, s])) };
    const questions = {};
    sentences.forEach((_, i) => {
      for (const spec of specs) {
        questions[`v${i}_${spec.id}`] = {
          type: "choice",
          instructions: `${spec.question} Answer about \`sentences.v${i}\` on its own; the other sentences are unrelated variants.`,
          criteria: criteriaOf(spec)
        };
      }
    });
    const answers = await systemOneBatched(model, state, questions);
    return sentences.map((_, i) => Object.fromEntries(specs.map((spec) => [spec.id, distributionOf(spec, answers[`v${i}_${spec.id}`])])));
  },
  async proposeSwaps(req) {
    const questions = req.specs.map((s) => ({ name: s.name, question: s.question, options: s.options.map((o) => o.label) }));
    const res = await chatJSON(
      [
        { role: "system", content: SWAP_SYSTEM },
        { role: "user", content: JSON.stringify({ sentence: req.marked, span: req.word, classifier_questions: questions }, null, 1) }
      ],
      SWAP_SCHEMA,
      { maxTokens: 2500, temperature: 0.8 }
    );
    const seen = /* @__PURE__ */ new Set([req.word.toLowerCase()]);
    const out = [];
    for (const alt of res.alternatives ?? []) {
      const text = String(alt.text ?? "").trim().replace(/^["'“”]+|["'“”.,;:!?]+$/g, "");
      if (!text || seen.has(text.toLowerCase()) || text.split(/\s+/).length > 5) continue;
      seen.add(text.toLowerCase());
      const kind = SWAP_KINDS.includes(alt.kind ?? "") ? alt.kind : "synonym";
      out.push({ text, kind });
    }
    if (!out.length) throw new Error("The model did not propose any usable alternatives");
    return out;
  },
  async designDataset(description, questionCount) {
    const res = await chatJSON(
      [
        { role: "system", content: DESIGN_SYSTEM.replace("{Q}", String(questionCount)) },
        { role: "user", content: `Dataset description:
${description}

Design exactly ${questionCount} questions.` }
      ],
      DESIGN_SCHEMA,
      { model: settings.questionModel, fallbacks: QUESTION_FALLBACK_LLMS, reasoning: "medium", maxTokens: 5e3, temperature: 0.5 }
    );
    return normalizeDesign(res, questionCount);
  },
  async writeDatasetItems(design, count, focus) {
    const payload = {
      dataset: { title: design.title, summary: design.summary },
      setting: design.setting,
      questions: design.specs.map((s) => ({ name: s.name, question: s.question, kind: s.kind ?? "category", options: s.options.map((o) => ({ label: o.label, description: o.description })) })),
      count,
      ...focus?.length ? {
        focus: {
          instruction: "These options currently have no example. Write only messages whose intended labels include them; each listed option must be the intended answer for at least one message.",
          options: focus
        }
      } : {}
    };
    const res = await chatJSON(
      [
        { role: "system", content: ITEMS_SYSTEM },
        { role: "user", content: `Write ${count} messages.

${JSON.stringify(payload, null, 1)}` }
      ],
      ITEMS_SCHEMA,
      { model: settings.questionModel, fallbacks: QUESTION_FALLBACK_LLMS, reasoning: "medium", maxTokens: 12e3, temperature: 0.9 }
    );
    const items = normalizeItems(res, design.specs);
    if (!items.length) throw new Error("The model did not write any usable messages");
    return items;
  }
};

// src/backends/mockDataset.ts
var opts = (labels) => labels.map((label) => ({ label, description: label }));
function mockDesign(questionCount) {
  return normalizeDesign(
    {
      title: "Shoe store support",
      summary: "Chat messages from customers of an online shoe store.",
      setting: { speaker: "customer", recipient: "support team", channel: "website chat", decision: "which queue and how fast to answer" },
      questions: [
        { name: "Issue Type", question: "What is the customer\u2019s main issue?", kind: "category", options: opts(["delivery", "returns & refunds", "product defect", "sizing & fit", "payment & billing", "other"]) },
        { name: "Order Status", question: "What order status does the customer report?", kind: "category", options: opts(["not shipped", "in transit", "delayed", "delivered", "not mentioned"]) },
        { name: "Sentiment", question: "How does the customer feel?", kind: "scale", options: opts(["very negative", "negative", "neutral", "positive", "very positive"]) },
        { name: "Urgency", question: "How urgently does this need a reply?", kind: "scale", options: opts(["low", "normal", "high", "critical"]) },
        { name: "Churn Risk", question: "How likely is the customer to stop buying?", kind: "scale", options: opts(["low", "medium", "high"]) }
      ]
    },
    questionCount
  );
}
var ROWS = [
  ["My order #48213 is really late and nobody answers my emails.", "delivery", "delayed", "very negative", "high", "high", false],
  ["Tracking says delivered but the box never arrived, pretty annoying.", "delivery", "delivered", "negative", "high", "medium", false],
  ["Just wanted to say the boots arrived fast and fit great, thanks!", "other", "delivered", "very positive", "low", "low", false],
  ["The left sole came apart after two days. Honestly disappointed.", "product defect", "delivered", "negative", "normal", "medium", false],
  ["can i return the sneakers if i already wore them once? they feel a bit tight", "returns & refunds", "delivered", "neutral", "normal", "low", true],
  ["Size 42 runs small, could you swap them for a 43 please?", "sizing & fit", "delivered", "neutral", "normal", "low", false],
  ["I was charged twice for order #51107. Please fix this urgently.", "payment & billing", "not mentioned", "negative", "critical", "medium", false],
  ["Still waiting for my refund after three weeks. This is ridiculous.", "returns & refunds", "not mentioned", "very negative", "high", "high", false],
  ["My order hasn\u2019t shipped yet but I need the shoes for a wedding on Saturday!", "delivery", "not shipped", "negative", "critical", "medium", false],
  ["Package is in transit, just curious about the rough delivery date.", "delivery", "in transit", "neutral", "low", "low", false],
  ["Love the new loafers, slightly narrow though. Do you have wide sizes?", "sizing & fit", "delivered", "positive", "low", "low", true],
  ["The zipper broke immediately, really poor quality for that price.", "product defect", "delivered", "very negative", "normal", "high", false],
  ["Payment keeps failing at checkout with my card, kind of frustrating.", "payment & billing", "not mentioned", "negative", "high", "medium", false],
  ["Quick question: do you ship to Norway?", "other", "not mentioned", "neutral", "low", "low", false],
  ["Return label worked perfectly, great service as always.", "returns & refunds", "not mentioned", "very positive", "low", "low", false],
  ["Order #60021 has been stuck in transit for ten days, getting worried.", "delivery", "delayed", "negative", "high", "medium", true],
  ["These runners are amazing but half a size too big. Exchange?", "sizing & fit", "delivered", "positive", "normal", "low", false],
  ["Your courier left my parcel in the rain. Shoes are soaked and ruined.", "product defect", "delivered", "very negative", "high", "high", true],
  ["Never shopping here again, worst experience ever.", "other", "not mentioned", "very negative", "normal", "high", true],
  ["Could you tell me when the sandals will ship? No rush.", "delivery", "not shipped", "neutral", "low", "low", false]
];
function mockItems(design, count) {
  const names = ["Issue Type", "Order Status", "Sentiment", "Urgency", "Churn Risk"];
  const raw = {
    items: ROWS.slice(0, count).map((r) => ({
      text: r[0],
      labels: r.slice(1, 6).map((label, i) => ({ question: names[i], label: String(label) })),
      difficulty: r[6] ? "borderline" : "typical",
      note: r[6] ? "Could reasonably be read two ways." : ""
    }))
  };
  return normalizeItems(raw, design.specs);
}

// src/backends/mock.ts
var EVALUATIVE_SCALES = [
  ["abysmal", "terrible", "bad", "poor", "meh", "okay", "fine", "decent", "good", "great", "excellent", "amazing", "phenomenal"],
  ["glacial", "painfully slow", "slow", "a bit slow", "unhurried", "prompt", "quick", "lightning-fast"],
  ["furious", "irritated", "annoyed", "a little impatient", "neutral", "calm", "cheerful", "delighted"],
  ["hate", "dislike", "tolerate", "like", "enjoy", "love", "adore"],
  ["boring", "dull", "fine", "interesting", "fascinating", "riveting"]
];
var MOCK_SWAPS = ["need", "demand", "would like", "would appreciate", "wish", "require", "hope", "expect", "insist", "prefer"];
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
  async designDataset(_description, questionCount) {
    await sleep(900);
    return mockDesign(questionCount);
  },
  async writeDatasetItems(design, count) {
    await sleep(1200);
    return mockItems(design, count);
  },
  async classifyMany(sentences, specs, model) {
    return Promise.all(sentences.map((s) => this.classify(s, specs, model)));
  },
  async proposeSwaps(req) {
    await sleep(500);
    const hit = locate(req.word);
    const pool = hit ? hit.scale.filter((w) => w !== req.word.toLowerCase()) : MOCK_SWAPS;
    return pool.slice(0, 10).map((text, i) => ({ text, kind: ["synonym", "stronger", "weaker", "opposite", "formal", "casual", "shift"][i % 7] }));
  },
  async classify(sentence, specs, model) {
    await sleep(250 + Math.random() * 200);
    const raw = sentenceValence(sentence);
    const v = model === "kev" ? Math.max(-1, Math.min(1, raw * 0.6 - 0.15)) : raw;
    const width = model === "kev" ? 1.6 : 0.9;
    return Object.fromEntries(
      specs.map((spec) => {
        const n = spec.options.length;
        const center = (1 - v) / 2 * (n - 1);
        const raw2 = Object.fromEntries(spec.options.map((o, i) => [o.label, Math.exp(-((i - center) ** 2) / width)]));
        return [spec.id, normalizeDistribution(spec, raw2)];
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
  questions: svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
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

// src/dataset/generate.ts
var MAX_EXTRA = 8;
async function generateDataset(backend, opts2) {
  opts2.onStage?.("design");
  const design = await backend.designDataset(opts2.description, opts2.questionCount);
  opts2.onStage?.("write", `${design.specs.length} questions`);
  let items = await backend.writeDatasetItems(design, opts2.count);
  const missing = missingOptions(design.specs, items);
  if (missing.length) {
    opts2.onStage?.("fill", `${missing.length} option${missing.length > 1 ? "s" : ""} without an example`);
    try {
      const extra = await backend.writeDatasetItems(design, Math.min(MAX_EXTRA, Math.max(2, Math.ceil(missing.length / 2))), missing);
      const known = new Set(items.map((i) => i.text.toLowerCase()));
      items = [...items, ...extra.filter((i) => !known.has(i.text.toLowerCase()))];
    } catch {
    }
  }
  opts2.onStage?.("done");
  return { ...design, id: uid(), description: opts2.description, items, createdAt: Date.now() };
}
async function regenerateItems(backend, dataset, count, onStage) {
  onStage?.("write", `${dataset.specs.length} questions`);
  let items = await backend.writeDatasetItems(dataset, count);
  const missing = missingOptions(dataset.specs, items);
  if (missing.length) {
    onStage?.("fill", `${missing.length} option${missing.length > 1 ? "s" : ""} without an example`);
    try {
      const extra = await backend.writeDatasetItems(dataset, Math.min(MAX_EXTRA, Math.max(2, Math.ceil(missing.length / 2))), missing);
      const known = new Set(items.map((i) => i.text.toLowerCase()));
      items = [...items, ...extra.filter((i) => !known.has(i.text.toLowerCase()))];
    } catch {
    }
  }
  onStage?.("done");
  return { ...dataset, items, createdAt: Date.now() };
}

// src/dataset/store.ts
var KEY = "datasets";
var LIMIT = 12;
var datasetStore = {
  list() {
    return storage.getJSON(KEY, []);
  },
  save(dataset) {
    const rest = this.list().filter((d) => d.id !== dataset.id);
    storage.setJSON(KEY, [dataset, ...rest].slice(0, LIMIT));
  },
  remove(id) {
    storage.setJSON(
      KEY,
      this.list().filter((d) => d.id !== id)
    );
  },
  get(id) {
    return this.list().find((d) => d.id === id);
  }
};

// src/dataset/DatasetPage.ts
var STAGES = [
  { stage: "design", label: "Designing questions" },
  { stage: "write", label: "Writing sentences" },
  { stage: "fill", label: "Filling coverage gaps" }
];
var COUNTS = [10, 20, 30];
var QUESTION_COUNTS = [3, 4, 5];
function select(id, values, initial) {
  const el2 = h("select", { attrs: { id } }, ...values.map((v) => h("option", { text: String(v), attrs: { value: String(v) } })));
  el2.value = String(initial);
  return el2;
}
var DatasetPage = class {
  constructor(deps) {
    this.deps = deps;
    const presets = h(
      "div",
      { class: "chips" },
      ...DATASET_PRESETS.map(
        (p) => h("button", {
          class: "chip",
          text: p.name,
          on: {
            click: () => {
              this.desc.value = p.description;
              this.desc.focus();
            }
          }
        })
      )
    );
    this.goBtn.addEventListener("click", () => void this.generate());
    this.desc.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        void this.generate();
      }
    });
    const form = h(
      "div",
      { class: "ds-form" },
      presets,
      this.desc,
      h(
        "div",
        { class: "ds-row" },
        h("label", { class: "ds-opt", attrs: { for: "ds-count" } }, "Sentences", this.countSel),
        h("label", { class: "ds-opt", attrs: { for: "ds-questions" } }, "Questions", this.qSel),
        h("span", { class: "grow" }),
        this.goBtn
      )
    );
    this.el.append(form, this.progress, this.result, this.history);
    this.renderProgress();
    const last = datasetStore.list()[0];
    if (last) this.show(last);
    this.renderHistory();
  }
  el = h("section", { class: "dataset-page" });
  desc = h("textarea", {
    class: "ds-desc",
    attrs: { id: "ds-desc", rows: "4", spellcheck: "true", placeholder: "Who writes these messages, to whom, about what, and what the reader has to decide\u2026", "aria-label": "Dataset description" }
  });
  countSel = select("ds-count", COUNTS, 20);
  qSel = select("ds-questions", QUESTION_COUNTS, 4);
  goBtn = h("button", { class: "btn primary", text: "Generate" });
  progress = h("ol", { class: "ds-progress" });
  result = h("div", { class: "ds-result" });
  history = h("div", { class: "ds-history" });
  current = null;
  busy = false;
  stage = null;
  stageDetail = "";
  async generate() {
    const description = this.desc.value.trim();
    if (this.busy) return;
    if (description.length < 12) {
      toast("Describe the dataset in a sentence or two first.");
      this.desc.focus();
      return;
    }
    this.setBusy(true);
    try {
      const dataset = await generateDataset(this.deps.backend(), {
        description,
        count: Number(this.countSel.value),
        questionCount: Number(this.qSel.value),
        onStage: (stage, detail) => this.setStage(stage, detail)
      });
      datasetStore.save(dataset);
      this.show(dataset);
      this.renderHistory();
    } catch (err) {
      toast(errorMessage(err));
      this.setStage(null);
    } finally {
      this.setBusy(false);
    }
  }
  async regenerate() {
    const ds = this.current;
    if (!ds || this.busy) return;
    this.setBusy(true);
    try {
      const next = await regenerateItems(this.deps.backend(), ds, Number(this.countSel.value), (stage, detail) => this.setStage(stage, detail));
      datasetStore.save(next);
      this.show(next);
      this.renderHistory();
    } catch (err) {
      toast(errorMessage(err));
      this.setStage(null);
    } finally {
      this.setBusy(false);
    }
  }
  setBusy(busy) {
    this.busy = busy;
    this.goBtn.disabled = busy;
    this.goBtn.textContent = busy ? "Generating\u2026" : "Generate";
    this.el.classList.toggle("busy", busy);
  }
  setStage(stage, detail = "") {
    this.stage = stage;
    this.stageDetail = detail;
    this.renderProgress();
  }
  renderProgress() {
    const order = ["design", "write", "fill", "done"];
    const at = this.stage ? order.indexOf(this.stage) : -1;
    this.progress.hidden = this.stage === null;
    this.progress.replaceChildren(
      ...STAGES.map((s) => {
        const i = order.indexOf(s.stage);
        const state = at > i || this.stage === "done" ? "done" : at === i ? "active" : "todo";
        return h("li", { class: state }, h("span", { class: "dot" }), h("span", { text: s.label }), state === "active" && this.stageDetail ? h("span", { class: "detail", text: this.stageDetail }) : null);
      })
    );
  }
  show(ds) {
    this.current = ds;
    this.desc.value = ds.description;
    const cov = coverageOf(ds.specs, ds.items);
    const setting = [ds.setting.speaker && `${ds.setting.speaker} \u2192 ${ds.setting.recipient}`, ds.setting.channel, ds.setting.decision && `decides ${ds.setting.decision}`].filter(Boolean).join(" \xB7 ");
    const borderline = ds.items.filter((i) => i.difficulty === "borderline").length;
    const gaps = ds.specs.reduce((n, s) => n + s.options.filter((o) => !cov[s.id][o.label]).length, 0);
    const head = h(
      "div",
      { class: "ds-head" },
      h("div", { class: "ds-title" }, h("h2", { text: ds.title }), ds.summary ? h("p", { text: ds.summary }) : null, setting ? h("p", { class: "ds-setting", text: setting }) : null),
      h(
        "div",
        { class: "ds-actions" },
        h("button", { class: "btn primary", text: "Open in playground", attrs: { title: "Replace the playground cards with these sentences" }, on: { click: () => this.deps.onOpen(ds, "replace") } }),
        h("button", { class: "btn", text: "Add to playground", on: { click: () => this.deps.onOpen(ds, "append") } }),
        h("button", { class: "btn ghost", text: "New sentences", attrs: { title: "Keep the questions, write new sentences" }, on: { click: () => void this.regenerate() } })
      )
    );
    const stats = h(
      "div",
      { class: "ds-stats" },
      h("span", {}, h("b", { text: String(ds.items.length) }), " sentences"),
      h("span", {}, h("b", { text: String(ds.specs.length) }), " questions"),
      h("span", {}, h("b", { text: String(borderline) }), " borderline"),
      h("span", { class: gaps ? "bad" : "good" }, h("b", { text: String(gaps) }), gaps === 1 ? " option without an example" : " options without an example")
    );
    const questions = h("div", { class: "ds-questions" }, ...ds.specs.map((s) => this.renderQuestion(s, cov[s.id])));
    const rows = ds.items.map((item, n) => {
      const labels = h("div", { class: "ds-labels" }, ...ds.specs.map((s) => item.labels[s.id] ? h("span", { class: "ds-label", attrs: { title: s.name } }, h("i", { text: s.name }), item.labels[s.id]) : null));
      const remove = h("button", { class: "icon-btn sm", html: icons.close, attrs: { title: "Remove sentence", "aria-label": "Remove sentence" } });
      remove.addEventListener("click", () => {
        const next = { ...ds, items: ds.items.filter((i) => i.id !== item.id) };
        datasetStore.save(next);
        this.show(next);
        this.renderHistory();
      });
      return h(
        "li",
        { class: `ds-item${item.difficulty === "borderline" ? " borderline" : ""}` },
        h("span", { class: "ds-n", text: String(n + 1) }),
        h(
          "div",
          { class: "ds-body" },
          h("p", { class: "ds-text", text: item.text }),
          labels,
          item.difficulty === "borderline" ? h("p", { class: "ds-note" }, h("span", { class: "pill warn", text: "borderline" }), item.note) : null
        ),
        remove
      );
    });
    this.result.replaceChildren(head, stats, questions, h("ol", { class: "ds-items" }, ...rows));
  }
  renderQuestion(spec, counts) {
    const max = Math.max(1, ...Object.values(counts));
    return h(
      "section",
      { class: "ds-q" },
      h("h3", { attrs: { title: spec.question } }, spec.name, spec.kind ? h("span", { class: "pill", text: spec.kind }) : null),
      h(
        "div",
        { class: "ds-cov" },
        ...spec.options.map((o) => {
          const n = counts[o.label] ?? 0;
          return h(
            "div",
            { class: `ds-cov-row${n ? "" : " empty"}`, attrs: { title: o.description } },
            h("span", { class: "l", text: o.label }),
            h("div", { class: "track" }, h("div", { class: "fill", style: { width: `${n / max * 100}%` } })),
            h("span", { class: "v", text: String(n) })
          );
        })
      )
    );
  }
  renderHistory() {
    const list = datasetStore.list();
    this.history.hidden = !list.length;
    this.history.replaceChildren(
      h("h3", { text: "Saved datasets" }),
      h(
        "ul",
        {},
        ...list.map((ds) => {
          const open = h("button", { class: "ds-hist-open" }, h("span", { class: "t", text: ds.title }), h("span", { class: "m", text: `${ds.items.length} sentences \xB7 ${new Date(ds.createdAt).toLocaleDateString(void 0, { month: "short", day: "numeric" })}` }));
          open.addEventListener("click", () => {
            this.setStage(null);
            this.show(ds);
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
          const del = h("button", { class: "icon-btn sm", html: icons.close, attrs: { title: "Delete dataset", "aria-label": `Delete ${ds.title}` } });
          del.addEventListener("click", () => {
            datasetStore.remove(ds.id);
            if (this.current?.id === ds.id) {
              this.current = null;
              this.result.replaceChildren();
            }
            this.renderHistory();
          });
          return h("li", { class: this.current?.id === ds.id ? "on" : "" }, open, del);
        })
      )
    );
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
var ROUTES = [
  { route: "playground", label: "Playground", hash: "#/" },
  { route: "dataset", label: "Dataset", hash: "#/dataset" }
];
var THEME_ICON = { system: icons.system, light: icons.sun, dark: icons.moon };
var THEME_LABEL = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" };
var Header = class {
  el;
  themeBtn;
  soundBtn;
  modePill;
  tabs = /* @__PURE__ */ new Map();
  s1Buttons = /* @__PURE__ */ new Map();
  constructor(onOpenSettings) {
    this.themeBtn = h("button", { class: "icon-btn", on: { click: () => updateSettings({ theme: nextTheme(settings.theme) }) } });
    this.soundBtn = h("button", { class: "icon-btn", on: { click: () => updateSettings({ sound: !settings.sound }) } });
    const gear = h("button", { class: "icon-btn", html: icons.settings, attrs: { title: "Settings", "aria-label": "Settings" }, on: { click: onOpenSettings } });
    this.modePill = h("span", { class: "pill", text: "demo" });
    this.el = h(
      "header",
      { class: "topbar" },
      h("div", { class: "brand" }, h("h1", { text: "Word Dial" }), this.modePill),
      h(
        "nav",
        { class: "tabs" },
        ...ROUTES.map((r) => {
          const a = h("a", { text: r.label, attrs: { href: r.hash } });
          this.tabs.set(r.route, a);
          return a;
        })
      ),
      h(
        "div",
        { class: "s1-toggle", attrs: { role: "group", "aria-label": "System-1 models" } },
        ...S1_ORDER.map((m) => {
          const b = h("button", { class: `s1-chip m-${m}`, attrs: { title: `${S1_MODELS[m].label} (${S1_MODELS[m].provider})` } }, h("i", { class: "mdot" }), S1_MODELS[m].label);
          b.addEventListener("click", () => {
            const on = settings.s1.includes(m);
            if (on && settings.s1.length === 1) {
              replay(b, "reject");
              return;
            }
            updateSettings({ s1: on ? settings.s1.filter((x) => x !== m) : [...settings.s1, m] });
          });
          this.s1Buttons.set(m, b);
          return b;
        })
      ),
      h("div", { class: "tools" }, this.themeBtn, this.soundBtn, gear)
    );
    this.sync();
    settingsEvents.on("change", () => this.sync());
  }
  setRoute(route) {
    for (const [r, a] of this.tabs) {
      a.classList.toggle("on", r === route);
      if (r === route) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }
  sync() {
    this.themeBtn.innerHTML = THEME_ICON[settings.theme];
    this.themeBtn.title = THEME_LABEL[settings.theme];
    this.themeBtn.setAttribute("aria-label", THEME_LABEL[settings.theme]);
    this.soundBtn.innerHTML = settings.sound ? icons.soundOn : icons.soundOff;
    this.soundBtn.title = settings.sound ? "Sound on" : "Sound off";
    this.soundBtn.classList.toggle("off", !settings.sound);
    this.modePill.hidden = !settings.mock;
    for (const [m, b] of this.s1Buttons) {
      const on = settings.s1.includes(m);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    }
  }
};

// src/analysis/Histogram.ts
function inlineInput(initial, onCommit, placeholder = "") {
  const input = h("input", { class: "inline-edit", attrs: { type: "text", value: initial, placeholder, spellcheck: "false" } });
  input.value = initial;
  let done = false;
  const finish = (value) => {
    if (done) return;
    done = true;
    onCommit(value);
  };
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      finish(input.value.trim());
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      finish(null);
    }
  });
  input.addEventListener("blur", () => finish(input.value.trim()));
  queueMicrotask(() => {
    input.focus();
    input.select();
  });
  return input;
}
var Histogram = class {
  constructor(spec, edit = null, expected, models = ["jev"]) {
    this.spec = spec;
    this.edit = edit;
    this.expected = expected;
    this.models = models;
    this.el = h("section", { class: "hist" });
    this.render();
  }
  el;
  rows = /* @__PURE__ */ new Map();
  last = null;
  update(dists, baselines = {}) {
    this.last = { dists, baselines };
    const tops = /* @__PURE__ */ new Map();
    for (const m of this.models) {
      const d = dists[m];
      if (d) tops.set(m, topLabel(d));
    }
    for (const [label, row] of this.rows) {
      let anyTop = false;
      for (const m of this.models) {
        const bar = row.bars[m];
        const dist = dists[m];
        if (!bar) continue;
        const isTop = tops.get(m) === label;
        anyTop ||= isTop;
        row.root.classList.toggle(`top-${m}`, isTop);
        if (!dist) {
          bar.fill.style.width = "0%";
          bar.pct.textContent = "\u2013";
          bar.delta.textContent = "";
          bar.ghost.classList.remove("show");
          continue;
        }
        const p = dist[label] ?? 0;
        const b = baselines[m]?.[label];
        bar.fill.style.width = `${(p * 100).toFixed(1)}%`;
        bar.pct.textContent = this.models.length > 1 ? String(Math.round(p * 100)) : `${Math.round(p * 100)}%`;
        const shift = b === void 0 ? 0 : Math.round((p - b) * 100);
        bar.ghost.style.left = `${((b ?? p) * 100).toFixed(1)}%`;
        bar.ghost.classList.toggle("show", shift !== 0);
        bar.delta.textContent = shift === 0 ? "" : `${shift > 0 ? "+" : "\u2212"}${Math.abs(shift)}`;
        bar.delta.className = `delta${shift > 0 ? " up" : shift < 0 ? " down" : ""}`;
      }
      row.root.classList.toggle("top", anyTop);
    }
  }
  commit(next) {
    this.edit?.(next);
  }
  render() {
    const editable = !!this.edit;
    const name = h("span", { class: "hname", text: this.spec.name, attrs: { title: this.spec.question } });
    const title = h("h3", {}, name);
    if (editable) {
      name.classList.add("editable");
      name.addEventListener("click", () => {
        const input = inlineInput(this.spec.name, (value) => {
          if (value && value !== this.spec.name) this.commit({ ...this.spec, name: value });
          else this.render();
        });
        title.replaceChildren(input);
      });
    }
    this.rows.clear();
    const rows = this.spec.options.map((option) => this.renderRow(option.label, option.description));
    const children = [title, h("div", { class: "hrows" }, ...rows)];
    if (editable) {
      const add = h("button", { class: "add-option", text: "+ option" });
      add.addEventListener("click", () => {
        const input = inlineInput(
          "",
          (value) => {
            if (!value) return this.render();
            if (this.spec.options.some((o) => o.label.toLowerCase() === value.toLowerCase())) {
              replay(this.el, "reject");
              return this.render();
            }
            this.commit({ ...this.spec, options: [...this.spec.options, { label: value, description: "" }] });
          },
          "new option"
        );
        add.replaceWith(h("div", { class: "hrow adding" }, input));
      });
      children.push(add);
    }
    this.el.replaceChildren(...children);
    if (this.last) this.update(this.last.dists, this.last.baselines);
  }
  renderRow(label, description) {
    const bars = {};
    const tracks = h("div", { class: "tracks" });
    const values = h("div", { class: "hvals" });
    for (const m of this.models) {
      const fill = h("div", { class: "fill" });
      const ghost = h("div", { class: "ghost" });
      const pct = h("span", { class: "pct", text: "\u2013" });
      const delta = h("span", { class: "delta" });
      tracks.append(h("div", { class: `track m-${m}` }, fill, ghost));
      values.append(h("span", { class: `hval m-${m}` }, pct, delta));
      bars[m] = { fill, ghost, pct, delta };
    }
    const labelEl = h("span", { class: "hlabel", text: label, attrs: { title: description ? `${label}: ${description}` : label } });
    const parts = [labelEl, tracks, values];
    if (this.edit) {
      labelEl.classList.add("editable");
      labelEl.addEventListener("click", () => {
        const input = inlineInput(label, (value) => {
          if (value === null || value === label) return this.render();
          if (!value) return this.remove(label);
          if (this.spec.options.some((o) => o.label !== label && o.label.toLowerCase() === value.toLowerCase())) {
            replay(this.el, "reject");
            return this.render();
          }
          this.commit({ ...this.spec, options: this.spec.options.map((o) => o.label === label ? { label: value, description: "" } : o) });
        });
        labelEl.replaceChildren(input);
      });
      const remove = h("button", { class: "remove-option", text: "\xD7", attrs: { title: `Remove ${label}`, "aria-label": `Remove ${label}` } });
      remove.addEventListener("click", () => this.remove(label));
      parts.push(remove);
    }
    const root = h("div", { class: `hrow${label === this.expected ? " expected" : ""}${this.models.length > 1 ? " multi" : ""}` }, ...parts);
    if (label === this.expected) labelEl.title = `Intended label in the dataset${description ? ` \u2014 ${description}` : ""}`;
    this.rows.set(label, { root, bars });
    return root;
  }
  remove(label) {
    if (this.spec.options.length <= 2) {
      replay(this.el, "reject");
      return this.render();
    }
    this.commit({ ...this.spec, options: this.spec.options.filter((o) => o.label !== label) });
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
  setSpecs(specs, models, onEdit, expected) {
    this.histograms = specs.map((spec) => new Histogram(spec, onEdit ?? null, expected?.[spec.id], models));
    this.el.classList.toggle("multi", models.length > 1);
    this.el.dataset.count = String(specs.length);
    this.el.replaceChildren(...this.histograms.map((x) => x.el));
    this.el.classList.add("pending");
  }
  update(results, baselines) {
    for (const hist of this.histograms) {
      const id = hist.spec.id;
      const pick = (src) => Object.fromEntries(Object.entries(src).flatMap(([m, c]) => c?.[id] ? [[m, c[id]]] : []));
      hist.update(pick(results), pick(baselines));
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
function locateToken(target2) {
  if (!(target2 instanceof Element)) return null;
  const tokEl = target2.closest(".tok.dial");
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
    this.el.addEventListener("click", (ev) => {
      const el2 = ev.target instanceof Element ? ev.target.closest(".tok.word") : null;
      if (!el2 || !this.el.contains(el2)) return;
      this.events.emit("pick", { index: Number(el2.dataset.i) });
    });
    this.render();
  }
  el = h("div", { class: "dial-sentence" });
  events = new Emitter();
  tokens;
  generation = 0;
  inflight = /* @__PURE__ */ new Map();
  picked = null;
  setPicked(index) {
    this.picked = index;
    for (const t of this.tokens) t.el?.classList.toggle("picked", t.i === index);
  }
  marked(index, replacement) {
    return this.tokens.map((t) => t.i === index ? `\u27E6${replacement ?? t.text}\u27E7` : t.text).join("");
  }
  withReplacement(index, replacement) {
    return this.tokens.map((t) => t.i === index ? replacement : t.text).join("");
  }
  replaceToken(index, text) {
    const t = this.tokens[index];
    if (!t || !text.trim() || t.text === text) return;
    const dir = 1;
    t.text = text;
    t.orig = text;
    t.level = 0;
    t.limit = { up: null, down: null };
    const base = t.ladder.get(0);
    t.ladder = /* @__PURE__ */ new Map();
    if (t.kind) t.ladder.set(0, { text, valence: base?.valence ?? 0, intensity: base?.intensity ?? 0.5 });
    for (const key2 of [...this.inflight.keys()]) if (key2.split(":")[1] === String(index)) this.inflight.delete(key2);
    if (t.el) {
      if (t.kind) this.swapText(t, dir);
      else t.el.textContent = text;
      replay(t.el, "flash", 500);
    }
    this.fixArticle(t);
    this.events.emit("ladder", t);
    this.events.emit("change", { text: this.text, reason: "swap" });
  }
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
    const target2 = t.level + dir;
    if (t.ladder.has(target2)) {
      this.setLevel(t, target2, dir, "dial");
      this.prefetch(t, dir);
      return;
    }
    t.busy = true;
    t.el?.classList.add("pending", dir > 0 ? "up" : "down");
    try {
      const rung = await this.fetchRung(t, t.level, dir);
      if (!this.alive(t)) return;
      if (rung) {
        this.setLevel(t, target2, dir, "dial");
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
    const target2 = from + dir;
    const existing = t.ladder.get(target2);
    if (existing) return Promise.resolve(existing);
    const key2 = `${this.generation}:${t.i}:${target2}`;
    const pending = this.inflight.get(key2);
    if (pending) return pending;
    const current = rungOf(t, from).text;
    const request2 = {
      marked: this.tokens.map((x) => x === t ? `\u27E6${current}\u27E7` : x.text).join(""),
      current,
      ladder: [...t.ladder.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.text),
      kind: t.kind ?? "evaluative",
      dir
    };
    const promise = this.backend().nextRung(request2).then((res) => {
      this.inflight.delete(key2);
      if (!this.alive(t)) return null;
      const text = this.matchCase(t, res.replacement);
      const seen = [...t.ladder.values()].some((r) => r.text.toLowerCase() === text.toLowerCase());
      if (!text || res.atLimit || seen || text.split(/\s+/).length > 5) {
        if (dir > 0) t.limit.up = from;
        else t.limit.down = from;
        this.events.emit("ladder", t);
        return null;
      }
      const rung = { text, valence: num(res.valence, -1, 1, rungOf(t, from).valence), intensity: num(res.intensity, 0, 1, 0.5) };
      t.ladder.set(target2, rung);
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
      if (t.i === this.picked) el2.classList.add("picked");
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
    const target2 = this.target;
    if (!target2?.tok.el?.isConnected) return;
    const { dial, tok } = target2;
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
      let target2 = locateToken(ev.target);
      if (!target2 && wheelTarget && wheelTarget.dial.alive(wheelTarget.tok) && now - wheelLast < WHEEL_STICKY_MS) target2 = wheelTarget;
      if (!target2) return;
      ev.preventDefault();
      wheelLast = now;
      if (wheelTarget?.tok !== target2.tok) wheelAcc = 0;
      wheelTarget = target2;
      window.clearTimeout(wheelIdle);
      wheelIdle = window.setTimeout(() => wheelAcc = 0, 260);
      const unit = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 400 : 1;
      const dy = -ev.deltaY * unit * (settings.invertScroll ? -1 : 1);
      if (now < target2.tok.coolUntil) return;
      wheelAcc += dy;
      if (Math.abs(wheelAcc) < WHEEL_STEP_PX) return;
      const dir = Math.sign(wheelAcc);
      wheelAcc = 0;
      target2.tok.coolUntil = now + 150;
      void target2.dial.go(target2.tok, dir);
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
      drag = { ...t, y: ev.clientY, id: ev.pointerId, moved: false };
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
    drag.moved = true;
    void drag.dial.go(drag.tok, Math.sign(dy));
  });
  const endDrag = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    if (ev.pointerType !== "mouse") ladder.hide(700);
    if (drag.moved) {
      const swallow = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      document.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
    }
    drag = null;
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  addEventListener("scroll", () => ladder.reposition(), { passive: true });
  addEventListener("resize", () => ladder.reposition());
}

// src/ui/SentenceCard.ts
var SentenceCard = class {
  constructor(record, deps) {
    this.record = record;
    this.deps = deps;
    if (!record.baselines) record.baselines = record.baseline ? { jev: record.baseline } : {};
    delete record.baseline;
    this.dial = new DialSentence(record.text, deps.backend);
    const actions = h(
      "div",
      { class: "card-actions" },
      h("button", { class: "icon-btn sm", html: icons.questions, attrs: { title: "New questions", "aria-label": "New questions" }, on: { click: () => void this.regenerateQuestions() } }),
      h("button", { class: "icon-btn sm", html: icons.reset, attrs: { title: "Reset to original", "aria-label": "Reset" }, on: { click: () => this.resetToOriginal() } }),
      h("button", { class: "icon-btn sm", html: icons.close, attrs: { title: "Remove", "aria-label": "Remove" }, on: { click: () => this.deps.onRemove(this) } })
    );
    const src = record.source;
    const meta = src ? h(
      "div",
      { class: "card-meta" },
      h("span", { text: src.dataset }),
      src.difficulty === "borderline" ? h("span", { class: "pill warn", text: "borderline", attrs: { title: src.note || "Could reasonably be labelled two ways" } }) : null
    ) : null;
    this.el = h("article", { class: "card" }, actions, meta, this.dial.el, this.statusEl, this.panel.el);
    this.unsubscribe.push(
      attachDial(this.dial),
      this.dial.events.on("change", ({ text }) => {
        this.record.text = text;
        this.deps.onChange(this);
        this.panel.setBusy(true);
        this.scheduleClassify();
      }),
      this.dial.events.on("status", ({ kind, text }) => this.setStatus(kind === "idle" ? "" : text, kind === "error")),
      this.dial.events.on("warning", (message) => toast(message)),
      this.dial.events.on("pick", ({ index }) => this.deps.onPick(this, index))
    );
  }
  el;
  dial;
  events = new Emitter();
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
    this.record.baselines = {};
    this.deps.onChange(this);
    const specs = await this.prepareQuestions();
    if (specs) await this.rebaseline(specs);
  }
  get specs() {
    return this.record.specs;
  }
  async modelsChanged() {
    const specs = this.record.specs;
    if (!specs) return;
    this.showSpecs(specs);
    await this.rebaseline(specs, true);
  }
  get baselines() {
    return this.record.baselines ??= {};
  }
  showSpecs(specs) {
    this.panel.setSpecs(specs, activeModels(), (n) => this.editSpec(n), this.record.expected);
  }
  editSpec(next) {
    const specs = (this.record.specs ?? []).map((s) => s.id === next.id ? next : s);
    this.record.specs = specs;
    this.record.baselines = {};
    this.deps.onChange(this);
    this.showSpecs(specs);
    this.events.emit("specs", specs);
    void this.rebaseline(specs);
  }
  async rebaseline(specs, onlyMissing = false) {
    if (this.dial.text !== this.record.original) {
      const seq = ++this.classifySeq;
      const models = activeModels().filter((m) => !onlyMissing || !this.baselines[m]);
      const results = await Promise.allSettled(models.map((m) => this.deps.backend().classify(this.record.original, specs, m)));
      if (seq !== this.classifySeq) return;
      results.forEach((res, i) => {
        if (res.status === "fulfilled") this.baselines[models[i]] = res.value;
      });
      this.deps.onChange(this);
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
    this.events.clear();
  }
  prepareQuestions() {
    if (this.record.specs) {
      this.showSpecs(this.record.specs);
      return Promise.resolve(this.record.specs);
    }
    if (this.questionsPromise) return this.questionsPromise;
    this.panel.showSkeleton();
    this.questionsPromise = this.deps.backend().proposeQuestions(this.record.original).then((specs) => {
      this.record.specs = specs;
      this.deps.onChange(this);
      this.showSpecs(specs);
      this.events.emit("specs", specs);
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
    const models = activeModels();
    this.panel.setBusy(true);
    const settled = await Promise.allSettled(models.map((m) => this.deps.backend().classify(text, specs, m)));
    if (seq !== this.classifySeq) return;
    const results = {};
    const errors = [];
    settled.forEach((res, i) => {
      const m = models[i];
      if (res.status === "fulfilled") {
        results[m] = res.value;
        if (!this.baselines[m] && text === this.record.original) this.baselines[m] = res.value;
      } else errors.push(errorMessage(res.reason));
    });
    if (text === this.record.original) this.deps.onChange(this);
    this.panel.clearError();
    this.panel.update(results, this.baselines);
    if (errors.length) this.panel.showError(errors.join(" \xB7 "), () => void this.classify());
    this.panel.setBusy(false);
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
  { key: "jevModel", label: "Jev checkpoint" },
  { key: "kevModel", label: "Kev checkpoint" },
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
      return h("div", { class: `field${["llmModel", "questionModel", "jevModel", "kevModel"].includes(f.key) ? " half" : ""}` }, h("label", { text: f.label, attrs: { for: id } }), input, list);
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
    patch.kevModel ||= settings.kevModel;
    patch.jevEndpoint ||= "auto";
    updateSettings(patch);
  }
};

// src/ui/SwapPanel.ts
var KIND_LABEL = {
  original: "original",
  synonym: "synonym",
  stronger: "stronger",
  weaker: "weaker",
  opposite: "opposite",
  formal: "formal",
  casual: "casual",
  shift: "shift",
  custom: "yours"
};
var SwapPanel = class {
  constructor(deps) {
    this.deps = deps;
    this.el.hidden = true;
    this.input.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      const value = this.input.value;
      this.input.value = "";
      void this.addCustom(value);
    });
    const seg = h("div", { class: "seg", attrs: { role: "group", "aria-label": "Sort" } });
    for (const mode of ["kind", "flips"]) {
      const b = h("button", { text: mode === "kind" ? "By kind" : "Most flips" });
      b.addEventListener("click", () => {
        this.sort = mode;
        this.syncSort();
        this.renderBody();
      });
      this.sortButtons.set(mode, b);
      seg.append(b);
    }
    this.staleEl.append(
      h("span", { text: "The sentence changed." }),
      h("button", { class: "link", text: "Re-run for this sentence", on: { click: () => this.card && this.reopen() } })
    );
    const close = h("button", { class: "icon-btn sm", html: icons.close, attrs: { title: "Close", "aria-label": "Close swaps" }, on: { click: () => this.close() } });
    this.el.append(
      h("div", { class: "swap-head" }, h("span", { class: "swap-eyebrow", text: "Swap" }), this.wordEl, h("span", { class: "grow" }), close),
      this.contextEl,
      h("div", { class: "swap-tools" }, this.input, seg),
      this.staleEl,
      this.infoEl,
      h("div", { class: "swap-table" }, h("table", {}, this.colgroup, this.thead, this.tbody))
    );
    this.tbody.addEventListener("mouseleave", () => this.showPreview(null));
    this.resize.observe(this.contextEl);
    this.syncSort();
  }
  el = h("aside", { class: "swap", attrs: { "aria-label": "Word swaps" } });
  wordEl = h("span", { class: "swap-word" });
  contextEl = h("p", { class: "swap-context" });
  markEl = h("mark");
  input = h("input", { class: "swap-input", attrs: { type: "text", placeholder: "Try your own word\u2026", spellcheck: "false", "aria-label": "Your own replacement" } });
  sortButtons = /* @__PURE__ */ new Map();
  infoEl = h("div", { class: "swap-info" });
  staleEl = h("div", { class: "swap-stale" });
  colgroup = h("colgroup");
  thead = h("thead");
  tbody = h("tbody");
  resize = new ResizeObserver(() => {
    if (this.contextEl.clientWidth !== this.lastWidth) this.lockContextHeight();
  });
  card = null;
  index = -1;
  variants = [];
  baseIdx = 0;
  sort = "kind";
  status = "";
  stale = false;
  applying = false;
  seq = 0;
  specKey = "";
  lastWidth = 0;
  unsubscribe = [];
  open(card, index) {
    const tok = card.dial.tokens[index];
    if (!tok?.word) return;
    if (this.card === card && this.index === index && !this.stale) return;
    this.detach();
    this.card = card;
    this.index = index;
    this.variants = [{ text: tok.text, kind: "original", result: null }];
    this.baseIdx = 0;
    this.stale = false;
    this.specKey = "";
    card.dial.setPicked(index);
    this.unsubscribe.push(
      card.dial.events.on("change", ({ reason }) => {
        if (this.applying || reason === "swap") return;
        this.stale = true;
        this.renderChrome();
      }),
      card.events.on("specs", () => void this.classifyAll())
    );
    this.el.hidden = false;
    this.deps.onVisibilityChange(true);
    this.renderContext();
    this.renderChrome();
    this.renderBody();
    void this.run();
  }
  close() {
    this.detach();
    this.card = null;
    this.el.hidden = true;
    this.deps.onVisibilityChange(false);
  }
  closeIfCard(card) {
    if (this.card === card) this.close();
  }
  reopen() {
    const card = this.card;
    if (!card) return;
    this.stale = true;
    this.open(card, this.index);
  }
  detach() {
    this.seq++;
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    this.card?.dial.setPicked(null);
  }
  get specs() {
    return this.card?.specs ?? [];
  }
  get base() {
    return this.variants[this.baseIdx];
  }
  range(from, to) {
    return Array.from({ length: to - from }, (_, i) => from + i);
  }
  async run() {
    const card = this.card;
    if (!card) return;
    const seq = ++this.seq;
    this.setStatus("Finding replacements\u2026");
    const classifyOriginal = this.classifyVariants([0], seq);
    try {
      const options = await this.deps.backend().proposeSwaps({
        sentence: card.dial.text,
        marked: card.dial.marked(this.index),
        word: this.variants[0].text,
        specs: this.specs
      });
      if (seq !== this.seq) return;
      const start = this.variants.length;
      this.variants.push(...options.map((o) => ({ text: o.text, kind: o.kind, result: null })));
      this.lockContextHeight();
      this.renderBody();
      await Promise.all([classifyOriginal, this.classifyVariants(this.range(start, this.variants.length), seq)]);
    } catch (err) {
      if (seq === this.seq) this.setStatus(errorMessage(err));
    }
  }
  async classifyAll() {
    for (const v of this.variants) v.result = null;
    this.renderBody();
    await this.classifyVariants(this.range(0, this.variants.length), this.seq);
  }
  async classifyVariants(indices, seq) {
    const card = this.card;
    const specs = this.specs;
    if (!card || !indices.length) return;
    if (!specs.length) {
      this.setStatus("Waiting for this card\u2019s questions\u2026");
      return;
    }
    const models = activeModels();
    this.setStatus(`Classifying ${indices.length} variant${indices.length > 1 ? "s" : ""} with ${models.map((m) => S1_MODELS[m].label).join(" and ")}\u2026`);
    const sentences = indices.map((i) => card.dial.withReplacement(this.index, this.variants[i].text));
    const settled = await Promise.allSettled(models.map((m) => this.deps.backend().classifyMany(sentences, specs, m)));
    if (seq !== this.seq) return;
    const errors = [];
    settled.forEach((res, mi) => {
      const m = models[mi];
      if (res.status === "rejected") {
        errors.push(errorMessage(res.reason));
        return;
      }
      indices.forEach((vi, k) => {
        const v = this.variants[vi];
        const c = res.value[k];
        if (c) v.result = { ...v.result ?? {}, [m]: c };
      });
    });
    for (const vi of indices) this.variants[vi].error = !this.variants[vi].result;
    this.setStatus(errors.join(" \xB7 "));
    this.renderBody();
  }
  modelsChanged() {
    if (!this.card) return;
    this.specKey = "";
    void this.classifyAll();
  }
  async addCustom(text) {
    const clean2 = text.trim();
    if (!clean2 || !this.card) return;
    if (this.variants.some((v) => v.text.toLowerCase() === clean2.toLowerCase())) return;
    this.variants.push({ text: clean2, kind: "custom", result: null });
    this.lockContextHeight();
    this.renderBody();
    await this.classifyVariants([this.variants.length - 1], this.seq);
  }
  apply(i) {
    const card = this.card;
    const v = this.variants[i];
    if (!card || !v || i === this.baseIdx) return;
    this.applying = true;
    card.dial.replaceToken(this.index, v.text);
    this.applying = false;
    this.baseIdx = i;
    this.renderContext();
    this.renderChrome();
    this.renderBody();
    this.showPreview(null);
  }
  flipsFor(v, m) {
    const base = this.base?.result?.[m];
    const res = v.result?.[m];
    if (!base || !res) return 0;
    let n = 0;
    for (const s of this.specs) {
      const b = base[s.id];
      const r = res[s.id];
      if (b && r && topLabel(r) !== topLabel(b)) n++;
    }
    return n;
  }
  flips(v) {
    return activeModels().reduce((n, m) => n + this.flipsFor(v, m), 0);
  }
  shift(v) {
    let total = 0;
    for (const m of activeModels()) {
      const base = this.base?.result?.[m];
      const res = v.result?.[m];
      if (!base || !res) continue;
      for (const s of this.specs) {
        const b = base[s.id];
        const r = res[s.id];
        if (!b || !r) continue;
        for (const label of Object.keys(b)) total += Math.abs((r[label] ?? 0) - b[label]);
      }
    }
    return total;
  }
  ordered() {
    const rest = this.range(0, this.variants.length).filter((i) => i !== this.baseIdx);
    if (this.sort === "flips") {
      rest.sort((a, b) => this.flips(this.variants[b]) - this.flips(this.variants[a]) || this.shift(this.variants[b]) - this.shift(this.variants[a]));
    }
    return [this.baseIdx, ...rest];
  }
  setStatus(text) {
    this.status = text;
    this.renderChrome();
  }
  syncSort() {
    for (const [mode, b] of this.sortButtons) b.classList.toggle("on", mode === this.sort);
  }
  renderContext() {
    const card = this.card;
    if (!card) return;
    this.wordEl.textContent = this.base.text;
    this.markEl.textContent = this.base.text;
    this.markEl.classList.remove("preview");
    const before = card.dial.tokens.slice(0, this.index).map((t) => t.text).join("");
    const after = card.dial.tokens.slice(this.index + 1).map((t) => t.text).join("");
    this.contextEl.replaceChildren(before, this.markEl, after);
    this.lockContextHeight();
  }
  lockContextHeight() {
    if (this.el.hidden || !this.card) return;
    const width = this.contextEl.clientWidth;
    if (!width) return;
    const shown = this.markEl.textContent;
    this.contextEl.style.minHeight = "";
    let max = this.contextEl.offsetHeight;
    for (const v of this.variants) {
      this.markEl.textContent = v.text;
      max = Math.max(max, this.contextEl.offsetHeight);
    }
    this.markEl.textContent = shown;
    this.contextEl.style.minHeight = `${max}px`;
    this.lastWidth = width;
  }
  showPreview(text) {
    const shown = text ?? this.base.text;
    this.markEl.textContent = shown;
    this.markEl.classList.toggle("preview", shown !== this.base.text);
  }
  renderChrome() {
    this.staleEl.hidden = !this.stale;
    const done = this.variants.filter((v, i) => i !== this.baseIdx && v.result);
    this.infoEl.replaceChildren();
    this.infoEl.classList.remove("flipped");
    if (this.status) {
      this.infoEl.textContent = this.status;
    } else if (done.length) {
      const models = activeModels();
      const parts = models.map((m) => {
        const flipped = done.filter((v) => this.flipsFor(v, m) > 0).length;
        if (flipped) this.infoEl.classList.add("flipped");
        return h("span", { class: `swap-info-m m-${m}` }, models.length > 1 ? h("i", { class: "mdot" }) : null, models.length > 1 ? `${S1_MODELS[m].label} ` : "", h("b", { text: `${flipped} of ${done.length}` }));
      });
      this.infoEl.append(...parts, " replacements flip at least one answer");
    }
  }
  renderHead(specs) {
    const key2 = specs.map((s) => `${s.id}:${s.name}`).join("|");
    if (key2 === this.specKey) return;
    this.specKey = key2;
    this.colgroup.replaceChildren(h("col", { class: "c-word" }), ...specs.map(() => h("col", { class: "c-q" })));
    this.thead.replaceChildren(h("tr", {}, h("th", { text: "Word" }), ...specs.map((s) => h("th", { attrs: { title: `${s.name}: ${s.question}` } }, h("span", { class: "th-text", text: s.name })))));
  }
  renderBody() {
    if (!this.card) return;
    const specs = this.specs;
    this.renderHead(specs);
    this.tbody.replaceChildren(...this.ordered().map((i) => this.renderRow(i, specs)));
    this.renderChrome();
  }
  renderRow(i, specs) {
    const v = this.variants[i];
    const base = this.base.result;
    const isBase = i === this.baseIdx;
    const tag = isBase ? "current" : KIND_LABEL[v.kind];
    const nameCell = h("td", { class: "swap-name" }, h("div", { class: "swap-text", text: v.text }), h("div", { class: `kind kind-${isBase ? "current" : v.kind}`, text: tag }));
    const models = activeModels();
    const cells = specs.map((s) => {
      const lines = [];
      let anyFlip = false;
      let waiting3 = false;
      const titles = [];
      for (const m of models) {
        const dist = v.result?.[m]?.[s.id];
        if (!dist) {
          waiting3 = true;
          continue;
        }
        const top = topLabel(dist);
        const b = base?.[m]?.[s.id];
        const baseTop = b ? topLabel(b) : top;
        const flip = !isBase && top !== baseTop;
        anyFlip ||= flip;
        const p = Math.round((dist[top] ?? 0) * 100);
        const drift = models.length === 1 && !isBase && !flip && b ? Math.round(((dist[baseTop] ?? 0) - (b[baseTop] ?? 0)) * 100) : 0;
        titles.push(`${S1_MODELS[m].label}: ${Object.entries(dist).map(([l, q]) => `${l} ${Math.round(q * 100)}%`).join(", ")}`);
        lines.push(
          h(
            "div",
            { class: `cline m-${m}${flip ? " flip" : ""}` },
            models.length > 1 ? h("i", { class: "mdot" }) : null,
            h("span", { class: "cl", text: top }),
            h("span", { class: "cn" }, h("span", { class: "cp", text: `${p}%` }), drift ? h("span", { class: `cd ${drift > 0 ? "up" : "down"}`, text: `${drift > 0 ? "+" : "\u2212"}${Math.abs(drift)}` }) : null)
          )
        );
      }
      if (!lines.length) return h("td", { class: `swap-cell${v.error ? " err" : " wait"}` }, h("div", { class: "shimmer" }), h("div", { class: "shimmer short" }));
      if (waiting3) lines.push(h("div", { class: "shimmer short" }));
      return h("td", { class: `swap-cell${anyFlip ? " flip" : ""}${models.length > 1 ? " multi" : ""}`, attrs: { title: titles.join("\n") } }, ...lines);
    });
    const row = h("tr", { class: isBase ? "base" : "" }, nameCell, ...cells);
    if (!isBase) {
      row.tabIndex = 0;
      row.title = "Click to use this word";
      row.addEventListener("click", () => this.apply(i));
      row.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") this.apply(i);
      });
      row.addEventListener("mouseenter", () => this.showPreview(v.text));
      row.addEventListener("focus", () => {
        if (row.matches(":focus-visible")) this.showPreview(v.text);
      });
      row.addEventListener("blur", () => this.showPreview(null));
    } else {
      row.addEventListener("mouseenter", () => this.showPreview(null));
    }
    return row;
  }
};

// src/app.ts
var STORE_KEY = "cards";
var App = class {
  cards = [];
  list = h("div", { class: "cards" });
  settingsDialog = new SettingsDialog();
  composer = new Composer((text) => this.add(text));
  shell = h("div", { class: "shell" });
  playground = h("div", { class: "page" });
  datasetPage = new DatasetPage({ backend: currentBackend, onOpen: (ds, mode) => this.openDataset(ds, mode) });
  header;
  swap = new SwapPanel({
    backend: currentBackend,
    onVisibilityChange: (open) => this.shell.classList.toggle("with-swap", open)
  });
  constructor(root) {
    this.header = new Header(() => this.openSettings());
    this.playground.append(this.composer.el, this.list);
    this.shell.append(h("div", { class: "wrap" }, this.header.el, this.playground, this.datasetPage.el), this.swap.el);
    root.append(this.shell);
    addEventListener("hashchange", () => this.route());
    this.route();
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !this.swap.el.hidden && !(ev.target instanceof HTMLInputElement) && !(ev.target instanceof HTMLTextAreaElement)) this.swap.close();
    });
    settingsEvents.on("change", ({ previous }) => {
      applyTheme(settings.theme);
      const backendChanged = previous.mock !== settings.mock || previous.llmModel !== settings.llmModel || previous.jevModel !== settings.jevModel || previous.kevModel !== settings.kevModel || previous.jevEndpoint !== settings.jevEndpoint;
      const keysAdded = !previous.orKey && !!settings.orKey || !previous.tsKey && !!settings.tsKey;
      if (backendChanged || keysAdded) {
        this.swap.close();
        for (const card of this.cards) void card.restart();
      } else if (previous.s1.join() !== settings.s1.join()) {
        for (const card of this.cards) void card.modelsChanged();
        this.swap.modelsChanged();
      }
    });
    const stored = storage.getJSON(STORE_KEY, []);
    if (stored.length) for (const record of [...stored].reverse()) this.mount(record, false);
    else this.add(SEED_SENTENCE);
    if (!this.playground.hidden) this.composer.focus();
  }
  route() {
    const route = location.hash.startsWith("#/dataset") ? "dataset" : "playground";
    this.header.setRoute(route);
    this.playground.hidden = route !== "playground";
    this.datasetPage.el.hidden = route !== "dataset";
    if (route !== "playground") this.swap.close();
    else this.composer.focus();
  }
  openDataset(ds, mode) {
    if (mode === "replace") for (const card of [...this.cards]) this.remove(card, false);
    for (const item of [...ds.items].reverse()) {
      this.mount(
        {
          id: uid(),
          original: item.text,
          text: item.text,
          specs: ds.specs.map((s) => ({ ...s, options: s.options.map((o) => ({ ...o })) })),
          baselines: {},
          expected: item.labels,
          source: { dataset: ds.title, difficulty: item.difficulty, note: item.note }
        },
        false
      );
    }
    this.persist();
    location.hash = "#/";
    window.scrollTo({ top: 0 });
  }
  openSettings() {
    this.settingsDialog.open();
  }
  add(text) {
    this.mount({ id: uid(), original: text, text, specs: null, baselines: {} }, true);
    this.persist();
  }
  mount(record, animate) {
    const card = new SentenceCard(record, {
      backend: currentBackend,
      onChange: () => this.persist(),
      onRemove: (c) => this.remove(c),
      onPick: (c, index) => this.swap.open(c, index)
    });
    this.cards.unshift(card);
    this.list.prepend(card.el);
    if (animate) card.el.classList.add("enter");
    void card.start();
  }
  remove(card, animate = true) {
    const i = this.cards.indexOf(card);
    if (i < 0) return;
    this.cards.splice(i, 1);
    this.swap.closeIfCard(card);
    card.dispose();
    this.persist();
    const el2 = card.el;
    if (!animate) {
      el2.remove();
      return;
    }
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
  if (!settings.mock && !hasLlmAccess() && !activeModels().some(hasS1Access)) app.openSettings();
}
void main();
//# sourceMappingURL=app.js.map
