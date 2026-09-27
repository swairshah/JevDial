import { storage } from '../settings';
import type { Dataset } from '../types';

const KEY = 'datasets';
const LIMIT = 12;

export const datasetStore = {
  list(): Dataset[] {
    return storage.getJSON<Dataset[]>(KEY, []);
  },
  save(dataset: Dataset): void {
    const rest = this.list().filter(d => d.id !== dataset.id);
    storage.setJSON(KEY, [dataset, ...rest].slice(0, LIMIT));
  },
  remove(id: string): void {
    storage.setJSON(
      KEY,
      this.list().filter(d => d.id !== id)
    );
  },
  get(id: string): Dataset | undefined {
    return this.list().find(d => d.id === id);
  }
};
