import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GAMES } from '../domain/games';
import { createRng, seedFromString } from '../lib/random';
import { padFeedback, successFeedback } from '../lib/feedback';
import { playSound } from '../lib/sounds';
import type { TapMark } from '../domain/telemetry';
import { GameFrame } from './GameFrame';
import { ShapeTile } from './ShapeTile';
import { TapTarget, type TileState } from './TapTarget';
import { makePatternRound, tierForRound, type PatternRound } from './content/patterns';
import { useSpokenPrompt } from './useSpokenPrompt';
import type { GameProps } from './types';

/**
 * Game 1 — "Spot the Odd One" (spec §2).
 *
 * Logged, per spec: response latency from prompt end, correct/incorrect,
 * repeated taps on the same wrong tile before correcting, and task-switch time
 * between rounds (the recorder supplies the last one from the previous round's
 * end).
 *
 * The child is never blocked. A wrong tile wobbles and stays tappable, so a
 * round always resolves by the child getting there — which is what makes
 * "repeated selections" a meaningful measure rather than a dead end.
 */

const NUDGE_AFTER_MS = 9_000;
const GIVE_UP_AFTER_MS = 22_000;
const CELEBRATE_MS = 850;

export function PatternGame(props: GameProps) {
  const meta = GAMES.pattern;
  const { width } = useWindowDimensions();
  const [roundIndex, setRoundIndex] = useState(0);
  const [tileStates, setTileStates] = useState<Record<number, TileState>>({});
  const [resolved, setResolved] = useState(false);

  const round: PatternRound = useMemo(() => {
    const rng = createRng(seedFromString(`${props.seed}:pattern:${roundIndex}`));
    return makePatternRound(rng, tierForRound(roundIndex, props.rounds));
  }, [props.seed, props.rounds, roundIndex]);

  /** Everything mutable within a round lives here so timers never read stale state. */
  const r = useRef({
    promptEnd: 0,
    firstResponse: null as number | null,
    firstCorrect: null as boolean | null,
    taps: [] as TapMark[],
    wrongPicks: {} as Record<number, number>,
    repeats: 0,
    done: false,
  });

  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const giveUpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    [nudgeTimer, giveUpTimer, advanceTimer].forEach(t => {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    });
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Reset round-local state whenever the round changes.
  useEffect(() => {
    r.current = {
      promptEnd: 0,
      firstResponse: null,
      firstCorrect: null,
      taps: [],
      wrongPicks: {},
      repeats: 0,
      done: false,
    };
    setTileStates({});
    setResolved(false);
  }, [roundIndex]);

  const advance = useCallback(() => {
    clearTimers();
    if (roundIndex + 1 >= props.rounds) {
      props.onFinish();
    } else {
      setRoundIndex(i => i + 1);
    }
  }, [clearTimers, roundIndex, props]);

  const finishRound = useCallback(
    (outcome: 'answered' | 'no_response') => {
      if (r.current.done) return;
      r.current.done = true;
      clearTimers();

      const now = Date.now();
      const event = props.recorder.record({
        game_id: 'pattern',
        round_number: roundIndex + 1,
        prompt_end_timestamp: r.current.promptEnd || now,
        first_response_timestamp: r.current.firstResponse,
        response_correct: r.current.firstCorrect === true,
        repeat_error_count: r.current.repeats,
        round_end_timestamp: now,
        primary_metric: 'responseLatencyMs',
        extra: {
          difficulty_tier: round.tier,
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

      advanceTimer.current = setTimeout(advance, outcome === 'answered' ? CELEBRATE_MS : 250);
    },
    [advance, clearTimers, props, round.tier, roundIndex],
  );

  const prompt = useSpokenPrompt({
    text: round.prompt,
    cue: roundIndex,
    voiceEnabled: props.voiceEnabled,
    onPromptEnd: endedAt => {
      r.current.promptEnd = endedAt;
      nudgeTimer.current = setTimeout(() => {
        if (!r.current.done && r.current.firstResponse === null) promptRef.current.replay();
      }, NUDGE_AFTER_MS);
      giveUpTimer.current = setTimeout(() => finishRound('no_response'), GIVE_UP_AFTER_MS);
    },
  });

  // Timers need the latest replay closure without re-arming on every render.
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  const onTapTile = useCallback(
    (index: number) => {
      if (!prompt.ready || r.current.done) return;
      const now = Date.now();
      const correct = index === round.oddIndex;

      if (r.current.firstResponse === null) {
        r.current.firstResponse = now;
        r.current.firstCorrect = correct;
      }

      r.current.taps.push({ at: now - r.current.promptEnd, target: index, correct });

      if (correct) {
        setResolved(true);
        setTileStates(prev => {
          const next: Record<number, TileState> = {};
          round.tiles.forEach((_, i) => {
            next[i] = i === index ? 'correct' : 'dimmed';
          });
          return { ...prev, ...next };
        });
        playSound('correct');
        successFeedback();
        finishRound('answered');
        return;
      }

      // Repeat error = the same wrong tile chosen again (spec §2, Game 1).
      const previous = r.current.wrongPicks[index] ?? 0;
      r.current.wrongPicks[index] = previous + 1;
      if (previous >= 1) r.current.repeats += 1;

      setTileStates(prev => ({ ...prev, [index]: 'wrong' }));
      playSound('retry');
      padFeedback();
      setTimeout(() => {
        setTileStates(prev => (prev[index] === 'wrong' ? { ...prev, [index]: 'idle' } : prev));
      }, 420);
    },
    [finishRound, prompt.ready, round.oddIndex, round.tiles],
  );

  const tileSize = Math.min(112, Math.floor((width - 32 - 2 * 14) / 3));
  const sessionProgress =
    (props.gameIndex + (roundIndex + (resolved ? 1 : 0)) / props.rounds) / props.gameCount;

  const captureLines = props.showCaptureDebug
    ? [
        `round ${roundIndex + 1}/${props.rounds} · tier ${round.tier} · odd tile ${round.oddIndex + 1}`,
        `prompt_end ${r.current.promptEnd ? new Date(r.current.promptEnd).toISOString().slice(14, 23) : '—'}`,
        `latency ${
          r.current.firstResponse && r.current.promptEnd
            ? `${r.current.firstResponse - r.current.promptEnd} ms`
            : 'awaiting first tap'
        } · repeats ${r.current.repeats}`,
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
        {round.tiles.map((tile, index) => (
          <TapTarget
            key={`${roundIndex}-${index}`}
            size={tileSize}
            state={tileStates[index] ?? 'idle'}
            disabled={!prompt.ready || resolved}
            accessibilityLabel={`Shape ${index + 1}`}
            onPress={() => onTapTile(index)}
          >
            <ShapeTile tile={tile} size={tileSize} />
          </TapTarget>
        ))}
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
});
