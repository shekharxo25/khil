import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GAMES } from '../domain/games';
import { createRng, seedFromString } from '../lib/random';
import { padFeedback, successFeedback } from '../lib/feedback';
import { playSound } from '../lib/sounds';
import { tierForRound } from '../domain/tiers';
import type { TapMark } from '../domain/telemetry';
import { GameFrame } from './GameFrame';
import { TapTarget, type TileState } from './TapTarget';
import { makeRhymeRound, type RhymeRound } from './content/rhymes';
import { useSpokenPrompt } from './useSpokenPrompt';
import { Txt } from '../ui/Txt';
import { color, radius, space } from '../theme/tokens';
import type { GameProps } from './types';

/**
 * "Sounds the Same" — rhyme and initial-sound matching.
 *
 * Entirely spoken and entirely pictorial. The cue word is said aloud and shown
 * as a picture; the options are pictures. No letter appears anywhere in this
 * game, which is the point: it checks whether a child hears that two words end
 * the same way, before reading is on the table at all.
 */

const NUDGE_AFTER_MS = 10_000;
const GIVE_UP_AFTER_MS = 24_000;
const CELEBRATE_MS = 900;

export function RhymeGame(props: GameProps) {
  const meta = GAMES.rhyme;
  const { width } = useWindowDimensions();
  const [roundIndex, setRoundIndex] = useState(0);
  const [tileStates, setTileStates] = useState<Record<number, TileState>>({});
  const [resolved, setResolved] = useState(false);

  const round: RhymeRound = useMemo(() => {
    const rng = createRng(seedFromString(`${props.seed}:rhyme:${roundIndex}`));
    return makeRhymeRound(rng, tierForRound(roundIndex, props.rounds));
  }, [props.seed, props.rounds, roundIndex]);

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
      const event = props.recorder.record({
        game_id: 'rhyme',
        round_number: roundIndex + 1,
        prompt_end_timestamp: r.current.promptEnd || now,
        first_response_timestamp: r.current.firstResponse,
        response_correct: r.current.firstCorrect === true,
        repeat_error_count: r.current.repeats,
        round_end_timestamp: now,
        primary_metric: 'responseLatencyMs',
        extra: {
          // Tier doubles as the switch-cost rule: rhyme rounds and
          // starts-the-same rounds are genuinely different tasks.
          word_tier: round.tier,
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
    [advance, clearTimers, props, round.tier, roundIndex],
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

  const tileSize = Math.min(104, Math.floor((width - 32 - 28) / 3));
  const sessionProgress =
    (props.gameIndex + (roundIndex + (resolved ? 1 : 0)) / props.rounds) / props.gameCount;

  const captureLines = props.showCaptureDebug
    ? [
        `round ${roundIndex + 1}/${props.rounds} · tier ${round.tier} (${round.tier === 3 ? 'starts-like' : 'rhyme'})`,
        `cue "${round.cue.word}" · target "${round.options[round.correctIndex]?.word}"`,
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
      <View style={styles.wrap}>
        {/* The cue sits apart and above, so it reads as the thing being matched
            rather than a fourth option. */}
        <View style={[styles.cue, { borderColor: `${meta.accent}66` }]}>
          <Txt style={styles.cueEmoji}>{round.cue.emoji}</Txt>
        </View>

        <View style={styles.row}>
          {round.options.map((option, index) => (
            <TapTarget
              key={`${roundIndex}-${option.word}`}
              size={tileSize}
              state={tileStates[index] ?? 'idle'}
              disabled={!prompt.ready || resolved}
              accessibilityLabel={option.word}
              onPress={() => onTap(index)}
            >
              <Txt style={{ fontSize: tileSize * 0.48 }}>{option.emoji}</Txt>
            </TapTarget>
          ))}
        </View>
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xxl },
  cue: {
    width: 116,
    height: 116,
    borderRadius: radius.xl,
    borderWidth: 3,
    borderStyle: 'dashed',
    backgroundColor: color.slateRaise,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cueEmoji: { fontSize: 58 },
  row: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
});
