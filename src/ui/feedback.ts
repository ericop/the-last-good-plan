export type SoundId =
  | "tap"
  | "place"
  | "coin"
  | "star"
  | "chest"
  | "launch"
  | "fighter"
  | "lance_warning"
  | "lance_fire"
  | "dodge"
  | "announce"
  | "hit";

const MUTE_KEY = "the-last-good-plan-muted";

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  start: number;
  duration: number;
  gain: number;
}

const SOUNDS: Record<SoundId, Tone[]> = {
  tap: [{ type: "triangle", from: 660, to: 520, start: 0, duration: 0.05, gain: 0.08 }],
  place: [
    { type: "square", from: 180, to: 90, start: 0, duration: 0.09, gain: 0.1 },
    { type: "triangle", from: 520, to: 780, start: 0.03, duration: 0.08, gain: 0.06 },
  ],
  coin: [{ type: "square", from: 988, to: 1318, start: 0, duration: 0.06, gain: 0.04 }],
  star: [
    { type: "triangle", from: 784, to: 784, start: 0, duration: 0.12, gain: 0.1 },
    { type: "triangle", from: 1175, to: 1568, start: 0.08, duration: 0.2, gain: 0.08 },
  ],
  chest: [
    { type: "sawtooth", from: 140, to: 280, start: 0, duration: 0.18, gain: 0.07 },
    { type: "triangle", from: 660, to: 1320, start: 0.14, duration: 0.3, gain: 0.09 },
  ],
  launch: [
    { type: "sawtooth", from: 70, to: 260, start: 0, duration: 0.7, gain: 0.08 },
    { type: "triangle", from: 523, to: 1046, start: 0.55, duration: 0.25, gain: 0.08 },
  ],
  fighter: [{ type: "sawtooth", from: 900, to: 260, start: 0, duration: 0.18, gain: 0.035 }],
  lance_warning: [
    { type: "square", from: 880, to: 880, start: 0, duration: 0.14, gain: 0.05 },
    { type: "square", from: 660, to: 660, start: 0.18, duration: 0.14, gain: 0.05 },
  ],
  lance_fire: [
    { type: "sawtooth", from: 220, to: 40, start: 0, duration: 0.45, gain: 0.12 },
    { type: "square", from: 1200, to: 300, start: 0, duration: 0.2, gain: 0.04 },
  ],
  dodge: [{ type: "triangle", from: 600, to: 1400, start: 0, duration: 0.16, gain: 0.07 }],
  announce: [
    { type: "triangle", from: 392, to: 392, start: 0, duration: 0.12, gain: 0.07 },
    { type: "triangle", from: 523, to: 523, start: 0.12, duration: 0.2, gain: 0.07 },
  ],
  hit: [{ type: "sawtooth", from: 160, to: 60, start: 0, duration: 0.16, gain: 0.08 }],
};

let context: AudioContext | undefined;
let muted = readMuted();
const lastPlayed = new Map<SoundId, number>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockAudio(): void {
  if (context || typeof window === "undefined" || !("AudioContext" in window)) {
    return;
  }
  context = new AudioContext();
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage can be blocked in private windows; the toggle still works for this session.
  }
  return muted;
}

export function playSound(id: SoundId, minGapMs = 60): void {
  if (muted || !context) {
    return;
  }
  const now = performance.now();
  if (now - (lastPlayed.get(id) ?? -Infinity) < minGapMs) {
    return;
  }
  lastPlayed.set(id, now);
  const start = context.currentTime;
  for (const tone of SOUNDS[id]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.from, start + tone.start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.to), start + tone.start + tone.duration);
    gain.gain.setValueAtTime(tone.gain, start + tone.start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.start + tone.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + tone.start);
    oscillator.stop(start + tone.start + tone.duration + 0.02);
  }
}

export function haptic(pattern: number | number[]): void {
  if (muted || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  navigator.vibrate(pattern);
}
