import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { GAMES } from '../domain/games';
import { createRng, seedFromString } from '../lib/random';
import { padFeedback, softFeedback, successFeedback } from '../lib/feedback';
import { playSound } from '../lib/sounds';
import { say, stopSpeaking } from '../lib/speech';
import type { TapMark } from '../domain/telemetry';
import { GameFrame } from './GameFrame';
import { Txt } from '../ui/Txt';
import { Button } from '../ui/Button';
import { color, radius } from '../theme/tokens';
import { makeSequenceRound, pickScenarios, type Scenario } from './content/scenarios';
import type { GameProps } from './types';

/**
 * Game 4 — "What Happens Next" (spec §2).
 *
 * Logs whether the final order is correct, the number of card swaps before the
 * child settles, time to first drag (hesitation as a proxy for uncertainty),
 * and whether the child re-orders after getting audio feedback.
 *
 * Two of those map onto the shared columns rather than inventing new reference
 * bands: time-to-first-drag is `response_latency_ms`, and swaps beyond the
 * minimum needed to solve the puzzle are `repeat_error_count`. Reusing the
 * columns is what lets one flag engine read all four games (spec §4).
 */

const GAP = 12;
const CELEBRATE_MS = 1100;
const GIVE_UP_AFTER_MS = 45_000;

type Phase = 'settling' | 'feedback' | 'resolved';

export function SequenceGame(props: GameProps) {
  const meta = GAMES.sequence;
  const { width } = useWindowDimensions();

  const scenarios = useMemo(() => {
    const rng = createRng(seedFromString(`${props.seed}:sequence:list`));
    return pickScenarios(rng, props.rounds);
  }, [props.seed, props.rounds]);

  const [roundIndex, setRoundIndex] = useState(0);
  const scenario: Scenario = scenarios[Math.min(roundIndex, scenarios.length - 1)];

  const round = useMemo(() => {
    const rng = createRng(seedFromString(`${props.seed}:sequence:${roundIndex}`));
    return makeSequenceRound(rng, scenario);
  }, [props.seed, roundIndex, scenario]);

  const [order, setOrder] = useState<number[]>(round.shownOrder);
  const [phase, setPhase] = useState<Phase>('settling');
  const [speaking, setSpeaking] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const [moved, setMoved] = useState(false);

  const cardW = Math.min(104, Math.floor((width - 48 - GAP * 2) / 3));
  const cardH = cardW * 1.28;
  const stride = cardW + GAP;

  // One pan value per card slot, created once — every scenario has three cards.
  const pans = useMemo(() => [0, 1, 2].map(() => new Animated.ValueXY({ x: 0, y: 0 })), []);
  const dragging = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const r = useRef({
    promptEnd: 0,
    firstResponse: null as number | null,
    swapsBeforeCheck: 0,
    swapsAfterFeedback: 0,
    taps: [] as TapMark[],
    done: false,
  });

  const orderRef = useRef(order);
  orderRef.current = order;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

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

  // Reset for a new scenario.
  useEffect(() => {
    r.current = {
      promptEnd: 0,
      firstResponse: null,
      swapsBeforeCheck: 0,
      swapsAfterFeedback: 0,
      taps: [],
      done: false,
    };
    pans.forEach(p => p.setValue({ x: 0, y: 0 }));
    setOrder(round.shownOrder);
    setPhase('settling');
    setCheckCount(0);
    setMoved(false);
  }, [roundIndex, round.shownOrder, pans]);

  // Spoken set-up. prompt_end anchors the hesitation measurement.
  useEffect(() => {
    setSpeaking(true);
    cancelSpeech.current = say(scenario.intro, props.voiceEnabled, () => {
      setSpeaking(false);
      r.current.promptEnd = Date.now();
      addTimer(
        setTimeout(() => {
          if (!r.current.done) resolveRound(false, 'no_response');
        }, GIVE_UP_AFTER_MS),
      );
    });
    return () => cancelSpeech.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIndex, props.voiceEnabled]);

  const advance = useCallback(() => {
    clearTimers();
    if (roundIndex + 1 >= Math.min(props.rounds, scenarios.length)) props.onFinish();
    else setRoundIndex(i => i + 1);
  }, [clearTimers, props, roundIndex, scenarios.length]);

  /** Minimum swaps needed to sort the shown order — the floor for "extra" swaps. */
  const minSwaps = useMemo(() => {
    const arr = round.shownOrder.slice();
    const seen = new Array(arr.length).fill(false);
    let cycles = 0;
    for (let i = 0; i < arr.length; i += 1) {
      if (seen[i]) continue;
      cycles += 1;
      let j = i;
      while (!seen[j]) {
        seen[j] = true;
        j = arr[j];
      }
    }
    return arr.length - cycles;
  }, [round.shownOrder]);

  const resolveRound = useCallback(
    (correct: boolean, outcome: 'none' | 'wrong_order' | 'no_response') => {
      if (r.current.done) return;
      r.current.done = true;
      clearTimers();
      setPhase('resolved');

      const now = Date.now();
      const totalSwaps = r.current.swapsBeforeCheck + r.current.swapsAfterFeedback;
      const event = props.recorder.record({
        game_id: 'sequence',
        round_number: roundIndex + 1,
        prompt_end_timestamp: r.current.promptEnd || now,
        first_response_timestamp: r.current.firstResponse,
        response_correct: correct,
        repeat_error_count: Math.max(0, r.current.swapsBeforeCheck - minSwaps),
        round_end_timestamp: now,
        primary_metric: 'responseLatencyMs',
        extra: {
          swap_count: totalSwaps,
          reordered_after_audio: r.current.swapsAfterFeedback > 0,
          taps: r.current.taps,
          error_type: outcome,
        },
      });
      props.onRound(event);
      addTimer(setTimeout(advance, outcome === 'no_response' ? 300 : CELEBRATE_MS));
    },
    [advance, clearTimers, minSwaps, props, roundIndex],
  );

  const narrate = useCallback(
    (cardIndex: number) => {
      const card = scenario.cards[cardIndex];
      setSpeaking(true);
      playSound('tap');
      cancelSpeech.current = say(card.narration, props.voiceEnabled, () => setSpeaking(false));
    },
    [props.voiceEnabled, scenario.cards],
  );

  const registerFirstTouch = useCallback(() => {
    if (r.current.firstResponse === null && r.current.promptEnd) {
      r.current.firstResponse = Date.now();
    }
  }, []);

  const applySwap = useCallback(
    (fromSlot: number, toSlot: number, dxAtRelease: number, cardIndex: number) => {
      const next = orderRef.current.slice();
      const displaced = next[toSlot];
      next[toSlot] = cardIndex;
      next[fromSlot] = displaced;

      // Keep both cards visually where they were, then settle them into place.
      pans[cardIndex].setValue({ x: fromSlot * stride + dxAtRelease - toSlot * stride, y: 0 });
      pans[displaced].setValue({ x: (toSlot - fromSlot) * stride, y: 0 });

      setOrder(next);
      orderRef.current = next;

      Animated.parallel([
        Animated.spring(pans[cardIndex], {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          speed: 20,
          bounciness: 6,
        }),
        Animated.spring(pans[displaced], {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          speed: 18,
          bounciness: 5,
        }),
      ]).start();

      if (phaseRef.current === 'feedback') r.current.swapsAfterFeedback += 1;
      else r.current.swapsBeforeCheck += 1;
      setMoved(true);
      softFeedback();
    },
    [pans, stride],
  );

  const responders = useMemo(
    () =>
      scenario.cards.map((_, cardIndex) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => phaseRef.current !== 'resolved',
          onMoveShouldSetPanResponder: (_e, g) =>
            phaseRef.current !== 'resolved' && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
          onPanResponderGrant: () => {
            registerFirstTouch();
            dragging.current = cardIndex;
            setDraggingIndex(cardIndex);
          },
          onPanResponderMove: (_e, g) => {
            pans[cardIndex].setValue({ x: g.dx, y: g.dy * 0.25 });
          },
          onPanResponderRelease: (_e, g) => {
            dragging.current = null;
            setDraggingIndex(null);

            const isTap = Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8;
            if (isTap) {
              Animated.spring(pans[cardIndex], {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
                speed: 24,
                bounciness: 6,
              }).start();
              r.current.taps.push({
                at: r.current.promptEnd ? Date.now() - r.current.promptEnd : 0,
                target: cardIndex,
                correct: false,
              });
              narrate(cardIndex);
              return;
            }

            const fromSlot = orderRef.current.indexOf(cardIndex);
            const raw = (fromSlot * stride + g.dx) / stride;
            const toSlot = Math.max(0, Math.min(scenario.cards.length - 1, Math.round(raw)));

            if (toSlot === fromSlot) {
              Animated.spring(pans[cardIndex], {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
                speed: 22,
                bounciness: 6,
              }).start();
              return;
            }
            applySwap(fromSlot, toSlot, g.dx, cardIndex);
          },
          onPanResponderTerminate: () => {
            dragging.current = null;
            setDraggingIndex(null);
            Animated.spring(pans[cardIndex], {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
              speed: 22,
              bounciness: 6,
            }).start();
          },
        }),
      ),
    [applySwap, narrate, pans, registerFirstTouch, scenario.cards, stride],
  );

  const onCheck = useCallback(() => {
    if (r.current.done) return;
    registerFirstTouch();
    const correct = orderRef.current.every((cardIndex, slot) => cardIndex === slot);
    const attempt = checkCount + 1;
    setCheckCount(attempt);

    if (correct) {
      playSound('celebrate');
      successFeedback();
      // Read the finished story back — the reward is hearing it make sense.
      setSpeaking(true);
      cancelSpeech.current = say(
        scenario.cards.map(c => c.narration).join(', then '),
        props.voiceEnabled,
        () => setSpeaking(false),
      );
      resolveRound(true, 'none');
      return;
    }

    if (attempt === 1) {
      // Audio feedback, then one more go — the spec wants to know whether the
      // child re-orders after hearing it.
      playSound('retry');
      padFeedback();
      setPhase('feedback');
      setSpeaking(true);
      cancelSpeech.current = say(
        `Listen: ${scenario.cards.map(c => c.narration).join(', then ')}. Try again`,
        props.voiceEnabled,
        () => setSpeaking(false),
      );
      return;
    }

    playSound('retry');
    resolveRound(false, 'wrong_order');
  }, [checkCount, props.voiceEnabled, registerFirstTouch, resolveRound, scenario.cards]);

  const trackWidth = scenario.cards.length * cardW + (scenario.cards.length - 1) * GAP;
  const sessionProgress =
    (props.gameIndex + (roundIndex + (phase === 'resolved' ? 1 : 0)) / props.rounds) /
    props.gameCount;

  const promptText =
    phase === 'feedback' ? 'Listen, then try again' : scenario.intro;

  const captureLines = props.showCaptureDebug
    ? [
        `scenario ${scenario.id} · shown ${round.shownOrder.join('-')} · now ${order.join('-')}`,
        `swaps ${r.current.swapsBeforeCheck} (min ${minSwaps}) · after-audio ${r.current.swapsAfterFeedback}`,
        `first drag ${
          r.current.firstResponse && r.current.promptEnd
            ? `${r.current.firstResponse - r.current.promptEnd} ms`
            : 'awaiting'
        }`,
      ]
    : undefined;

  return (
    <GameFrame
      title={meta.title}
      prompt={promptText}
      speaking={speaking}
      onReplayPrompt={() => {
        setSpeaking(true);
        cancelSpeech.current = say(scenario.intro, props.voiceEnabled, () => setSpeaking(false));
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
        <View style={[styles.track, { width: trackWidth, height: cardH }]}>
          {/* Slot ghosts, so the drop targets are visible without instructions. */}
          {scenario.cards.map((_, slot) => (
            <View
              key={`slot-${slot}`}
              style={[
                styles.slot,
                { left: slot * stride, width: cardW, height: cardH },
              ]}
            >
              <Txt variant="micro" tone="faint">
                {slot + 1}
              </Txt>
            </View>
          ))}

          {scenario.cards.map((card, cardIndex) => {
            const slot = order.indexOf(cardIndex);
            const isDragging = draggingIndex === cardIndex;
            return (
              <Animated.View
                key={card.emoji + cardIndex}
                {...responders[cardIndex].panHandlers}
                accessibilityLabel={card.altText}
                style={[
                  styles.card,
                  {
                    left: slot * stride,
                    width: cardW,
                    height: cardH,
                    transform: pans[cardIndex].getTranslateTransform(),
                    zIndex: isDragging ? 10 : 1,
                    elevation: isDragging ? 8 : 3,
                    borderColor: isDragging ? meta.accent : '#FFFFFF',
                  },
                ]}
              >
                <Txt style={{ fontSize: cardW * 0.46 }}>{card.emoji}</Txt>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.actions}>
          {phase === 'resolved' ? (
            <Txt variant="heading" tone="brand">
              {checkCount > 0 && orderRef.current.every((c, s) => c === s) ? '🎉' : '👍'}
            </Txt>
          ) : (
            <Button
              label={phase === 'feedback' ? 'Check again' : 'Done'}
              glyph="✓"
              onPress={onCheck}
              disabled={!moved && phase === 'settling'}
              full={false}
              variant="primary"
            />
          )}
        </View>
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 26 },
  track: { alignSelf: 'center' },
  slot: {
    position: 'absolute',
    top: 0,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF55',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  card: {
    position: 'absolute',
    top: 0,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A3A55',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  actions: { minHeight: 54, justifyContent: 'center' },
});
