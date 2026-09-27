export const DESIGN_SYSTEM = `You are a senior annotation-scheme designer. You are building a small evaluation set for System-1 text classifiers (such as Jev and Kev). A System-1 classifier reads one short message and answers multiple-choice questions about it, returning a probability for every option. It judges only the text it is given, using the question wording and each option's one-sentence description, so those descriptions are the decision boundaries.

The set will be explored interactively. A researcher takes each message, dials individual words (stronger or weaker, more positive or negative, synonyms, words that shift the topic) and watches whether the classifiers' answers move. So the scheme must be realistic for the domain and sensitive to wording: a single changed word should be able to move at least one answer.

STEP 1 — Understand the setting.
From the user's description, infer who writes these messages, to whom, through which channel, and what the person or system reading them must decide (route to a team, prioritise, reply, refund, escalate, flag for compliance...). Name that downstream decision explicitly. Good questions are the ones that decision depends on.

STEP 2 — Design exactly {Q} questions with this mix:
- CONTENT (at least two, categorical): what the message is about or asks for. Use the real taxonomy an operations team in this domain uses, not generic labels. Examples: issue type, product area, order status the writer reports, requested action, department to route to, feature mentioned.
- AFFECT (one, a scale): sentiment, frustration, satisfaction, politeness or tone. Pick whichever matters most for the downstream decision.
- OPERATIONAL (one): urgency, escalation risk, churn risk, required response time, or next best action.
- If more questions are needed, add another independent dimension (customer tenure signals, compliance or safety risk, sarcasm, confidence of the claim, who is blamed). No two questions may measure the same thing.

STEP 3 — Options.
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

export const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    setting: {
      type: 'object',
      properties: { speaker: { type: 'string' }, recipient: { type: 'string' }, channel: { type: 'string' }, decision: { type: 'string' } },
      required: ['speaker', 'recipient', 'channel', 'decision'],
      additionalProperties: false
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          question: { type: 'string' },
          kind: { type: 'string', enum: ['category', 'scale'] },
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
        required: ['name', 'question', 'kind', 'options'],
        additionalProperties: false
      }
    }
  },
  required: ['title', 'summary', 'setting', 'questions'],
  additionalProperties: false
};

export const ITEMS_SYSTEM = `You write realistic example messages for an evaluation set. You receive the setting (who writes, to whom, through which channel, what the reader must decide) and a classification scheme of several questions with options and boundary descriptions. Write messages exactly as real people in this setting would write them.

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

export const ITEMS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: { question: { type: 'string' }, label: { type: 'string' } },
              required: ['question', 'label'],
              additionalProperties: false
            }
          },
          difficulty: { type: 'string', enum: ['typical', 'borderline'] },
          note: { type: 'string' }
        },
        required: ['text', 'labels', 'difficulty', 'note'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
};

export const DATASET_PRESETS: { name: string; description: string }[] = [
  {
    name: 'E-commerce support',
    description:
      'Customer messages sent through the chat widget of a mid-sized online store that sells clothing and shoes. They ask about orders, deliveries, returns, sizing, payments and their accounts. The support team needs to route each message to the right queue and decide how quickly to answer.'
  },
  {
    name: 'SaaS bug reports',
    description:
      'In-app feedback and bug reports from users of a project-management web app (boards, tasks, integrations, billing). Product and support triage them into the right team, judge severity, and decide whether to reply, fix or escalate.'
  },
  {
    name: 'Bank chat',
    description:
      'Messages to a retail bank’s support chat about cards, transfers, fees, fraud, loans and the mobile app. Agents must spot fraud or compliance risk, route to the right team and prioritise.'
  },
  {
    name: 'Restaurant reviews',
    description:
      'Short online reviews of a neighbourhood restaurant covering food, service, price, ambience and wait times. The owner wants to know what each review is about, how the guest felt, and whether to respond publicly.'
  },
  {
    name: 'Employee feedback',
    description:
      'Anonymous comments from a quarterly employee survey at a 500-person tech company about managers, workload, pay, tools, culture and career growth. HR wants to group comments by theme, gauge morale and flag anything needing urgent follow-up.'
  }
];
