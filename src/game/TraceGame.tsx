import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { GAMES } from '../domain/games';
import { createRng, seedFromString } from '../lib/random';
import { successFeedback, tapFeedback } from '../lib/feedback';
import { playSound } from '../lib/sounds';
import { GameFrame } from './GameFrame';
import { useSpokenPrompt } from './useSpokenPrompt';
import { Txt } from '../ui/Txt';
import { color } from '../theme/tokens';
import type { GameProps } from './types';

/**
 * "Follow the Kite String" — grapho-motor tracing.
 *
 * A dotted path appears and the child drags a kite along it. What is measured
 * is not whether they get to the end — almost every child does — but how far
 * the finger wanders while getting there, how often it lifts off, and how much
 * of the path was actually followed.
 *
 * Deviation is reported as a share of the path's own diagonal rather than in
 * pixels, so a phone and a tablet produce comparable numbers.
 */

const GIVE_UP_AFTER_MS = 26_000;
const CELEBRATE_MS = 900;
/** Beyond this many multiples of the tolerance, forward progress stops counting. */
const PROGRESS_TOLERANCE_PX = 76;

type Pt = { x: number; y: number };

type PathKind = 'diagonal' | 'wave' | 'arc' | 'zigzag' | 'hill';
const PATH_KINDS: PathKind[] = ['diagonal', 'wave', 'arc', 'zigzag', 'hill'];

/** Normalised 0…1 path, sampled densely enough for distance maths to be smooth. */
function buildPath(kind: PathKind, samples = 60): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    switch (kind) {
      case 'diagonal':
        pts.push({ x: 0.08 + t * 0.84, y: 0.82 - t * 0.64 });
        break;
      case 'wave':
        pts.push({ x: 0.08 + t * 0.84, y: 0.5 - Math.sin(t * Math.PI * 2) * 0.3 });
        break;
      case 'arc':
        pts.push({
          x: 0.5 + Math.cos(Math.PI - t * Math.PI) * 0.42,
          y: 0.82 - Math.sin(Math.PI - t * Math.PI) * 0.62,
        });
        break;
      case 'zigzag': {
        const legs = 3;
        const seg = t * legs;
        const leg = Math.min(legs - 1, Math.floor(seg));
        const local = seg - leg;
        pts.push({
          x: 0.08 + t * 0.84,
          y: leg % 2 === 0 ? 0.78 - local * 0.56 : 0.22 + local * 0.56,
        });
        break;
      }
      case 'hill':
        pts.push({ x: 0.08 + t * 0.84, y: 0.8 - Math.sin(t * Math.PI) * 0.58 });
        break;
    }
  }
  return pts;
}

function scalePath(path: Pt[], w: number, h: number): Pt[] {
  return path.map(p => ({ x: p.x * w, y: p.y * h }));
}

/** Distance from p to segment ab, plus how far along ab the closest point sits. */
function segmentDistance(p: Pt, a: Pt, b: Pt): { dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { dist: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)), t };
}

export function TraceGame(props: GameProps) {
  const meta = GAMES.trace;
  const { width } = useWindowDimensions();
  const canvasW = Math.min(320, width - 48);
  const canvasH = Math.round(canvasW * 0.72);

  const [roundIndex, setRoundIndex] = useState(0);
  const [trail, setTrail] = useState<Pt[]>([]);
  const [progress, setProgress] = useState(0);
  const [resolved, setResolved] = useState(false);

  const kind = useMemo(() => {
    const rng = createRng(seedFromString(`${props.seed}:trace:${roundIndex}`));
    return PATH_KINDS[Math.floor(rng() * PATH_KINDS.length)];
  }, [props.seed, roundIndex]);

  const path = useMemo(
    () => scalePath(buildPath(kind), canvasW, canvasH),
    [kind, canvasW, canvasH],
  );

  /** Cumulative arc length, so "how far along" is a real distance not an index. */
  const arc = useMemo(() => {
    const out = [0];
    for (let i = 1; i < path.length; i += 1) {
      out.push(out[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    }
    return out;
  }, [path]);
  const totalLen = arc[arc.length - 1] || 1;
  const diagonal = Math.hypot(canvasW, canvasH);

  const r = useRef({
    promptEnd: 0,
    firstResponse: null as number | null,
    deviations: [] as number[],
    lifts: 0,
    maxArc: 0,
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
      deviations: [],
      lifts: 0,
      maxArc: 0,
      done: false,
    };
    setTrail([]);
    setProgress(0);
    setResolved(false);
  }, [roundIndex]);

  const advance = useCallback(() => {
    clearTimers();
    if (roundIndex + 1 >= props.rounds) props.onFinish();
    else setRoundIndex(i => i + 1);
  }, [clearTimers, props, roundIndex]);

  const finishRound = useCallback(
    (outcome: 'finished' | 'gave_up') => {
      if (r.current.done) return;
      r.current.done = true;
      clearTimers();
      setResolved(true);

      const now = Date.now();
      const completion = Math.min(1, r.current.maxArc / totalLen);
      const meanDev =
        r.current.deviations.length === 0
          ? null
          : r.current.deviations.reduce((a, b) => a + b, 0) / r.current.deviations.length;
      const deviationPct = meanDev === null ? undefined : meanDev / diagonal;

      // "Correct" here means the path was actually followed to the end. A child
      // who stops halfway has not produced a usable tracing sample.
      const correct = completion >= 0.9;
      if (correct) {
        playSound('correct');
        successFeedback();
      }

      const event = props.recorder.record({
        game_id: 'trace',
        round_number: roundIndex + 1,
        prompt_end_timestamp: r.current.promptEnd || now,
        first_response_timestamp: r.current.firstResponse,
        response_correct: correct,
        repeat_error_count: 0,
        round_end_timestamp: now,
        primary_metric: 'traceDeviationPct',
        extra: {
          trace_deviation_pct:
            deviationPct === undefined ? undefined : Number(deviationPct.toFixed(4)),
          trace_lifts: r.current.lifts,
          trace_completion: Number(completion.toFixed(3)),
          error_type:
            outcome === 'gave_up' && r.current.firstResponse === null
              ? 'no_response'
              : correct
                ? 'none'
                : 'wrong_order',
        },
      });
      props.onRound(event);
      addTimer(setTimeout(advance, correct ? CELEBRATE_MS : 400));
    },
    [advance, clearTimers, diagonal, props, roundIndex, totalLen],
  );

  const sample = useCallback(
    (p: Pt) => {
      if (r.current.done) return;
      if (r.current.firstResponse === null) r.current.firstResponse = Date.now();

      let best = Infinity;
      let bestArc = 0;
      for (let i = 1; i < path.length; i += 1) {
        const { dist, t } = segmentDistance(p, path[i - 1], path[i]);
        if (dist < best) {
          best = dist;
          bestArc = arc[i - 1] + t * (arc[i] - arc[i - 1]);
        }
      }
      r.current.deviations.push(best);

      // Progress only advances while the finger is somewhere near the line, so
      // a straight swipe across the canvas cannot "complete" the path.
      if (best < PROGRESS_TOLERANCE_PX && bestArc > r.current.maxArc) {
        r.current.maxArc = bestArc;
        setProgress(Math.min(1, bestArc / totalLen));
        if (bestArc / totalLen >= 0.97) finishRound('finished');
      }
      setTrail(prev => (prev.length > 260 ? prev : [...prev, p]));
    },
    [arc, finishRound, path, totalLen],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !resolved,
        onMoveShouldSetPanResponder: () => !resolved,
        onPanResponderGrant: e => {
          tapFeedback();
          sample({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
        },
        onPanResponderMove: e => {
          sample({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
        },
        onPanResponderRelease: () => {
          if (!r.current.done) r.current.lifts += 1;
        },
        onPanResponderTerminate: () => {
          if (!r.current.done) r.current.lifts += 1;
        },
      }),
    [resolved, sample],
  );

  const prompt = useSpokenPrompt({
    text:
      roundIndex === 0
        ? 'Put your finger on the green dot, then follow the line all the way to the kite'
        : 'Follow the line to the kite',
    cue: roundIndex,
    voiceEnabled: props.voiceEnabled,
    onPromptEnd: endedAt => {
      r.current.promptEnd = endedAt;
      addTimer(setTimeout(() => finishRound('gave_up'), GIVE_UP_AFTER_MS));
    },
  });

  const start = path[0];
  const end = path[path.length - 1];
  const sessionProgress =
    (props.gameIndex + (roundIndex + (resolved ? 1 : 0)) / props.rounds) / props.gameCount;

  const captureLines = props.showCaptureDebug
    ? [
        `round ${roundIndex + 1}/${props.rounds} · path ${kind}`,
        `along the path ${Math.round(progress * 100)}% · lifts ${r.current.lifts}`,
        `mean drift ${
          r.current.deviations.length
            ? `${Math.round(
                (r.current.deviations.reduce((a, b) => a + b, 0) /
                  r.current.deviations.length /
                  diagonal) *
                  1000,
              ) / 10}% of the canvas`
            : 'awaiting first touch'
        }`,
      ]
    : undefined;

  return (
    <GameFrame
      title={meta.title}
      prompt="Follow the line to the kite"
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
        <View
          {...responder.panHandlers}
          style={[styles.canvas, { width: canvasW, height: canvasH }]}
          accessibilityLabel="Trace the dotted line from the green dot to the kite"
        >
          <Svg width={canvasW} height={canvasH}>
            {/* The path to follow. */}
            <Polyline
              points={path.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={color.slateLine}
              strokeWidth={22}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Polyline
              points={path.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={`${meta.accent}88`}
              strokeWidth={3}
              strokeDasharray="2 12"
              strokeLinecap="round"
            />
            {/* What the child has drawn. */}
            {trail.length > 1 ? (
              <Polyline
                points={trail.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={meta.accent}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            <Circle cx={start.x} cy={start.y} r={13} fill={color.kite.parrot} />
            <Circle cx={end.x} cy={end.y} r={13} fill={color.kite.saffron} />
          </Svg>

          <Txt style={[styles.kite, { left: end.x - 15, top: end.y - 34 }]}>🪁</Txt>
        </View>

        {/* A dot per fifth of the path — progress the child can read without numbers. */}
        <View style={styles.beads}>
          {[0, 1, 2, 3, 4].map(i => (
            <View
              key={i}
              style={[
                styles.bead,
                { backgroundColor: progress > i / 5 ? meta.accent : `${meta.accent}33` },
              ]}
            />
          ))}
        </View>
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 24 },
  canvas: {
    backgroundColor: color.slateRaise,
    borderRadius: 24,
    overflow: 'hidden',
  },
  kite: { position: 'absolute', fontSize: 30 },
  beads: { flexDirection: 'row', gap: 10 },
  bead: { width: 12, height: 12, borderRadius: 6 },
});
