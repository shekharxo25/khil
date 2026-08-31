import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BloomMark, Chip, Divider, ProgressBar, Row, StatTile } from '../ui/Bits';
import { color, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { DOMAIN_COUNT, DOMAINS, domainLabel } from '../domain/domains';
import { GAMES } from '../domain/games';
import { planSession, weekCoverage, weeklyFocus, domainsTrackedThisWeek } from '../domain/rotation';
import { clusterByPin } from '../domain/coverage';
import { ageInMonths, relativeDay, startOfWeek } from '../lib/time';

/**
 * Screen 03 — Parent dashboard.
 *
 * Wireframe note 1 is the layout brief: "Dashboard defaults to progress /
 * engagement framing first — flags are important but should never be the
 * dominant visual tone of the home screen."
 *
 * So progress comes first, the flag sits in a sand-toned card below it, and
 * nothing on this screen is red.
 */
export function ParentDashboard() {
  const { state } = useApp();
  const nav = useNav();
  const child = state.child;

  const ageMonths = child ? ageInMonths(child.dob_iso) : 48;
  const weekStart = startOfWeek().getTime();

  const sessionsThisWeek = state.sessions.filter(
    s => s.ended_at >= weekStart && !s.abandoned,
  ).length;

  const coverage = useMemo(() => weekCoverage(state.sessions), [state.sessions]);
  const tracked = domainsTrackedThisWeek(coverage);
  const focus = weeklyFocus(coverage);

  const plan = useMemo(
    () =>
      planSession({
        ageMonths,
        sessions: state.sessions,
        mvpOnly: state.settings.mvpOnly,
      }),
    [ageMonths, state.sessions, state.settings.mvpOnly],
  );

  const openFlag = state.flags.find(
    f => f.status === 'open' || f.status === 'booked' || f.status === 'snoozed',
  );
  const specialist = child ? clusterByPin(child.pin)?.specialist : undefined;
  const lastSession = state.sessions[state.sessions.length - 1];

  const minutes = Math.max(2, Math.round(plan.estimated_ms / 60000));

  return (
    <Screen
      footer={
        <Button
          label={`Start today’s play · ${minutes} min`}
          glyph="▶"
          onPress={() => nav.push('sessionIntro')}
        />
      }
    >
      <Row style={styles.topBar}>
        <Row gap={space.sm}>
          <BloomMark size={26} />
          <Txt variant="label" tone="faint">
            Khil
          </Txt>
        </Row>
        <Pressable onPress={() => nav.push('devPanel')} hitSlop={10}>
          <Txt variant="micro" tone="faint">
            settings ›
          </Txt>
        </Pressable>
      </Row>

      <Txt variant="display">{child ? `${child.name}’s progress` : 'Progress'}</Txt>
      {lastSession ? (
        <Txt variant="small" tone="faint" style={styles.negTop}>
          Last played {relativeDay(lastSession.ended_at).toLowerCase()}
        </Txt>
      ) : (
        <Txt variant="small" tone="faint" style={styles.negTop}>
          No sessions yet — the first one takes about three minutes.
        </Txt>
      )}

      <Card>
        <Row align="flex-start">
          <StatTile
            value={sessionsThisWeek}
            caption={`session${sessionsThisWeek === 1 ? '' : 's'} this week`}
          />
          <View style={styles.statDivider} />
          <StatTile
            value={`${tracked.length}`}
            caption={`of ${DOMAIN_COUNT} skills tracked`}
            tint={color.accent}
          />
        </Row>

        <View style={styles.progressBlock}>
          <ProgressBar value={tracked.length / DOMAIN_COUNT} tint={color.accent} />
        </View>

        <Divider style={styles.divider} />

        <Txt variant="label" tone="faint">
          This week’s focus
        </Txt>
        <Txt variant="bodyStrong" style={styles.mtXs}>
          {focus.length > 0
            ? focus.map(domainLabel).join(' · ')
            : 'Nothing yet — start a session to begin'}
        </Txt>

        <Pressable onPress={() => nav.push('skills')} hitSlop={8} style={styles.link}>
          <Txt variant="small" tone="brand">
            See all six skill areas ›
          </Txt>
        </Pressable>
      </Card>

      {/* The flag. Sand, not red. Plain language, no score, no clinical term. */}
      {openFlag ? (
        <Card tone="notice">
          <Row gap={space.sm} align="flex-start">
            <Txt variant="heading" tone="notice">
              ⚑
            </Txt>
            <View style={styles.grow}>
              <Txt variant="label" tone="notice">
                {openFlag.parent_headline}
              </Txt>
              <Txt variant="body" tone="notice" style={styles.mtSm}>
                {openFlag.parent_body}
              </Txt>
              <Txt variant="small" tone="notice" style={styles.mtSm}>
                This is not a diagnosis — just something worth having a specialist look at.
              </Txt>

              {openFlag.status === 'booked' ? (
                <View style={styles.mtMd}>
                  <Chip label={`Appointment requested with ${specialist?.name}`} tone="notice" glyph="✓" />
                </View>
              ) : (
                <View style={styles.actions}>
                  <Button
                    label={`Book ${specialist?.name ?? 'the specialist'}`}
                    variant="notice"
                    onPress={() => nav.push('flagDetail', { flagId: openFlag.id })}
                  />
                  <Button
                    label="View full report"
                    variant="secondary"
                    onPress={() => nav.push('flagDetail', { flagId: openFlag.id })}
                  />
                </View>
              )}
            </View>
          </Row>
        </Card>
      ) : (
        <Card tone="sunk">
          <Txt variant="label" tone="faint">
            Nothing to look at right now
          </Txt>
          <Txt variant="small" tone="soft" style={styles.mtXs}>
            Khil only says something when the same unusual pattern shows up across several
            sessions and more than one kind of game. Most weeks, it stays quiet.
          </Txt>
        </Card>
      )}

      <Card label="Up next">
        <Txt variant="bodyStrong">
          {plan.games.map(g => GAMES[g.game_id].title).join('  ·  ')}
        </Txt>
        <Txt variant="small" tone="soft" style={styles.mtXs}>
          {plan.rationale}
        </Txt>
        <Row gap={space.sm} wrap style={styles.mtMd}>
          {plan.domains.map(d => (
            <Chip key={d} label={DOMAINS[d].label} glyph={DOMAINS[d].emoji} />
          ))}
        </Row>
      </Card>

      <Pressable onPress={() => nav.push('clinicList')} style={styles.portalLink}>
        <Txt variant="small" tone="soft">
          Specialist portal
        </Txt>
        <Txt variant="micro" tone="faint">
          For {specialist?.name ?? 'the matched clinic'} — shown here so you can see exactly
          what they would see. ›
        </Txt>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { justifyContent: 'space-between' },
  negTop: { marginTop: -10 },
  grow: { flex: 1 },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: color.hairline,
    marginHorizontal: space.md,
  },
  progressBlock: { marginTop: space.lg },
  divider: { marginVertical: space.lg },
  mtXs: { marginTop: space.xs },
  mtSm: { marginTop: space.sm },
  mtMd: { marginTop: space.md },
  link: { marginTop: space.md },
  actions: { marginTop: space.lg, gap: space.sm },
  portalLink: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairlineStrong,
    borderRadius: 14,
    padding: space.lg,
    gap: 2,
    backgroundColor: '#FFFFFF88',
  },
});
