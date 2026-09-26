import type { Direction } from '../types';
import { replay } from '../util';
import { haptic, type HapticKind } from './haptics';
import { click } from './sound';

export { unlockAudio } from './sound';

export function feedback(kind: HapticKind, el: HTMLElement | null, dir: Direction = 1, pitch = 0): void {
  if (el) replay(el, kind === 'step' ? (dir > 0 ? 'bump-up' : 'bump-down') : kind === 'limit' ? 'limit' : 'err');
  haptic(kind);
  if (kind === 'step') click({ freq: 2600 * Math.pow(2, pitch * 0.6), gain: 0.55 });
  else if (kind === 'limit') {
    click({ freq: 900, gain: 0.7, q: 1.2, decay: 0.02 });
    click({ freq: 750, gain: 0.6, delay: 0.07, q: 1.2, decay: 0.02 });
  } else {
    for (let i = 0; i < 3; i++) click({ freq: 500, gain: 0.6 - i * 0.1, delay: i * 0.05, q: 0.8, decay: 0.03 });
  }
}
