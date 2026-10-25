/** Tiny synthesised sound effects, so the game ships no audio files. */

let context: AudioContext | undefined;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

function audio(): AudioContext | null {
  if (muted || typeof AudioContext === "undefined") return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

interface Tone {
  readonly hz: number;
  readonly start?: number;
  readonly duration?: number;
  readonly type?: OscillatorType;
  readonly volume?: number;
}

function tone(
  ctx: AudioContext,
  { hz, start = 0, duration = 0.18, type = "sine", volume = 0.1 }: Tone,
) {
  const begin = ctx.currentTime + start;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(hz, begin);
  gain.gain.setValueAtTime(0.0001, begin);
  gain.gain.exponentialRampToValueAtTime(volume, begin + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, begin + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(begin);
  oscillator.stop(begin + duration + 0.03);
}

export function playClick(hz: number): void {
  const ctx = audio();
  if (!ctx) return;
  tone(ctx, { hz });
  tone(ctx, { hz: hz * 2, volume: 0.035, duration: 0.12 });
}

export function playBust(): void {
  const ctx = audio();
  if (!ctx) return;
  tone(ctx, { hz: 196, type: "sawtooth", duration: 0.28, volume: 0.07 });
  tone(ctx, { hz: 147, start: 0.12, type: "sawtooth", duration: 0.34, volume: 0.07 });
}

export function playWin(): void {
  const ctx = audio();
  if (!ctx) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((hz, index) => {
    tone(ctx, { hz, start: index * 0.09, duration: 0.3 });
  });
}
