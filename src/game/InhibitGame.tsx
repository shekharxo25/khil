import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GAMES } from '../domain/games';
import { createRng, seedFromString } from '../lib/random';
import { padFeedback, successFeedback } from '../lib/feedback';
import { playSound } from '../lib/sounds';
import { say, stopSpeaking } from '../lib/speech';
import type { TapMark } from '../domain/telemetry';
import { GameFrame } from './GameFrame';
import { Txt } from '../ui/Txt';
import { color, radius } from '../theme/tokens';
import type { GameProps } from './types';

/**
 * "Wake the Sleepy Ones" — a go / no-go task.
 *
 * Animals appear one at a time. Most are awake and want a tap; a quarter are
 * asleep and must be left alone. Two different things go wrong here and they
 * are worth separating: tapping a sleeping animal is a response that should
 * have been held back, and letting an awake one pass is a response that never
 * came. The reference bands treat them as separate measures for that reason.
 *
 * This is the one game with no per-round speech. It is a speeded task, and a
 * spoken prompt before every trial would swamp the very interval being timed.
 * The instruction is given once, up front, and the standing prompt stays in the
 * voice bar where the child can replay it.
 */

/** How long an animal stays on screen. Long enough for a 4-year-old, short enough to press. */
const STIMULUS_MS = 1500;
/** Blank gap between animals. */
const GAP_MS = 750;
const CELEBRATE_MS = 350;

const AWAKE = ['🐶', '🐱', '🐰', '🦊', '🐼', '🐸', '🐨', '🐷'];

type Trial = { type: 'respond' | 'withhold'; emoji: string };

function buildTrials(seed: number, count: number): Trial[] {
  const rng = createRng(seed);
  const trials: Trial[] = [];
  for (let i = 0; i < count; i += 1) {
    const emoji = AWAKE[Math.floor(rng() * AWAKE.length)];
    // The first two are always "respond": the task only measures holding back
    // once tapping has become the habit.
    const forcedGo = i < 2;
    const previousWasWithhold = trials[i - 1]?.type === 'withhold';
    const withhold = !forcedGo && !previousWasWithhold && rng() < 0.28;
    trials.push({ type: withhold ? 'withhold' : 'respond', emoji });
  }
  return trials;
}

export function InhibitGame(props: GameProps) {
  const meta = GAMES.inhibit;
  const { width } = useWindowDimensions();

  const trials = useMemo(
    () => buildTrials(seedFromString(`${props.seed}:inhibit`), props.rounds),
    [props.seed, props.rounds],
  );

  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  /** null while the screen is blank between trials. */
  const [visible, setVisible] = useState(false);
  const [feedback, setFeedback] = useState<'none' | 'good' | 'oops'>('none');
  const [speaking, setSpeaking] = useState(false);
  const [tally, setTally] = useState({ commissions: 0, omissions: 0 });

  const pulse = useRef(new Animated.Value(0.9)).current;
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const cancelSpeech = useRef<(() => void) | null>(null);
  const addTimer = (t: ReturnType<typeof setTimeout>) => timers.current.push(t);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const trial = useRef({ onset: 0, responded: false, done: false });

  useEffect(
    () => () => {
      clearTimers();
      cancelSpeech.current?.();
      stopSpeaking();
    },
    [clearTimers],
  );

  // One spoken instruction for the whole game.
  useEffect(() => {
    setSpeaking(true);
    cancelSpeech.current = say(
      'Tap the animals that are awake. Let the sleepy ones sleep.',
      props.voiceEnabled,
      () => {
        setSpeaking(false);
        setStarted(true);
      },
    );
    return () => cancelSpeech.current?.();
  }, [props.voiceEnabled]);

  const recordTrial = useCallback(
    (i: number, respondedAt: number | null) => {
      if (trial.current.done) return;
      trial.current.done = true;
      const t = trials[i];
      const now = Date.now();
      // Correct = tapped a waking animal, or left a sleeping one alone.
      const correct = t.type === 'respond' ? respondedAt !== null : respondedAt === null;
      const taps: TapMark[] =
        respondedAt === null
          ? []
          : [{ at: respondedAt - trial.current.onset, target: 0, correct }];

      const event = props.recorder.record({
        game_id: 'inhibit',
        round_number: i + 1,
        prompt_end_timestamp: trial.current.onset,
        first_response_timestamp: respondedAt,
        response_correct: correct,
        repeat_error_count: 0,
        round_end_timestamp: now,
        primary_metric: t.type === 'withhold' ? 'commissionRate' : 'omissionRate',
        extra: {
          trial_type: t.type,
          taps,
          error_type: correct
            ? 'none'
            : t.type === 'withhold'
              ? 'wrong_target'
              : 'no_response',
        },
      });
      props.onRound(event);

      if (!correct) {
        setTally(prev =>
          t.type === 'withhold'
            ? { ...prev, commissions: prev.commissions + 1 }
            : { ...prev, omissions: prev.omissions + 1 },
        );
      }
    },
    [props, trials],
  );

  // The trial loop: show, wait, hide, score, advance.
  useEffect(() => {
    if (!started || index >= trials.length) return;
    trial.current = { onset: Date.now(), responded: false, done: false };
    setVisible(true);
    setFeedback('none');

    pulse.setValue(0.86);
    Animated.spring(pulse, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }).start();

    addTimer(
      setTimeout(() => {
        setVisible(false);
        // No tap within the window: score it now (an omission if it wanted one).
        if (!trial.current.responded) recordTrial(index, null);
        addTimer(
          setTimeout(() => {
            if (index + 1 >= trials.length) props.onFinish();
            else setIndex(i => i + 1);
          }, GAP_MS),
        );
      }, STIMULUS_MS),
    );

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, index, trials.length]);

  const onTap = useCallback(() => {
    if (!visible || trial.current.responded || trial.current.done) return;
    trial.current.responded = true;
    const now = Date.now();
    const t = trials[index];

    if (t.type === 'respond') {
      playSound('correct');
      successFeedback();
      setFeedback('good');
    } else {
      playSound('retry');
      padFeedback();
      setFeedback('oops');
    }
    recordTrial(index, now);
    addTimer(setTimeout(() => setFeedback('none'), CELEBRATE_MS));
  }, [index, recordTrial, trials, visible]);

  const current = trials[Math.min(index, trials.length - 1)];
  const asleep = current?.type === 'withhold';
  const size = Math.min(230, width - 80);

  const sessionProgress = (props.gameIndex + index / trials.length) / props.gameCount;

  const captureLines = props.showCaptureDebug
    ? [
        `trial ${index + 1}/${trials.length} · ${current?.type ?? '—'} · ${visible ? 'on screen' : 'gap'}`,
        `taps that should have been held back: ${tally.commissions}`,
        `prompts with no response: ${tally.omissions}`,
      ]
    : undefined;

  return (
    <GameFrame
      title={meta.title}
      prompt="Tap the animals that are awake. Let the sleepy ones sleep."
      speaking={speaking}
      onReplayPrompt={() => {
        setSpeaking(true);
        cancelSpeech.current = say(
          'Tap the animals that are awake. Let the sleepy ones sleep.',
          props.voiceEnabled,
          () => setSpeaking(false),
        );
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            visible ? (asleep ? 'A sleeping animal' : 'An awake animal') : 'Waiting'
          }
          onPress={onTap}
          style={styles.hit}
        >
          <Animated.View
            style={[
              styles.stage,
              {
                width: size,
                height: size,
                borderRadius: size * 0.3,
                transform: [{ scale: visible ? pulse : 0.9 }],
                opacity: visible ? 1 : 0.18,
                backgroundColor: !visible
                  ? color.slateRaise
                  : asleep
                    ? color.slateRaise
                    : `${meta.accent}2E`,
                borderColor: !visible
                  ? color.slateLine
                  : feedback === 'oops'
                    ? color.notice
                    : asleep
                      ? color.slateLine
                      : meta.accent,
              },
            ]}
          >
            <Txt style={[styles.emoji, { fontSize: size * 0.4 }, asleep && styles.dimmed]}>
              {visible ? current.emoji : ''}
            </Txt>
            {visible && asleep ? <Txt style={styles.zzz}>💤</Txt> : null}
          </Animated.View>
        </Pressable>

        {/* A quiet reminder of the rule, in pictures rather than words. */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Txt style={styles.legendGlyph}>👆</Txt>
            <Txt variant="micro" tone="chalkFaint">
              awake
            </Txt>
          </View>
          <View style={styles.legendItem}>
            <Txt style={styles.legendGlyph}>💤</Txt>
            <Txt variant="micro" tone="chalkFaint">
              leave it
            </Txt>
          </View>
        </View>
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 30 },
  hit: { alignItems: 'center', justifyContent: 'center' },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  emoji: { textAlign: 'center' },
  dimmed: { opacity: 0.45 },
  zzz: { position: 'absolute', top: 18, right: 24, fontSize: 30 },
  legend: { flexDirection: 'row', gap: 28 },
  legendItem: { alignItems: 'center', gap: 2 },
  legendGlyph: { fontSize: 22 },
});
