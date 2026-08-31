import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GAMES } from '../domain/games';
import { bandForAge } from '../domain/norms';
import { createRng, seedFromString } from '../lib/random';
import { padFeedback, successFeedback } from '../lib/feedback';
import { playSound } from '../lib/sounds';
import type { TapMark } from '../domain/telemetry';
import { GameFrame } from './GameFrame';
import { TapTarget, type TileState } from './TapTarget';
import { languageTierForRound, makeLanguageRound, type LanguageRound } from './content/words';
import { useSpokenPrompt } from './useSpokenPrompt';
import { Txt } from '../ui/Txt';
import type { GameProps } from './types';

/**
 * Game 2 — "Point to the One I Say" (spec §2).
 *
 * Logs response latency, accuracy by word-difficulty tier, and a coarse proxy
 * for "tapped immediately vs. scanned all the options first".
 *
 * On that proxy, honestly: a phone gives us touch events, not gaze. So
 * `scanned_before_choosing` is defined as "first response landed after the
 * midpoint of this age band's typical latency range" — a deliberate,
 * documented approximation, and one the flag engine never reads on its own.
 */

const NUDGE_AFTER_MS = 9_000;
const GIVE_UP_AFTER_MS = 22_000;
const CELEBRATE_MS = 900;

export function LanguageGame(props: GameProps) {
  const meta = GAMES.language;
  const { width } = useWindowDimensions();
  const [roundIndex, setRoundIndex] = useState(0);
  const [tileStates, setTileStates] = useState<Record<number, TileState>>({});
  const [resolved, setResolved] = useState(false);

  const round: LanguageRound = useMemo(() => {
    const rng = createRng(seedFromString(`${props.seed}:language:${roundIndex}`));
    return makeLanguageRound(rng, languageTierForRound(roundIndex, props.rounds));
  }, [props.seed, props.rounds, roundIndex]);

  const scanThresholdMs = useMemo(() => {
    const band = bandForAge(props.ageMonths).metrics.responseLatencyMs;
    return (band.low + band.high) / 2;
  }, [props.ageMonths]);

  const r = useRef({
    promptEnd: 0,
    firstResponse: null as number | null,
    firstCorrect: null as boolean | null,
    taps: [] as TapMark[],
    wrongPicks: {} as Record<number, number>,
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
      wrongPicks: {},
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
      const latency =
        r.current.firstResponse === null ? null : r.current.firstResponse - r.current.promptEnd;

      const event = props.recorder.record({
        game_id: 'language',
        round_number: roundIndex + 1,
        prompt_end_timestamp: r.current.promptEnd || now,
        first_response_timestamp: r.current.firstResponse,
        response_correct: r.current.firstCorrect === true,
        repeat_error_count: r.current.repeats,
        round_end_timestamp: now,
        primary_metric: 'responseLatencyMs',
        extra: {
          word_tier: round.tier,
          scanned_before_choosing: latency === null ? undefined : latency > scanThresholdMs,
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
    [advance, clearTimers, props, round.tier, roundIndex, scanThresholdMs],
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

  const onTapOption = useCallback(
    (index: number) => {
      if (!prompt.ready || r.current.done) return;
      const now = Date.now();
      const correct = index === round.correctIndex;

      if (r.current.firstResponse === null) {
        r.current.firstResponse = now;
        r.current.firstCorrect = correct;
      }
      r.current.taps.push({ at: now - r.current.promptEnd, target: index, correct });

      if (correct) {
        setResolved(true);
        setTileStates(() => {
          const next: Record<number, TileState> = {};
          round.options.forEach((_, i) => {
            next[i] = i === index ? 'correct' : 'dimmed';
          });
          return next;
        });
        playSound('correct');
        successFeedback();
        finishRound('answered');
        return;
      }

      const previous = r.current.wrongPicks[index] ?? 0;
      r.current.wrongPicks[index] = previous + 1;
      if (previous >= 1) r.current.repeats += 1;

      setTileStates(prev => ({ ...prev, [index]: 'wrong' }));
      playSound('retry');
      padFeedback();
      addTimer(
        setTimeout(() => {
          setTileStates(prev => (prev[index] === 'wrong' ? { ...prev, [index]: 'idle' } : prev));
        }, 420),
      );
    },
    [finishRound, prompt.ready, round.correctIndex, round.options],
  );

  const columns = round.options.length > 3 ? 2 : 3;
  const gap = 14;
  const tileSize = Math.min(
    columns === 2 ? 150 : 108,
    Math.floor((width - 32 - gap * (columns - 1)) / columns),
  );

  const sessionProgress =
    (props.gameIndex + (roundIndex + (resolved ? 1 : 0)) / props.rounds) / props.gameCount;

  const captureLines = props.showCaptureDebug
    ? [
        `round ${roundIndex + 1}/${props.rounds} · word tier ${round.tier}`,
        `options ${round.options.length} · target "${round.options[round.correctIndex]?.word}"`,
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
      <View style={[styles.grid, { gap, maxWidth: columns * tileSize + gap * (columns - 1) }]}>
        {round.options.map((option, index) => (
          <TapTarget
            key={`${roundIndex}-${option.id}`}
            size={tileSize}
            state={tileStates[index] ?? 'idle'}
            disabled={!prompt.ready || resolved}
            accessibilityLabel={option.word}
            onPress={() => onTapOption(index)}
          >
            <Txt style={[styles.emoji, { fontSize: tileSize * 0.5 }]}>{option.emoji}</Txt>
          </TapTarget>
        ))}
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  emoji: { textAlign: 'center' },
});
