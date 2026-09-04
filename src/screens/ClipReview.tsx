import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Divider, Row } from '../ui/Bits';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav, useParams } from '../nav/navigation';
import { moduleName } from '../domain/games';
import { REFERENCE_NOTE, REFERENCE_PROVENANCE } from '../domain/norms';
import type { RoundEvent } from '../domain/telemetry';
import { formatClock, formatDate } from '../lib/time';
import { ageInYears } from '../lib/time';

/**
 * Screen 06 — Pediatrician clip review.
 *
 * Wireframe notes:
 *  1. Only the specific flagged segment is playable — never the family's full
 *     history or a raw footage archive.
 *  2. The same descriptive, non-diagnostic language as the parent report.
 *  3. Outcome tagging feeds the flag-usefulness measure.
 *
 * One honest departure from the wireframe's video thumbnail: Khil has no
 * camera. The "clip" is therefore a reconstruction of the flagged rounds from
 * tap timings — the only data the product actually holds. It is labelled as
 * such, because showing a clinician a fake video player would be the exact
 * overclaim the spec's framing note warns against.
 */

const TICK_MS = 60;
const ROUND_TAIL_MS = 900;

export function ClipReview() {
  const { state, child, sessions, flags, markOutcome } = useApp();
  const nav = useNav();
  const { flagId } = useParams<'clinicReview'>();

  const flag = flags.find(f => f.id === flagId);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [messaged, setMessaged] = useState(false);

  const clip = useMemo(() => {
    if (!flag) return null;
    const strongest = flag.signals.slice().sort((a, b) => b.strength - a.strength)[0];
    if (!strongest) return null;
    const session = sessions.find(s => s.session_id === strongest.session_id);
    if (!session) return null;

    const rounds = session.rounds.filter(r => r.game_id === strongest.game_id);
    let cursor = 0;
    const segments = rounds.map(round => {
      const taps = round.extra.taps ?? [];
      const span =
        (taps.length > 0
          ? taps[taps.length - 1].at
          : (round.response_latency_ms ?? 1500)) + ROUND_TAIL_MS;
      const segment = { round, start: cursor, duration: Math.max(600, span), taps };
      cursor += segment.duration;
      return segment;
    });

    const tileCount = Math.max(
      3,
      ...segments.flatMap(s => s.taps.map(tap => tap.target + 1)),
    );

    return {
      gameId: strongest.game_id,
      sessionId: session.session_id,
      observedAt: session.ended_at,
      segments,
      total: cursor,
      tileCount,
    };
  }, [flag, sessions]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || !clip) return;
    timer.current = setInterval(() => {
      setT(prev => {
        const next = prev + TICK_MS;
        if (next >= clip.total) {
          setPlaying(false);
          return clip.total;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, clip]);

  if (!flag || !clip) {
    return (
      <Screen background={color.paper} backLabel="patient list" title="Review">
        <Txt variant="body" tone="soft">
          This flag is no longer available for review.
        </Txt>
      </Screen>
    );
  }

  const activeIndex = Math.max(
    0,
    clip.segments.findIndex(s => t >= s.start && t < s.start + s.duration),
  );
  const active = clip.segments[activeIndex] ?? clip.segments[0];
  const localT = t - active.start;
  const visibleTaps = active.taps.filter(tap => tap.at <= localT);
  const lastTap = visibleTaps[visibleTaps.length - 1];

  const closed = flag.status.startsWith('closed');

  return (
    <Screen
      background={color.paper}
      backLabel="patient list"
      eyebrow="Specialist portal"
      title={`${child?.name ?? 'Patient'}, age ${
        child ? ageInYears(child.dob_iso) : '—'
      }`}
    >
      {/* Wireframe note 2 — identical language to the parent's report. */}
      <Card tone="notice" label="System note (not a diagnosis)">
        <Txt variant="body" tone="notice">
          {flag.clinician_note}
        </Txt>
      </Card>

      <Card tone="clinic" label={`Flagged segment · ${moduleName(clip.gameId)}`}>
        <Row style={styles.between}>
          <Row gap={space.md}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause replay' : 'Play replay'}
              onPress={() => {
                if (t >= clip.total) setT(0);
                setPlaying(p => !p);
              }}
              style={styles.playButton}
            >
              <Txt variant="heading" tone="inverse">
                {playing ? '❚❚' : '▶'}
              </Txt>
            </Pressable>
            <View>
              <Txt variant="bodyStrong" tone="ink">
                Gameplay replay
              </Txt>
              <Txt variant="micro" tone="faint">
                {formatClock(t)} / {formatClock(clip.total)} · round {activeIndex + 1} of{' '}
                {clip.segments.length}
              </Txt>
            </View>
          </Row>
          <Chip label="no video · no audio" tone="clinic" />
        </Row>

        {/* The reconstruction. Tiles light up as the recorded taps land. */}
        <View style={styles.stage}>
          {Array.from({ length: clip.tileCount }).map((_, index) => {
            const tapped = visibleTaps.filter(tap => tap.target === index);
            const isLast = lastTap?.target === index;
            const wasCorrect = tapped.some(tap => tap.correct);
            return (
              <View
                key={index}
                style={[
                  styles.tile,
                  tapped.length > 0 && styles.tileTapped,
                  wasCorrect && styles.tileCorrect,
                  isLast && styles.tileActive,
                ]}
              >
                <Txt variant="micro" tone={tapped.length > 0 ? 'ink' : 'faint'}>
                  {index + 1}
                </Txt>
                {tapped.length > 1 ? (
                  <Txt variant="micro" tone="notice">
                    ×{tapped.length}
                  </Txt>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Timeline: one block per round, one dot per recorded tap. */}
        <View style={styles.timeline}>
          {clip.segments.map((segment, index) => (
            <View
              key={segment.round.round_number}
              style={[
                styles.segment,
                { flex: segment.duration },
                index === activeIndex && styles.segmentActive,
              ]}
            >
              {segment.taps.map((tap, tapIndex) => (
                <View
                  key={tapIndex}
                  style={[
                    styles.tapDot,
                    {
                      left: `${Math.min(96, (tap.at / segment.duration) * 100)}%`,
                      backgroundColor: tap.correct ? color.positive : color.notice,
                      opacity: segment.start + tap.at <= t ? 1 : 0.25,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
          <View
            style={[styles.playhead, { left: `${Math.min(100, (t / clip.total) * 100)}%` }]}
          />
        </View>

        <Txt variant="micro" tone="faint" style={styles.mtMd}>
          Reconstructed from tap timings recorded on the family’s device. Khil holds no
          video or audio of any child. Only this segment was shared — not the child’s other
          sessions.
        </Txt>
      </Card>

      <Card label="Round detail">
        <RoundTable rounds={clip.segments.map(s => s.round)} activeIndex={activeIndex} />
        <Txt variant="micro" tone="faint" style={styles.mtMd}>
          Observed {formatDate(clip.observedAt)} · session {clip.sessionId}
        </Txt>
        {REFERENCE_PROVENANCE === 'prototype-placeholder' ? (
          <Txt variant="micro" tone="notice" style={styles.mtSm}>
            ⚠ {REFERENCE_NOTE}
          </Txt>
        ) : null}
      </Card>

      <Card label="Mark outcome">
        {closed ? (
          <Row gap={space.md}>
            <Chip
              label={
                flag.outcome?.outcome === 'needs_visit'
                  ? 'Marked: needs visit'
                  : 'Marked: not concerning'
              }
              tone={flag.outcome?.outcome === 'needs_visit' ? 'notice' : 'positive'}
              glyph="✓"
            />
          </Row>
        ) : (
          <View style={styles.outcomeRow}>
            <Button
              label="Not concerning"
              variant="secondary"
              onPress={() => {
                markOutcome(flag.id, 'not_concerning', 'specialist');
                nav.back();
              }}
            />
            <Button
              label="Needs visit"
              variant="clinic"
              onPress={() => {
                markOutcome(flag.id, 'needs_visit', 'specialist');
                nav.back();
              }}
            />
          </View>
        )}
        <Txt variant="micro" tone="faint" style={styles.mtMd}>
          Outcome tagging is how Khil measures whether its flags are useful. It is the only
          way the false-positive rate becomes visible.
        </Txt>
      </Card>

      <Card tone="sunk">
        {messaged ? (
          <Row gap={space.sm}>
            <Txt variant="small" tone="positive">
              ✓ Suggestion sent to the parent.
            </Txt>
          </Row>
        ) : (
          <Button
            label="Message parent — suggest consultation"
            variant="secondary"
            onPress={() => setMessaged(true)}
          />
        )}
      </Card>
    </Screen>
  );
}

/** The rule a round ran under — the thing whose change defines a task switch. */
function ruleOf(round: RoundEvent): number | null {
  const { difficulty_tier, word_tier, sequence_length } = round.extra;
  return difficulty_tier ?? word_tier ?? sequence_length ?? null;
}

function RoundTable({ rounds, activeIndex }: { rounds: RoundEvent[]; activeIndex: number }) {
  return (
    <View>
      <Row style={styles.tableHead}>
        <Txt variant="micro" tone="faint" style={styles.colRound}>
          #
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.colRule}>
          rule
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.col}>
          latency
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.col}>
          gap
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.colNarrow}>
          rep
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.colEnd}>
          match
        </Txt>
      </Row>
      {rounds.map((round, index) => {
        const rule = ruleOf(round);
        const previousRule = index > 0 ? ruleOf(rounds[index - 1]) : null;
        const switched = previousRule !== null && rule !== null && rule !== previousRule;
        return (
          <View key={round.round_number}>
            <Divider />
            <Row style={[styles.tableRow, index === activeIndex && styles.tableRowActive]}>
              <Txt variant="small" tone="faint" style={styles.colRound}>
                {round.round_number}
              </Txt>
              <Txt
                variant="small"
                tone={switched ? 'notice' : 'faint'}
                style={styles.colRule}
              >
                {rule === null ? '—' : switched ? `⤳ ${rule}` : `${rule}`}
              </Txt>
              <Txt variant="small" style={styles.col}>
                {round.response_latency_ms === null ? '—' : `${round.response_latency_ms} ms`}
              </Txt>
              <Txt variant="small" tone="faint" style={styles.col}>
                {round.task_switch_time_ms === null ? '—' : `${round.task_switch_time_ms} ms`}
              </Txt>
              <Txt variant="small" style={styles.colNarrow}>
                {round.repeat_error_count}
              </Txt>
              <Txt
                variant="small"
                tone={round.response_correct ? 'positive' : 'notice'}
                style={styles.colEnd}
              >
                {round.response_correct ? 'yes' : 'no'}
              </Txt>
            </Row>
          </View>
        );
      })}
      <Divider />
      <Txt variant="micro" tone="faint" style={styles.mtSm}>
        <Txt variant="micro" tone="notice">
          ⤳
        </Txt>{' '}
        marks a round where the game changed what it was asking for. The switch cost in the
        note above is the difference between those rounds and the rounds either side of
        them — a comparison within this child’s own timings.
      </Txt>
      <Txt variant="micro" tone="faint" style={styles.mtSm}>
        latency = end of the spoken instruction to the first tap. gap = previous round
        ending to this round’s first tap; it includes the spoken instruction, so it is
        shown for context and is not what the flag was based on.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: color.slate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.lg,
    justifyContent: 'center',
  },
  tile: {
    flex: 1,
    maxWidth: 76,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileTapped: { borderColor: color.notice, backgroundColor: color.noticeSurface },
  tileCorrect: { borderColor: color.positive, backgroundColor: color.positiveSoft },
  tileActive: { borderWidth: 2 },
  timeline: {
    flexDirection: 'row',
    gap: 3,
    height: 26,
    marginTop: space.lg,
    position: 'relative',
  },
  segment: {
    height: 26,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: color.hairline,
    position: 'relative',
    overflow: 'hidden',
  },
  segmentActive: { borderColor: color.slate, borderWidth: 1.6 },
  tapDot: {
    position: 'absolute',
    top: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playhead: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 32,
    backgroundColor: color.slate,
  },
  tableHead: { paddingBottom: space.sm },
  tableRow: { paddingVertical: space.sm },
  tableRowActive: { backgroundColor: color.paper },
  colRound: { width: 20 },
  colRule: { width: 34 },
  colNarrow: { width: 26, textAlign: 'center' },
  col: { flex: 1 },
  colEnd: { width: 42, textAlign: 'right' },
  outcomeRow: { gap: space.sm },
  mtSm: { marginTop: space.sm },
  mtMd: { marginTop: space.md },
});
