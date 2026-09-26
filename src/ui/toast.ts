import { h } from '../util';

const el = h('div', { class: 'toast', attrs: { role: 'status' } });
let timer: number | undefined;

export function mountToast(): void {
  document.body.append(el);
}

export function toast(message: string, ms = 4200): void {
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove('show'), ms);
}
