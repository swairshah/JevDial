export const STEP_SYSTEM = `You are a lexical dial. You receive a sentence in which exactly one span is wrapped in ⟦ ⟧, the ladder of rungs already discovered for that span, an axis and a direction.
Return the NEXT rung: a replacement for the span only, one small but clearly perceptible step from the CURRENT rung in the requested direction.
Rules:
- Never repeat any rung already on the ladder, and never skip past a rung that is already there.
- The replacement must drop into the sentence exactly where the span is, with nothing else changed, and read naturally. Keep the grammatical role and inflection.
- 1 to 4 words, no punctuation, no quotes.
- For the valence axis keep going through neutral into the opposite polarity (e.g. terrible → bad → meh → okay → good → great → amazing → phenomenal).
- If no natural further step exists, set "at_limit": true.
Reply with JSON only: {"replacement": string, "valence": number in [-1,1] for how negative/positive the span reads in this sentence, "intensity": number in [0,1] for how strong it is, "at_limit": boolean}`;

export const STEP_SCHEMA = {
  type: 'object',
  properties: {
    replacement: { type: 'string' },
    valence: { type: 'number' },
    intensity: { type: 'number' },
    at_limit: { type: 'boolean' }
  },
  required: ['replacement', 'valence', 'intensity', 'at_limit'],
  additionalProperties: false
};

export const AXES = {
  degree: {
    up: 'stronger degree (slightly → somewhat → very → extremely)',
    down: 'weaker degree (extremely → very → somewhat → slightly → barely)'
  },
  evaluative: {
    up: 'more positive: praise gets stronger or criticism softens',
    down: 'more negative: criticism gets harsher or praise weakens'
  }
} as const;

export const TAG_SYSTEM = `You tag words that can be dialed along a scale. "evaluative": carries a judgment, feeling or quality with stronger/weaker or more positive/negative alternatives. "degree": only sets strength (very, slightly). Do not return any other words.
Reply with JSON only: {"items":[{"index":int,"kind":"evaluative"|"degree","valence":number -1..1,"intensity":number 0..1}]}`;

export const TAG_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          kind: { type: 'string', enum: ['evaluative', 'degree'] },
          valence: { type: 'number' },
          intensity: { type: 'number' }
        },
        required: ['index', 'kind', 'valence', 'intensity'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
};

export const QUESTIONS_SYSTEM = `You design classification questions for a single sentence. Each question has a small set of mutually exclusive options, and a classifier will later answer it for this sentence and for reworded versions of it.

Start by reading the sentence the way a real recipient would: who is probably writing it, to whom, in what setting, and what they want. Then brainstorm at least 8 candidate questions across different families before choosing:

- What kind of message it is: speech act (request, complaint, praise, question, instruction, report), request type, complaint type.
- What it is about: domain or department it would be routed to, topic, product area, affected party.
- How it is said: sentiment, tone, politeness, formality, emotional temperature, confidence, sarcasm.
- What happens next: urgency, expected response, escalation risk, likelihood of churn or of a follow-up.
- Who is involved: who is credited or blamed, target audience, speaker's role or relationship.

Examples of the range we want:
- "I want that UI button fixed. and the color of the page changed" → Complaint Type [technical, design, business, billing]; Request Type [bug fix, change request, feature request, question]; Politeness [rude, blunt, neutral, polite].
- "The food was good, but the service was pretty slow" → Aspect Criticised [food, service, price, ambience]; Sentiment [very negative, negative, mixed, positive, very positive]; Would Return [definitely, probably, unsure, unlikely].
- "Can someone please look at the invoice from March? It's wrong again." → Department [accounting, sales, support, legal]; Frustration [calm, mildly annoyed, frustrated, angry]; Recurrence [first time, happened before, ongoing].
- "Honestly, this update is a disaster." → Target [product, company, specific person, process]; Sarcasm [sincere, possibly sarcastic, clearly sarcastic]; Escalation Risk [low, medium, high].

Choose the best 3 questions:
- At least one must be categorical and about content (what kind of message, what it is about, where it would be routed), not a scale.
- At least one must be a scale that would visibly shift if individual words were made stronger, weaker, more positive or more negative.
- Every question must be genuinely uncertain or informative for this sentence. Avoid questions whose answer is trivially fixed by the wording (like counting things), and avoid near-duplicates of each other.

For each question give:
- "name": 1 to 3 words, Title Case
- "question": one sentence, asked about the sentence
- "options": 3 to 6 mutually exclusive options that cover the realistic space. For a scale, order them from one end to the other. Each has a short lowercase "label" (1 to 3 words) and a one-line "description" that makes its boundary clear.

Reply with JSON only: {"questions":[{"name":string,"question":string,"options":[{"label":string,"description":string}]}]}`;

export const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          question: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, description: { type: 'string' } },
              required: ['label', 'description'],
              additionalProperties: false
            }
          }
        },
        required: ['name', 'question', 'options'],
        additionalProperties: false
      }
    }
  },
  required: ['questions'],
  additionalProperties: false
};

export const WORD_KIND_CRITERIA = {
  evaluative:
    'The word carries a judgment, feeling or quality that sits on a scale, so a writer could swap it for a stronger, weaker, more positive or more negative word: good, awful, cheap, slow, tasty, love, hate, disaster, delighted, annoyed, beautiful, boring.',
  degree: 'The word only sets how strongly something holds: very, pretty, slightly, extremely, barely, somewhat, totally, really, quite, a bit.',
  fixed:
    'Function words, names, numbers and neutral content words with no natural stronger or weaker version: the, a, of, and, but, was, seemed, apple, table, food, waiter, service, Tuesday, Paris.'
};

export const VALENCE_LEVELS = [
  'Strongly negative in this sentence: terrible, hate, disaster, furious',
  'Mildly negative: meh, slow, dislike, annoyed, bland',
  'Neutral or mixed',
  'Mildly positive: fine, nice, like, decent',
  'Strongly positive: amazing, love, perfect, thrilled'
];

export const DEGREE_LEVELS = ['Weak: barely, slightly, a bit', 'Moderate: somewhat, fairly, pretty', 'Strong: very, really, quite', 'Extreme: extremely, utterly, incredibly'];
