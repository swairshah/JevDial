import { normalizeDesign, normalizeItems, type RawItems } from '../dataset/normalize';
import type { DatasetDesign, DatasetItem } from '../types';

const opts = (labels: string[]) => labels.map(label => ({ label, description: label }));

export function mockDesign(questionCount: number): DatasetDesign {
  return normalizeDesign(
    {
      title: 'Shoe store support',
      summary: 'Chat messages from customers of an online shoe store.',
      setting: { speaker: 'customer', recipient: 'support team', channel: 'website chat', decision: 'which queue and how fast to answer' },
      questions: [
        { name: 'Issue Type', question: 'What is the customer’s main issue?', kind: 'category', options: opts(['delivery', 'returns & refunds', 'product defect', 'sizing & fit', 'payment & billing', 'other']) },
        { name: 'Order Status', question: 'What order status does the customer report?', kind: 'category', options: opts(['not shipped', 'in transit', 'delayed', 'delivered', 'not mentioned']) },
        { name: 'Sentiment', question: 'How does the customer feel?', kind: 'scale', options: opts(['very negative', 'negative', 'neutral', 'positive', 'very positive']) },
        { name: 'Urgency', question: 'How urgently does this need a reply?', kind: 'scale', options: opts(['low', 'normal', 'high', 'critical']) },
        { name: 'Churn Risk', question: 'How likely is the customer to stop buying?', kind: 'scale', options: opts(['low', 'medium', 'high']) }
      ]
    },
    questionCount
  );
}

const ROWS: [string, string, string, string, string, string, boolean][] = [
  ['My order #48213 is really late and nobody answers my emails.', 'delivery', 'delayed', 'very negative', 'high', 'high', false],
  ['Tracking says delivered but the box never arrived, pretty annoying.', 'delivery', 'delivered', 'negative', 'high', 'medium', false],
  ['Just wanted to say the boots arrived fast and fit great, thanks!', 'other', 'delivered', 'very positive', 'low', 'low', false],
  ['The left sole came apart after two days. Honestly disappointed.', 'product defect', 'delivered', 'negative', 'normal', 'medium', false],
  ['can i return the sneakers if i already wore them once? they feel a bit tight', 'returns & refunds', 'delivered', 'neutral', 'normal', 'low', true],
  ['Size 42 runs small, could you swap them for a 43 please?', 'sizing & fit', 'delivered', 'neutral', 'normal', 'low', false],
  ['I was charged twice for order #51107. Please fix this urgently.', 'payment & billing', 'not mentioned', 'negative', 'critical', 'medium', false],
  ['Still waiting for my refund after three weeks. This is ridiculous.', 'returns & refunds', 'not mentioned', 'very negative', 'high', 'high', false],
  ['My order hasn’t shipped yet but I need the shoes for a wedding on Saturday!', 'delivery', 'not shipped', 'negative', 'critical', 'medium', false],
  ['Package is in transit, just curious about the rough delivery date.', 'delivery', 'in transit', 'neutral', 'low', 'low', false],
  ['Love the new loafers, slightly narrow though. Do you have wide sizes?', 'sizing & fit', 'delivered', 'positive', 'low', 'low', true],
  ['The zipper broke immediately, really poor quality for that price.', 'product defect', 'delivered', 'very negative', 'normal', 'high', false],
  ['Payment keeps failing at checkout with my card, kind of frustrating.', 'payment & billing', 'not mentioned', 'negative', 'high', 'medium', false],
  ['Quick question: do you ship to Norway?', 'other', 'not mentioned', 'neutral', 'low', 'low', false],
  ['Return label worked perfectly, great service as always.', 'returns & refunds', 'not mentioned', 'very positive', 'low', 'low', false],
  ['Order #60021 has been stuck in transit for ten days, getting worried.', 'delivery', 'delayed', 'negative', 'high', 'medium', true],
  ['These runners are amazing but half a size too big. Exchange?', 'sizing & fit', 'delivered', 'positive', 'normal', 'low', false],
  ['Your courier left my parcel in the rain. Shoes are soaked and ruined.', 'product defect', 'delivered', 'very negative', 'high', 'high', true],
  ['Never shopping here again, worst experience ever.', 'other', 'not mentioned', 'very negative', 'normal', 'high', true],
  ['Could you tell me when the sandals will ship? No rush.', 'delivery', 'not shipped', 'neutral', 'low', 'low', false]
];

export function mockItems(design: DatasetDesign, count: number): DatasetItem[] {
  const names = ['Issue Type', 'Order Status', 'Sentiment', 'Urgency', 'Churn Risk'];
  const raw: RawItems = {
    items: ROWS.slice(0, count).map(r => ({
      text: r[0],
      labels: r.slice(1, 6).map((label, i) => ({ question: names[i], label: String(label) })),
      difficulty: r[6] ? 'borderline' : 'typical',
      note: r[6] ? 'Could reasonably be read two ways.' : ''
    }))
  };
  return normalizeItems(raw, design.specs);
}
