import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GAMES } from '../domain/games';
import { createRng, seedFromString, type Rng } from '../lib/random';
import { padFeedback, successFeedback } from '../lib/feedback';
import { playSound } from '../lib/sounds';
import type { TapMark } from '../domain/telemetry';
import { GameFrame } from './GameFrame';
import { TapTarget, type TileState } from './TapTarget';
import { useSpokenPrompt } from './useSpokenPrompt';
import { color, radius } from '../theme/tokens';
import type { GameProps } from './types';

/**
 * "Which Has More?" — non-symbolic quantity comparison.
 *
 * Two clouds of dots, no numerals, nothing to count. What matters is the ratio
 * between the two groups: telling 5 from 10 is easy for everyone, and telling
 * 12 from 15 is the part that separates children. The flag engine therefore
 * reads accuracy on the near-ratio trials only (`ratio_tier >= 2`), because
 * overall accuracy here is mostly a measure of how many easy trials were shown.
 *
 * Dot size is varied independently of dot count so that "more dots" and "more
 * ink" come apart — otherwise a child could win every round by picking the
 * darker side without ever comparing quantities.
 */

const NUDGE_AFTER_MS = 9_000;
const GIVE_UP_AFTER_MS = 20_000;
const CELEBRATE_MS = 800;

const PROMPTS = [
  'Tap the side with more dots',
  'Which side has more? Tap it',
  'Point to the side with more',
];

type Dot = { x: number; y: number; r: number };

type QuantityRound = {
  ratioTier: 1 | 2 | 3;
  counts: [number, number];
  dots: [Dot[], Dot[]];
  moreIndex: 0 | 1;
  prompt: string;
};

/** 1 = obvious (1:2), 2 = closer (2:3), 3 = hard (4:5). */
const RATIOS: Record<1 | 2 | 3, [number, number][]> = {
  1: [[5, 10], [6, 12], [4, 9], [7, 14]],
  2: [[8, 12], [10, 15], [6, 9], [12, 18]],
  3: [[12, 15], [16, 20], [10, 13], [15, 18]],
};

function scatter(rng: Rng, count: number, box: number, sizeBias: number): Dot[] {
  const dots: Dot[] = [];
  let guard = 0;
  while (dots.length < count && guard < count * 60) {
    guard += 1;
    const r = (box * 0.055 + rng() * box * 0.035) * sizeBias;
    const x = r + rng() * (box - 2 * r);
    const y = r + rng() * (box - 2 * r);
    const overlaps = dots.some(d => Math.hypot(d.x - x, d.y - y) < d.r + r + 3);
    if (!overlaps) dots.push({ x, y, r });
  }
  return dots;
}

function makeQuantityRound(rng: Rng, tier: 1 | 2 | 3, box: number): QuantityRound {
  const pair = RATIOS[tier][Math.floor(rng() * RATIOS[tier].length)];
  const moreIndex: 0 | 1 = rng() < 0.5 ? 0 : 1;
  const counts: [number, number] =
    moreIndex === 0 ? [pair[1], pair[0]] : [pair[0], pair[1]];

  // The side with more dots gets the smaller dots, so total inked area does not
  // track the answer. Roughly half the time, invert it — otherwise "smaller
  // dots wins" becomes its own shortcut.
  const invert = rng() < 0.5;
  const biasFor = (i: number) =>
    (i === moreIndex) === invert ? 1.18 : 0.84;

  return {
    ratioTier: tier,
    counts,
    dots: [
      scatter(rng, counts[0], box, biasFor(0)),
      scatter(rng, counts[1], box, biasFor(1)),
    ],
    moreIndex,
    prompt: PROMPTS[Math.floor(rng() * PROMPTS.length)],
  };
}

/** Easy trials first, then the ratios tighten. */
function ratioTierForRound(i: number, total: number): 1 | 2 | 3 {
  const third = Math.max(1, Math.floor(total / 3));
  if (i < third) return 1;
  if (i < third * 2) return 2;
  return 3;
}

export function QuantityGame(props: GameProps) {
  const meta = GAMES.quantity;
  const { width } = useWindowDimensions();
  const box = Math.min(150, Math.floor((width - 32 - 16) / 2));

  const [roundIndex, setRoundIndex] = useState(0);
  const [tileStates, setTileStates] = useState<Record<number, TileState>>({});
  const [resolved, setResolved] = useState(false);

  const round = useMemo(() => {
    const rng = createRng(seedFromString(`${props.seed}:quantity:${roundIndex}`));
    return makeQuantityRound(rng, ratioTierForRound(roundIndex, props.rounds), box);
  }, [props.seed, props.rounds, roundIndex, box]);

  const r = useRef({
    promptEnd: 0,
    firstResponse: null as number | null,
    firstCorrect: null as boolean | null,
    taps: [] as TapMark[],
    repeats: 0,
    done: false,
  });

  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const addTimer = (t: ReturnType<typeof setTimeout>) => timers.current.push(t);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    r.current = {
      promptEnd: 0,
      firstResponse: null,
      firstCorrect: null,
      taps: [],
      repeats: 0,
      done: false,
    };
    setTileStates({});
    setResolved(false);
  }, [roundIndex]);

  const advance = useCallback(() => {
    clearTimers();
    if (roundIndex + 1 >= props.rounds) props.onFinish();
    else setRoundIndex(i => i + 1);
  }, [clearTimers, props, roundIndex]);

  const finishRound = useCallback(
    (outcome: 'answered' | 'no_response') => {
      if (r.current.done) return;
      r.current.done = true;
      clearTimers();
      const now = Date.now();
      const event = props.recorder.record({
        game_id: 'quantity',
        round_number: roundIndex + 1,
        prompt_end_timestamp: r.current.promptEnd || now,
        first_response_timestamp: r.current.firstResponse,
        response_correct: r.current.firstCorrect === true,
        repeat_error_count: r.current.repeats,
        round_end_timestamp: now,
        primary_metric: 'numberSenseAccuracy',
        extra: {
          ratio_tier: round.ratioTier,
          quantities: round.counts,
          taps: r.current.taps,
          error_type:
            outcome === 'no_response'
              ? 'no_response'
              : r.current.firstCorrect
                ? 'none'
                : 'wrong_target',
        },
      });
      props.onRound(event);
      addTimer(setTimeout(advance, outcome === 'answered' ? CELEBRATE_MS : 250));
    },
    [advance, clearTimers, props, round.counts, round.ratioTier, roundIndex],
  );

  const prompt = useSpokenPrompt({
    text: round.prompt,
    cue: roundIndex,
    voiceEnabled: props.voiceEnabled,
    onPromptEnd: endedAt => {
      r.current.promptEnd = endedAt;
      addTimer(
        setTimeout(() => {
          if (!r.current.done && r.current.firstResponse === null) promptRef.current.replay();
        }, NUDGE_AFTER_MS),
      );
      addTimer(setTimeout(() => finishRound('no_response'), GIVE_UP_AFTER_MS));
    },
  });
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  const onTap = useCallback(
    (side: 0 | 1) => {
      if (!prompt.ready || r.current.done) return;
      const now = Date.now();
      const correct = side === round.moreIndex;
      if (r.current.firstResponse === null) {
        r.current.firstResponse = now;
        r.current.firstCorrect = correct;
      }
      r.current.taps.push({ at: now - r.current.promptEnd, target: side, correct });

      if (correct) {
        setResolved(true);
        setTileStates({ [side]: 'correct', [1 - side]: 'dimmed' });
        playSound('correct');
        successFeedback();
        finishRound('answered');
        return;
      }

      // A second tap on the same wrong side is a repeat, same as everywhere else.
      r.current.repeats += 1;
      setTileStates(prev => ({ ...prev, [side]: 'wrong' }));
      playSound('retry');
      padFeedback();
      addTimer(
        setTimeout(() => {
          setTileStates(prev => (prev[side] === 'wrong' ? { ...prev, [side]: 'idle' } : prev));
        }, 420),
      );
    },
    [finishRound, prompt.ready, round.moreIndex],
  );

  const sessionProgress =
    (props.gameIndex + (roundIndex + (resolved ? 1 : 0)) / props.rounds) / props.gameCount;

  const captureLines = props.showCaptureDebug
    ? [
        `round ${roundIndex + 1}/${props.rounds} · ratio tier ${round.ratioTier}`,
        `dots ${round.counts[0]} vs ${round.counts[1]} · more on the ${round.moreIndex === 0 ? 'left' : 'right'}`,
        `latency ${
          r.current.firstResponse && r.current.promptEnd
            ? `${r.current.firstResponse - r.current.promptEnd} ms`
            : 'awaiting first tap'
        }`,
      ]
    : undefined;

  return (
    <GameFrame
      title={meta.title}
      prompt={round.prompt}
      speaking={prompt.speaking}
      onReplayPrompt={prompt.replay}
      progress={sessionProgress}
      sessionNumber={props.sessionNumber}
      sessionTotal={10}
      showPromptText={props.showPromptText}
      showCaptureDebug={props.showCaptureDebug}
      captureLines={captureLines}
      accent={meta.accent}
      onExit={props.onExit}
    >
      <View style={styles.row}>
        {([0, 1] as const).map(side => (
          <TapTarget
            key={`${roundIndex}-${side}`}
            size={box}
            state={tileStates[side] ?? 'idle'}
            disabled={!prompt.ready || resolved}
            accessibilityLabel={`${side === 0 ? 'Left' : 'Right'} group`}
            onPress={() => onTap(side)}
          >
            <View style={{ width: box, height: box }}>
              {round.dots[side].map((dot, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: dot.x - dot.r,
                    top: dot.y - dot.r,
                    width: dot.r * 2,
                    height: dot.r * 2,
                    borderRadius: dot.r,
                    backgroundColor: meta.accent,
                  }}
                />
              ))}
            </View>
          </TapTarget>
        ))}
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, justifyContent: 'center', alignItems: 'center' },
});
