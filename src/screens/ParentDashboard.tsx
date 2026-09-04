import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Divider, Row } from '../ui/Bits';
import { Bloom } from '../ui/Bloom';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { DOMAIN_COUNT, DOMAINS, domainLabel } from '../domain/domains';
import { GAMES } from '../domain/games';
import {
  WEEKLY_DOMAIN_TARGET,
  planSession,
  weekCoverage,
  weeklyFocus,
  domainsTrackedThisWeek,
} from '../domain/rotation';
import { clusterByPin } from '../domain/coverage';
import { ageInMonths, relativeDay, startOfWeek } from '../lib/time';

/**
 * Screen 03 — Parent dashboard.
 *
 * Wireframe note 1 is the layout brief: "Dashboard defaults to progress /
 * engagement framing first — flags are important but should never be the
 * dominant visual tone of the home screen."
 *
 * The bloom does that job. It is the largest thing on the page and it is about
 * play, not concern; the flag sits below it in an indigo card that reads as
 * "look at this" rather than "something is wrong". Nothing here is red.
 */
export function ParentDashboard() {
  const { state, child, sessions, flags, profiles } = useApp();
  const nav = useNav();

  const ageMonths = child ? ageInMonths(child.dob_iso) : 48;
  const weekStart = startOfWeek().getTime();

  const sessionsThisWeek = sessions.filter(
    s => s.ended_at >= weekStart && !s.abandoned,
  ).length;

  const coverage = useMemo(() => weekCoverage(sessions), [sessions]);
  const tracked = domainsTrackedThisWeek(coverage);
  const focus = weeklyFocus(coverage);

  const plan = useMemo(
    () =>
      planSession({
        ageMonths,
        sessions,
        mvpOnly: state.settings.mvpOnly,
      }),
    [ageMonths, sessions, state.settings.mvpOnly],
  );

  const openFlag = flags.find(
    f => f.status === 'open' || f.status === 'booked' || f.status === 'snoozed',
  );
  const specialist = state.account ? clusterByPin(state.account.pin)?.specialist : undefined;
  const lastSession = sessions[sessions.length - 1];
  const minutes = Math.max(2, Math.round(plan.estimated_ms / 60000));

  return (
    <Screen
      footer={
        <>
          <Button
            label={`Start today’s play · ${minutes} min`}
            glyph="▶"
            onPress={() => nav.push('sessionIntro')}
          />
          <Pressable onPress={() => nav.push('gamePicker')} hitSlop={8}>
            <Txt variant="small" tone="brand" center>
              Choose a game instead ›
            </Txt>
          </Pressable>
        </>
      }
    >
      {/* Profile switcher, so a parent with two children is one tap from the other. */}
      <Row style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Playing as ${child?.name ?? 'nobody'}. Switch child.`}
          onPress={() => nav.push('profileGate')}
          style={styles.switcher}
        >
          <View style={[styles.avatar, { backgroundColor: child?.avatar.color ?? color.slate }]}>
            <Txt style={styles.avatarGlyph}>{child?.avatar.glyph ?? '🪁'}</Txt>
          </View>
          <View>
            <Txt variant="smallStrong">{child?.name ?? 'Select a child'}</Txt>
            <Txt variant="micro" tone="faint">
              {profiles.length > 1 ? 'Switch child ›' : 'Your account ›'}
            </Txt>
          </View>
        </Pressable>

        <Pressable onPress={() => nav.push('devPanel')} hitSlop={10}>
          <Txt variant="micro" tone="faint">
            settings ›
          </Txt>
        </Pressable>
      </Row>

      <Txt variant="display">{child ? `${child.name}’s week` : 'This week'}</Txt>
      <Txt variant="small" tone="faint" style={styles.negTop}>
        {lastSession
          ? `Last played ${relativeDay(lastSession.ended_at).toLowerCase()}`
          : 'No sessions yet — the first one takes about three minutes.'}
      </Txt>

      {/* The bloom: one petal per skill area, filling as the week covers it. */}
      <Card>
        <View style={styles.bloomWrap}>
          <Bloom
            coverage={coverage}
            target={WEEKLY_DOMAIN_TARGET}
            size={216}
            centerLabel={`${tracked.length}`}
            centerCaption={`of ${DOMAIN_COUNT}`}
            onPress={() => nav.push('skills')}
          />
        </View>

        <Row style={styles.statRow}>
          <View style={styles.stat}>
            <Txt variant="title">{sessionsThisWeek}</Txt>
            <Txt variant="small" tone="soft">
              session{sessionsThisWeek === 1 ? '' : 's'} this week
            </Txt>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Txt variant="title">
              {tracked.length}
              <Txt variant="small" tone="faint">
                {' '}
                / {DOMAIN_COUNT}
              </Txt>
            </Txt>
            <Txt variant="small" tone="soft">
              skill areas touched
            </Txt>
          </View>
        </Row>

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
            See all {DOMAIN_COUNT} skill areas ›
          </Txt>
        </Pressable>
      </Card>

      {/* The flag. Indigo, not red. Plain language, no score, no clinical term. */}
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
                  <Chip
                    label={`Appointment requested with ${specialist?.name}`}
                    tone="notice"
                    glyph="✓"
                  />
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
        <Txt variant="smallStrong" tone="soft">
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
  switcher: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: { fontSize: 20 },
  negTop: { marginTop: -10 },
  grow: { flex: 1 },
  bloomWrap: { alignItems: 'center', paddingVertical: space.sm },
  statRow: { marginTop: space.lg, alignItems: 'flex-start' },
  stat: { flex: 1, gap: 2 },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: color.hairline,
    marginHorizontal: space.md,
  },
  divider: { marginVertical: space.lg },
  mtXs: { marginTop: space.xs },
  mtSm: { marginTop: space.sm },
  mtMd: { marginTop: space.md },
  link: { marginTop: space.md },
  actions: { marginTop: space.lg, gap: space.sm },
  portalLink: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairlineStrong,
    borderRadius: radius.md,
    padding: space.lg,
    gap: 2,
    backgroundColor: color.surface,
  },
});
