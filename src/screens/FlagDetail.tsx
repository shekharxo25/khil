import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Divider, Row } from '../ui/Bits';
import { color, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav, useParams } from '../nav/navigation';
import { REASSURANCE_BODY, REASSURANCE_TITLE, FLAG_RULES } from '../domain/flagEngine';
import { REFERENCE_NOTE, REFERENCE_PROVENANCE } from '../domain/norms';
import { clusterByPin } from '../domain/coverage';
import { formatDate } from '../lib/time';

/**
 * Screen 04 — Flag detail / report.
 *
 * Wireframe notes:
 *  1. Stays behavioural and descriptive, even in the detailed view.
 *  2. A dedicated reassurance block, positioned before the decision.
 *  3. "Remind me later" is a real option — forcing a booking would be coercive.
 *
 * The evidence table below goes beyond the wireframe on purpose. A parent who
 * is told "this differed from typical" deserves to see which measure, what the
 * value was, what it is being compared against, and — crucially — that the
 * comparison range is a prototype placeholder rather than a clinical threshold.
 */
export function FlagDetail() {
  const { state, bookAppointment, snoozeFlag } = useApp();
  const nav = useNav();
  const { flagId } = useParams<'flagDetail'>();

  const flag = state.flags.find(f => f.id === flagId);
  const specialist = state.child ? clusterByPin(state.child.pin)?.specialist : undefined;

  if (!flag) {
    return (
      <Screen backLabel="back" title="Flag report">
        <Txt variant="body" tone="soft">
          This report is no longer available.
        </Txt>
      </Screen>
    );
  }

  const booked = flag.status === 'booked';

  return (
    <Screen
      backLabel="back"
      title="Flag report"
      footer={
        booked ? (
          <>
            <Chip
              label={`Appointment requested with ${specialist?.name ?? 'the specialist'}`}
              tone="positive"
              glyph="✓"
            />
            <Button label="Back to progress" variant="secondary" onPress={() => nav.reset('parentHome')} />
          </>
        ) : (
          <>
            <Button
              label={`Book ${specialist?.name ?? 'the specialist'}`}
              variant="notice"
              onPress={() => {
                bookAppointment(flag.id);
              }}
            />
            <Button
              label="Remind me later"
              variant="quiet"
              onPress={() => {
                snoozeFlag(flag.id, 7);
                nav.reset('parentHome');
              }}
            />
          </>
        )
      }
    >
      <View>
        <Txt variant="label" tone="faint">
          Observed on
        </Txt>
        <Txt variant="bodyStrong" style={styles.mtXs}>
          {flag.observed_label}
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.mtXs}>
          Drawn from {flag.session_ids.length} sessions between{' '}
          {formatDate(flag.window_start)} and {formatDate(flag.window_end)}
        </Txt>
      </View>

      <Card tone="notice" label="What we noticed">
        <Txt variant="heading" tone="notice">
          {flag.parent_body}
        </Txt>
      </Card>

      <Card label="What was measured">
        {flag.evidence.map((item, index) => (
          <View key={item.signal_id}>
            {index > 0 ? <Divider style={styles.rowDivider} /> : null}
            <Txt variant="bodyStrong">{item.measure}</Txt>
            {/*
              Stacked label→value rows rather than three columns: at 375pt the
              columns wrap into each other and "up to 560 ms extra" stops being
              readable as one figure.
            */}
            <View style={styles.evidenceRows}>
              <EvidenceRow label="Observed" value={item.observed} emphasis />
              <EvidenceRow label="Typical for this age" value={item.expected_range} />
              <EvidenceRow
                label="Seen in"
                value={`${item.sessions} session${item.sessions === 1 ? '' : 's'}`}
              />
            </View>
            <Txt variant="micro" tone="faint" style={styles.mtSm}>
              {item.modules.join(' · ')}
            </Txt>
          </View>
        ))}

        {REFERENCE_PROVENANCE === 'prototype-placeholder' ? (
          <View style={styles.provenance}>
            <Txt variant="micro" tone="notice">
              ⚠ {REFERENCE_NOTE}
            </Txt>
          </View>
        ) : null}
      </Card>

      <Card tone="brand" label={REASSURANCE_TITLE}>
        <Txt variant="body">{REASSURANCE_BODY}</Txt>
        <Txt variant="small" tone="soft" style={styles.mtMd}>
          Khil will not raise this again while it is open, and never raises anything from a
          single game or a single day.
        </Txt>
      </Card>

      <Card tone="sunk" label="Why this was raised">
        <Txt variant="small" tone="soft">
          Khil only says something when all of the following are true:
        </Txt>
        <View style={styles.rules}>
          <Rule text={`Play across at least ${FLAG_RULES.minValidSessions} complete sessions in ${FLAG_RULES.windowDays} days`} />
          <Rule text={`At least ${FLAG_RULES.minSignals} separate observations outside the typical range`} />
          <Rule text={`Those observations span at least ${FLAG_RULES.minDistinctSessions} different sessions`} />
          <Rule text={`At least ${FLAG_RULES.minDistinctSignalTypes} different kinds of observation, not the same one repeatedly`} />
          <Rule text="At least one kind repeats across sessions, so a single off-day cannot cause it" />
        </View>
      </Card>

      <Card label="What happens if you book">
        <Txt variant="small" tone="soft">
          {specialist?.name ?? 'The specialist'} receives this description and a replay of the
          flagged rounds — the taps and timings only. No video, no audio, and none of your
          child’s other sessions.
        </Txt>
      </Card>
    </Screen>
  );
}

function EvidenceRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Row style={styles.evidenceRow} align="baseline">
      <Txt variant="small" tone="faint" style={styles.evidenceLabel}>
        {label}
      </Txt>
      <Txt
        variant="bodyStrong"
        tone={emphasis ? 'notice' : 'soft'}
        style={styles.evidenceValue}
      >
        {value}
      </Txt>
    </Row>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <Row gap={space.sm} align="flex-start">
      <Txt variant="small" tone="brand">
        ✓
      </Txt>
      <Txt variant="small" tone="soft" style={styles.grow}>
        {text}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  mtXs: { marginTop: space.xs },
  mtSm: { marginTop: space.sm },
  mtMd: { marginTop: space.md },
  evidenceRows: { marginTop: space.md, gap: space.sm },
  evidenceRow: { justifyContent: 'space-between', gap: space.md },
  evidenceLabel: { flexShrink: 1 },
  evidenceValue: { textAlign: 'right' },
  rowDivider: { marginVertical: space.lg },
  provenance: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: 10,
    backgroundColor: color.noticeSurface,
    borderWidth: 1,
    borderColor: color.noticeEdge,
  },
  rules: { marginTop: space.md, gap: space.sm },
});
