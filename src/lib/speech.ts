import * as Speech from 'expo-speech';

/**
 * Voice layer.
 *
 * Wireframe 02, note 1: "Every instruction is spoken, never written."
 * Everything the child is asked to do goes through here.
 *
 * Two hard requirements shape this module:
 *  1. The game must never stall. If the device has no TTS voice, `onDone` still
 *     fires on a watchdog so the round can start and latency can be measured.
 *  2. `prompt_end_timestamp` (spec §4) is the moment the instruction audio
 *     finishes — so the caller needs a reliable end signal, not a guess.
 */

export type SpeakHandle = { cancel: () => void };

let activeToken = 0;

/** Rough spoken duration, used only as a fallback deadline. */
function estimateMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const base = 420 + words * 400;
  return Math.round(base / Math.max(0.5, rate));
}

export type SpeakOptions = {
  /** Slower than default: pre-literate listeners, and it keeps latency measurement honest. */
  rate?: number;
  pitch?: number;
  onDone?: () => void;
};

export function speak(text: string, options: SpeakOptions = {}): SpeakHandle {
  const rate = options.rate ?? 0.92;
  const pitch = options.pitch ?? 1.05;
  activeToken += 1;
  const token = activeToken;

  let settled = false;
  const finish = () => {
    if (settled || token !== activeToken) return;
    settled = true;
    clearTimeout(watchdog);
    options.onDone?.();
  };

  // Deadline is generous: it only fires when the platform gives us nothing.
  const watchdog = setTimeout(finish, estimateMs(text, rate) + 1400);

  try {
    Speech.stop();
    Speech.speak(text, {
      rate,
      pitch,
      language: 'en-IN',
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  } catch {
    // Platform without TTS — the watchdog still resolves the round.
  }

  return {
    cancel: () => {
      settled = true;
      clearTimeout(watchdog);
      try {
        Speech.stop();
      } catch {
        /* no-op */
      }
    },
  };
}

/**
 * Speak, or — when the voice layer is muted — wait a length-proportional beat
 * so timing-sensitive game phases stay identical either way.
 * Returns a cancel function.
 */
export function say(
  text: string,
  voiceEnabled: boolean,
  onDone?: () => void,
): () => void {
  if (!voiceEnabled) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const timer = setTimeout(() => onDone?.(), Math.max(700, 360 * words));
    return () => clearTimeout(timer);
  }
  const handle = speak(text, { onDone });
  return () => handle.cancel();
}

export function stopSpeaking(): void {
  activeToken += 1;
  try {
    Speech.stop();
  } catch {
    /* no-op */
  }
}
