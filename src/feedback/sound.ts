import { settings } from '../settings';

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function context(): AudioContext | null {
  if (!settings.sound) return null;
  if (!ctx) {
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx.state === 'running' ? ctx : null;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const n = Math.floor(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
  return (noise = buf);
}

export interface ClickOptions {
  freq?: number;
  gain?: number;
  delay?: number;
  q?: number;
  decay?: number;
}

export function click({ freq = 3000, gain = 0.5, delay = 0, q = 2.5, decay = 0.012 }: ClickOptions = {}): void {
  const c = context();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = q;
  const high = c.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 400;
  const amp = c.createGain();
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  src.connect(band).connect(high).connect(amp).connect(c.destination);
  src.start(t0);
  src.stop(t0 + decay + 0.01);
}

export function unlockAudio(): void {
  context();
}
