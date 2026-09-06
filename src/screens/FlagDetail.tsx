import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Row } from '../ui/Bits';
import { space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav, useParams } from '../nav/navigation';
import { REASSURANCE_BODY, REASSURANCE_TITLE, FLAG_RULES } from '../domain/flagEngine';
import { clusterByPin } from '../domain/coverage';
import { formatDate } from '../lib/time';

/**
 * Screen 04 — Flag detail / report.
 *
 * Milestone spec v0.2, §1, is explicit and specific here:
 *
 *   "This section should never show the raw behavioral data or 'symptoms'
 *    (e.g. never say 'repetitive selections' or 'slow task-switching' —
 *    that's for the pediatrician's view only, not the parent's). The parent
 *    gets the conclusion in kind language, not the clinical observation
 *    itself."
 *
 * The earlier build showed a "What was measured" evidence table here, with
 * per-signal observed values and reference ranges. That table is now
 * pediatrician-only (see screens/ClipReview.tsx) — this screen keeps the
 * plain-language conclusion, the reassurance block, and an explanation of the
 * *process* that raised it (session counts, not measurements), but nothing
 * that reads as a lab result. `domain/safeLanguage.ts`'s
 * `assertParentSafeCopy` is the code-level enforcement of this; this file is
 * the UI-level one.
 *
 * Wireframe notes 1–3 (behavioural language, a reassurance block, "remind me
 * later" as a real option) all still hold.
 */
export function FlagDetail() {
  const { state, child, flags, bookAppointment, snoozeFlag } = useApp();
  const nav = useNav();
  const { flagId } = useParams<'flagDetail'>();

  const flag = flags.find(f => f.id === flagId);
  const specialist = state.account ? clusterByPin(state.account.pin)?.specialist : undefined;

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
          {formatDate(flag.window_start)} and {formatDate(flag.window_end)}, and already
          reviewed by {specialist?.name ?? 'the matched specialist'} before reaching you.
        </Txt>
      </View>

      <Card tone="notice" label="What we noticed">
        <Txt variant="heading" tone="notice">
          {flag.parent_body}
        </Txt>
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
          <Rule text="The same kind of unusual pattern shows up more than once, not just on one day" />
          <Rule text="More than one kind of pattern noticed, not the same single thing repeated" />
          <Rule text={`A specialist has reviewed it and agreed it’s worth mentioning to you`} />
        </View>
      </Card>

      <Card label="What happens if you book">
        <Txt variant="small" tone="soft">
          {specialist?.name ?? 'The specialist'} has already seen the specific flagged moments —
          never your child’s full session history, never video or audio — and can now
          arrange a visit directly.
        </Txt>
        <Pressable
          onPress={() => nav.push('messages', { childId: flag.child_id })}
          hitSlop={8}
          style={styles.mtMd}
        >
          <Txt variant="small" tone="brand">
            Message {specialist?.name ?? 'the clinic'} instead ›
          </Txt>
        </Pressable>

        <Pressable
          onPress={() => nav.push('chat', { childId: flag.child_id, flagId: flag.id })}
          hitSlop={8}
          style={styles.mtMd}
        >
          <Txt variant="small" tone="brand">
            💬 Chat about this flag ›
          </Txt>
        </Pressable>
      </Card>
    </Screen>
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
  mtMd: { marginTop: space.md },
  rules: { marginTop: space.md, gap: space.sm },
});
