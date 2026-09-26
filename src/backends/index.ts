import { settings } from '../settings';
import type { Backend } from '../types';
import { liveBackend } from './live';
import { mockBackend } from './mock';

export const currentBackend = (): Backend => (settings.mock ? mockBackend : liveBackend);
