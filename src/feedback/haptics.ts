import { settings } from '../settings';

export type HapticKind = 'step' | 'limit' | 'error';

const PATTERNS: Record<HapticKind, number[]> = { step: [6], limit: [14, 50, 14], error: [30, 40, 30] };

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let iosSwitch: HTMLLabelElement | null = null;

function switchLabel(): HTMLLabelElement {
  if (iosSwitch) return iosSwitch;
  const label = document.createElement('label');
  label.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.append(input);
  document.body.append(label);
  return (iosSwitch = label);
}

export function haptic(kind: HapticKind): void {
  if (!settings.haptics) return;
  if ('vibrate' in navigator) {
    navigator.vibrate(PATTERNS[kind]);
    return;
  }
  if (!isIOS) return;
  const label = switchLabel();
  label.click();
  if (kind !== 'step') setTimeout(() => label.click(), 90);
}
