import { WHEEL_STEP_PX, WHEEL_STICKY_MS } from '../config';
import { unlockAudio } from '../feedback';
import { settings } from '../settings';
import type { Direction } from '../types';
import { locateToken, type DialSentence } from './DialSentence';
import { ladder } from './Ladder';
import type { Token } from './token';

interface Target {
  dial: DialSentence;
  tok: Token;
}

let installed = false;

export function attachDial(dial: DialSentence): () => void {
  return dial.events.on('ladder', tok => ladder.refresh(tok));
}

export function installDialInteractions(): void {
  if (installed) return;
  installed = true;
  ladder.mount();

  let wheelAcc = 0;
  let wheelTarget: Target | null = null;
  let wheelLast = 0;
  let wheelIdle: number | undefined;

  document.addEventListener(
    'wheel',
    ev => {
      const now = performance.now();
      let target = locateToken(ev.target);
      if (!target && wheelTarget && wheelTarget.dial.alive(wheelTarget.tok) && now - wheelLast < WHEEL_STICKY_MS) target = wheelTarget;
      if (!target) return;
      ev.preventDefault();
      wheelLast = now;
      if (wheelTarget?.tok !== target.tok) wheelAcc = 0;
      wheelTarget = target;
      window.clearTimeout(wheelIdle);
      wheelIdle = window.setTimeout(() => (wheelAcc = 0), 260);
      const unit = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 400 : 1;
      const dy = -ev.deltaY * unit * (settings.invertScroll ? -1 : 1);
      if (now < target.tok.coolUntil) return;
      wheelAcc += dy;
      if (Math.abs(wheelAcc) < WHEEL_STEP_PX) return;
      const dir = Math.sign(wheelAcc) as Direction;
      wheelAcc = 0;
      target.tok.coolUntil = now + 150;
      void target.dial.go(target.tok, dir);
    },
    { passive: false }
  );

  document.addEventListener('mouseover', ev => {
    const t = locateToken(ev.target);
    if (t) ladder.show(t.dial, t.tok);
  });
  document.addEventListener('mouseout', ev => {
    const t = locateToken(ev.target);
    if (t && !(ev.relatedTarget instanceof Node && t.tok.el?.contains(ev.relatedTarget))) ladder.hide(160);
  });
  document.addEventListener('focusin', ev => {
    const t = locateToken(ev.target);
    if (t) ladder.show(t.dial, t.tok);
  });
  document.addEventListener('focusout', ev => {
    if (locateToken(ev.target)) ladder.hide(100);
  });
  document.addEventListener('dblclick', ev => {
    const t = locateToken(ev.target);
    if (!t) return;
    ev.preventDefault();
    t.dial.reset(t.tok);
  });
  document.addEventListener('keydown', ev => {
    unlockAudio();
    const t = locateToken(ev.target);
    if (!t) return;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      void t.dial.go(t.tok, ev.key === 'ArrowUp' ? 1 : -1);
    } else if (ev.key === 'Escape' || ev.key === '0' || ev.key === 'Backspace') {
      ev.preventDefault();
      t.dial.reset(t.tok);
    }
  });

  let drag: (Target & { y: number; id: number; moved: boolean }) | null = null;
  document.addEventListener(
    'pointerdown',
    ev => {
      unlockAudio();
      const t = locateToken(ev.target);
      if (!t?.tok.el) return;
      drag = { ...t, y: ev.clientY, id: ev.pointerId, moved: false };
      t.tok.el.setPointerCapture(ev.pointerId);
      ladder.show(t.dial, t.tok);
    },
    { capture: true }
  );
  document.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dy = drag.y - ev.clientY;
    const step = ev.pointerType === 'mouse' ? 18 : 26;
    if (Math.abs(dy) < step) return;
    drag.y = ev.clientY;
    drag.moved = true;
    void drag.dial.go(drag.tok, Math.sign(dy) as Direction);
  });
  const endDrag = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.id) return;
    if (ev.pointerType !== 'mouse') ladder.hide(700);
    if (drag.moved) {
      const swallow = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      document.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 0);
    }
    drag = null;
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  addEventListener('scroll', () => ladder.reposition(), { passive: true });
  addEventListener('resize', () => ladder.reposition());
}
