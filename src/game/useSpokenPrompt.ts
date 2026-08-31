import { useCallback, useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking, type SpeakHandle } from '../lib/speech';

/**
 * Speaks a round's instruction and reports the exact moment the audio ended.
 *
 * `prompt_end_timestamp` (spec §4) is the anchor for every latency measurement
 * in the product, so it has to be the real end of the audio — not the start,
 * and not a guess. When TTS is unavailable or muted, a length-proportional
 * timer stands in so latencies stay comparable across devices instead of
 * silently shifting by a second and a half.
 */

export type SpokenPrompt = {
  speaking: boolean;
  /** True once the instruction has finished — taps only count from here. */
  ready: boolean;
  replay: () => void;
};

export function useSpokenPrompt(args: {
  text: string;
  /** Change this to speak a new prompt. Same value = no re-speak. */
  cue: string | number;
  voiceEnabled: boolean;
  /** Delay before speaking, so a new tile has time to appear first. */
  delayMs?: number;
  onPromptEnd: (endedAt: number) => void;
}): SpokenPrompt {
  const { text, cue, voiceEnabled, delayMs = 350, onPromptEnd } = args;
  const [speaking, setSpeaking] = useState(false);
  const [ready, setReady] = useState(false);

  const handleRef = useRef<SpeakHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const onEndRef = useRef(onPromptEnd);
  onEndRef.current = onPromptEnd;

  const cleanup = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    endedRef.current = false;
    setReady(false);
    setSpeaking(false);
    cleanup();

    const finish = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      setSpeaking(false);
      setReady(true);
      onEndRef.current(Date.now());
    };

    timerRef.current = setTimeout(() => {
      setSpeaking(true);
      if (voiceEnabled) {
        handleRef.current = speak(text, { onDone: finish });
      } else {
        const words = text.trim().split(/\s+/).length;
        timerRef.current = setTimeout(finish, Math.max(900, 380 * words));
      }
    }, delayMs);

    return cleanup;
    // `text` is intentionally not a dependency: the cue owns re-speaking, so a
    // re-render that recreates an identical string cannot restart the prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue, voiceEnabled, delayMs, cleanup]);

  useEffect(() => () => stopSpeaking(), []);

  /** Replay never re-arms `ready` — the round's latency clock already started. */
  const replay = useCallback(() => {
    handleRef.current?.cancel();
    if (!voiceEnabled) return;
    setSpeaking(true);
    handleRef.current = speak(text, {
      onDone: () => setSpeaking(false),
    });
  }, [text, voiceEnabled]);

  return { speaking, ready, replay };
}
