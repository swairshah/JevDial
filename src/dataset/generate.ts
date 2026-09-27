import type { Backend, Dataset } from '../types';
import { uid } from '../util';
import { missingOptions } from './normalize';

export type Stage = 'design' | 'write' | 'fill' | 'done';

export interface GenerateOptions {
  description: string;
  count: number;
  questionCount: number;
  onStage?: (stage: Stage, detail?: string) => void;
}

const MAX_EXTRA = 8;

export async function generateDataset(backend: Backend, opts: GenerateOptions): Promise<Dataset> {
  opts.onStage?.('design');
  const design = await backend.designDataset(opts.description, opts.questionCount);
  opts.onStage?.('write', `${design.specs.length} questions`);
  let items = await backend.writeDatasetItems(design, opts.count);
  const missing = missingOptions(design.specs, items);
  if (missing.length) {
    opts.onStage?.('fill', `${missing.length} option${missing.length > 1 ? 's' : ''} without an example`);
    try {
      const extra = await backend.writeDatasetItems(design, Math.min(MAX_EXTRA, Math.max(2, Math.ceil(missing.length / 2))), missing);
      const known = new Set(items.map(i => i.text.toLowerCase()));
      items = [...items, ...extra.filter(i => !known.has(i.text.toLowerCase()))];
    } catch {}
  }
  opts.onStage?.('done');
  return { ...design, id: uid(), description: opts.description, items, createdAt: Date.now() };
}

export async function regenerateItems(backend: Backend, dataset: Dataset, count: number, onStage?: GenerateOptions['onStage']): Promise<Dataset> {
  onStage?.('write', `${dataset.specs.length} questions`);
  let items = await backend.writeDatasetItems(dataset, count);
  const missing = missingOptions(dataset.specs, items);
  if (missing.length) {
    onStage?.('fill', `${missing.length} option${missing.length > 1 ? 's' : ''} without an example`);
    try {
      const extra = await backend.writeDatasetItems(dataset, Math.min(MAX_EXTRA, Math.max(2, Math.ceil(missing.length / 2))), missing);
      const known = new Set(items.map(i => i.text.toLowerCase()));
      items = [...items, ...extra.filter(i => !known.has(i.text.toLowerCase()))];
    } catch {}
  }
  onStage?.('done');
  return { ...dataset, items, createdAt: Date.now() };
}
