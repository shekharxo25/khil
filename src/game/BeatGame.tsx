import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GAMES } from '../domain/games';
import { createRng, seedFromString } from '../lib/random';
import { padFeedback, successFeedback } from '../lib/feedback';
import { playSound, type SoundName } from '../lib/sounds';
import { say, stopSpeaking } from '../lib/speech';
import { mean, type TapMark } from '../domain/telemetry';
import { GameFrame } from './GameFrame';
import { TapTarget, type TileState } from './TapTarget';
import { Txt } from '../ui/Txt';
import { color } from '../theme/tokens';
import type { GameProps } from './types';

/**
 * Game 3 — "Copy My Beat" (spec §2).
 *
 * Logs tap accuracy, tap timing precision (rhythm consistency, not just
 * correctness), max sequence length achieved, and error type.
 *
 * Timing precision is the interesting one and the reason this game exists:
 * a child can reproduce the right pads in the right order and still tap them
 * unevenly. That is a motor-domain observation the other three games cannot
 * make, which is what stops "6 skills tracked" from being one signal wearing
 * six hats.
 */

/** Interval between demo taps. Also the target interval the child is copying. */
const MODEL_INTERVAL_MS = 620;
const PAD_LIT_MS = 360;
const GIVE_UP_AFTER_MS = 20_000;
const CELEBRATE_MS = 900;

const PAD_COLORS = [color.kite.coral, color.kite.saffron, color.kite.cobalt, color.kite.violet];
const PAD_SOUNDS: SoundName[] = ['pad-1', 'pad-2', 'pad-3', 'pad-4'];
const PAD_GLYPHS = ['🥁', '🪘', '🔔', '🎵'];

type Phase = 'intro' | 'watch' | 'yourturn' | 'resolved';

export function BeatGame(props: GameProps) {
  const meta = GAMES.beat;
  const { width } = useWindowDimensions();

  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [litPad, setLitPad] = useState<number | null>(null);
  const [padStates, setPadStates] = useState<Record<number, TileState>>({});
  const [speaking, setSpeaking] = useState(false);
  const [maxAchieved, setMaxAchieved] = useState(0);
  /** Mirrors r.current.entered.length so the progress beads can re-render. */
  const [enteredCount, setEnteredCount] = useState(0);

  /** Sequence length adapts to success, per spec. */
  const lengthRef = useRef(2);

  const sequence = useMemo(() => {
    const rng = createRng(seedFromString(`${props.seed}:beat:${roundIndex}`));
    const length = lengthRef.current;
    const out: number[] = [];
    for (let i = 0; i < length; i += 1) {
      let next = Math.floor(rng() * 4);
      // Avoid an immediate repeat: it makes the sequence hard to see, not hard to remember.
      if (i > 0 && next === out[i - 1]) next = (next + 1) % 4;
      out.push(next);
    }
    return out;
  }, [props.seed, roundIndex]);

  const r = useRef({
    promptEnd: 0,
    firstResponse: null as number | null,
    taps: [] as TapMark[],
    tapTimes: [] as number[],
    entered: [] as number[],
    wrongPicks: {} as Record<number, number>,
    repeats: 0,
    done: false,
  });

  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const cancelSpeech = useRef<(() => void) | null>(null);
  const addTimer = (t: ReturnType<typeof setTimeout>) => timers.current.push(t);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      cancelSpeech.current?.();
      stopSpeaking();
    },
    [clearTimers],
  );

  useEffect(() => {
    r.current = {
      promptEnd: 0,
      firstResponse: null,
      taps: [],
      tapTimes: [],
      entered: [],
      wrongPicks: {},
      repeats: 0,
      done: false,
    };
    setPadStates({});
    setLitPad(null);
    setEnteredCount(0);
    setPhase('intro');
  }, [roundIndex]);

  const advance = useCallback(() => {
    clearTimers();
    if (roundIndex + 1 >= props.rounds) props.onFinish();
    else setRoundIndex(i => i + 1);
  }, [clearTimers, props, roundIndex]);

  const finishRound = useCallback(
    (outcome: 'correct' | 'wrong_order' | 'wrong_target' | 'no_response') => {
      if (r.current.done) return;
      r.current.done = true;
      clearTimers();
      setPhase('resolved');

      const now = Date.now();
      const intervals: number[] = [];
      for (let i = 1; i < r.current.tapTimes.length; i += 1) {
        intervals.push(r.current.tapTimes[i] - r.current.tapTimes[i - 1]);
      }
      const deviation =
        intervals.length === 0
          ? undefined
          : Math.round(
              mean(intervals.map(v => Math.abs(v - MODEL_INTERVAL_MS))) ?? 0,
            );

      const correct = outcome === 'correct';
      if (correct) {
        setMaxAchieved(m => Math.max(m, sequence.length));
        lengthRef.current = Math.min(5, lengthRef.current + 1);
      } else if (outcome !== 'no_response') {
        lengthRef.current = Math.max(2, lengthRef.current - 1);
      }

      const event = props.recorder.record({
        game_id: 'beat',
        round_number: roundIndex + 1,
        prompt_end_timestamp: r.current.promptEnd || now,
        first_response_timestamp: r.current.firstResponse,
        response_correct: correct,
        repeat_error_count: r.current.repeats,
        round_end_timestamp: now,
        primary_metric: 'rhythmDeviationMs',
        extra: {
          rhythm_deviation_ms: deviation,
          sequence_length: sequence.length,
          taps: r.current.taps,
          error_type:
            outcome === 'correct'
              ? 'none'
              : outcome === 'no_response'
                ? 'no_response'
                : outcome,
        },
      });
      props.onRound(event);
      addTimer(setTimeout(advance, outcome === 'no_response' ? 300 : CELEBRATE_MS));
    },
    [advance, clearTimers, props, roundIndex, sequence.length],
  );

  // Phase: introduce the round.
  useEffect(() => {
    if (phase !== 'intro') return;
    setSpeaking(true);
    const line = roundIndex === 0 ? 'Listen to my beat, then copy it' : 'Listen again';
    cancelSpeech.current = say(line, props.voiceEnabled, () => {
      setSpeaking(false);
      setPhase('watch');
    });
    return () => cancelSpeech.current?.();
  }, [phase, roundIndex, props.voiceEnabled]);

  // Phase: play the sequence back to the child.
  useEffect(() => {
    if (phase !== 'watch') return;
    sequence.forEach((pad, i) => {
      addTimer(
        setTimeout(() => {
          setLitPad(pad);
          playSound(PAD_SOUNDS[pad]);
          padFeedback();
          addTimer(setTimeout(() => setLitPad(null), PAD_LIT_MS));
        }, i * MODEL_INTERVAL_MS),
      );
    });
    addTimer(
      setTimeout(() => setPhase('yourturn'), sequence.length * MODEL_INTERVAL_MS + 320),
    );
    return () => clearTimers();
  }, [phase, sequence, clearTimers]);

  // Phase: hand over to the child. `prompt_end_timestamp` anchors here.
  useEffect(() => {
    if (phase !== 'yourturn') return;
    setSpeaking(true);
    cancelSpeech.current = say('Now you try', props.voiceEnabled, () => {
      setSpeaking(false);
      r.current.promptEnd = Date.now();
      addTimer(
        setTimeout(() => {
          if (!r.current.done) {
            finishRound(r.current.entered.length === 0 ? 'no_response' : 'wrong_order');
          }
        }, GIVE_UP_AFTER_MS),
      );
    });
    return () => cancelSpeech.current?.();
  }, [phase, props.voiceEnabled, finishRound]);

  const onTapPad = useCallback(
    (pad: number) => {
      if (phase !== 'yourturn' || r.current.done || !r.current.promptEnd) return;
      const now = Date.now();
      const position = r.current.entered.length;
      const expected = sequence[position];
      const correct = pad === expected;

      if (r.current.firstResponse === null) r.current.firstResponse = now;
      r.current.taps.push({ at: now - r.current.promptEnd, target: pad, correct });
      r.current.tapTimes.push(now);
      r.current.entered.push(pad);
      setEnteredCount(r.current.entered.length);

      playSound(PAD_SOUNDS[pad]);
      padFeedback();
      setPadStates(prev => ({ ...prev, [pad]: correct ? 'idle' : 'wrong' }));
      addTimer(
        setTimeout(() => setPadStates(prev => ({ ...prev, [pad]: 'idle' })), 380),
      );

      if (!correct) {
        const previous = r.current.wrongPicks[pad] ?? 0;
        r.current.wrongPicks[pad] = previous + 1;
        if (previous >= 1) r.current.repeats += 1;
      }

      if (r.current.entered.length >= sequence.length) {
        const exact = r.current.entered.every((v, i) => v === sequence[i]);
        if (exact) {
          playSound('correct');
          successFeedback();
          finishRound('correct');
        } else {
          const sameSet =
            [...r.current.entered].sort().join(',') === [...sequence].sort().join(',');
          playSound('retry');
          finishRound(sameSet ? 'wrong_order' : 'wrong_target');
        }
      }
    },
    [finishRound, phase, sequence],
  );

  const padSize = Math.min(140, Math.floor((width - 32 - 16) / 2));
  const sessionProgress =
    (props.gameIndex + (roundIndex + (phase === 'resolved' ? 1 : 0)) / props.rounds) /
    props.gameCount;

  const promptText =
    phase === 'yourturn' || phase === 'resolved' ? 'Now you try' : 'Listen to my beat';

  const captureLines = props.showCaptureDebug
    ? [
        `round ${roundIndex + 1}/${props.rounds} · sequence ${sequence.join('-')} (len ${sequence.length})`,
        `phase ${phase} · entered ${r.current.entered.join('-') || '—'}`,
        `max length ${maxAchieved} · repeats ${r.current.repeats}`,
      ]
    : undefined;

  return (
    <GameFrame
      title={meta.title}
      prompt={promptText}
      speaking={speaking}
      onReplayPrompt={() => {
        if (phase === 'yourturn') {
          setSpeaking(true);
          cancelSpeech.current = say('Now you try', props.voiceEnabled, () => setSpeaking(false));
        }
      }}
      progress={sessionProgress}
      sessionNumber={props.sessionNumber}
      sessionTotal={10}
      showPromptText={props.showPromptText}
      showCaptureDebug={props.showCaptureDebug}
      captureLines={captureLines}
      accent={meta.accent}
      onExit={props.onExit}
    >
      <View style={styles.wrap}>
        <View style={[styles.grid, { maxWidth: padSize * 2 + 16 }]}>
          {PAD_COLORS.map((padColor, index) => {
            const lit = litPad === index;
            return (
              <TapTarget
                key={index}
                size={padSize}
                state={padStates[index] ?? 'idle'}
                disabled={phase !== 'yourturn'}
                accessibilityLabel={`Drum ${index + 1}`}
                onPress={() => onTapPad(index)}
                style={{
                  backgroundColor: lit ? padColor : `${padColor}33`,
                  borderColor: lit ? padColor : `${padColor}55`,
                }}
              >
                <Txt style={{ fontSize: padSize * 0.34 }}>{PAD_GLYPHS[index]}</Txt>
              </TapTarget>
            );
          })}
        </View>

        {/* Dots show how many taps are left. Counting, not reading. */}
        <View style={styles.beads}>
          {sequence.map((_, i) => (
            <View
              key={i}
              style={[
                styles.bead,
                {
                  backgroundColor: i < enteredCount ? meta.accent : `${meta.accent}33`,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 22 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  beads: { flexDirection: 'row', gap: 10 },
  bead: { width: 12, height: 12, borderRadius: 6 },
});
