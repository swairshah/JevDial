import type { Rung, WordKind } from '../types';
import { clamp } from '../util';

export interface Hue {
  h: number;
  c: number;
}

export function hueFor(kind: WordKind | null, rung: Rung): Hue {
  if (kind === 'degree') return { h: 290, c: 0.03 + 0.16 * clamp(rung.intensity, 0, 1) };
  const v = clamp(rung.valence, -1, 1);
  return { h: v >= 0 ? 152 : 27, c: 0.015 + 0.17 * Math.abs(v) };
}

export function applyHue(el: HTMLElement, hue: Hue): void {
  el.style.setProperty('--h', String(hue.h));
  el.style.setProperty('--cc', hue.c.toFixed(3));
}
