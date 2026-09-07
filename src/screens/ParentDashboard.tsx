import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Divider, Row } from '../ui/Bits';
import { Bloom } from '../ui/Bloom';
import { FloatingChatButton } from '../ui/FloatingChatButton';
import { MiniChatModal } from '../ui/MiniChatModal';
import { color, radius, space } from '../theme/tokens';
import { askChatbot } from '../lib/chatApi';
import type { ChatMessage, ChatOrigin } from '../store/types';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { DOMAIN_COUNT, DOMAINS, domainLabel } from '../domain/domains';
import { GAMES } from '../domain/games';
import { isParentVisible } from '../domain/flagEngine';
import {
  WEEKLY_DOMAIN_TARGET,
  planSession,
  weekCoverage,
  weeklyFocus,
  domainsTrackedThisWeek,
} from '../domain/rotation';
import { reportCard, pastPeriods, STATUS_LABEL, STATUS_TONE, type DomainReport } from '../domain/reportCard';
import { clusterByPin } from '../domain/coverage';
import { ageInMonths, relativeDay, startOfWeek } from '../lib/time';
import type { ChildProfile } from '../store/types';

/**
 * Screen 03 — Parent dashboard, report-card style.
 *
 * Milestone spec v0.2, §1: "Build it like a school report card, not a medical
 * chart. The goal is: a parent glances at it and feels informed and
 * reassured, not alarmed."
 *
 * Layout order follows the spec's own brief: profile strip, overview/bloom,
 * report card (the new centrepiece), flag section (only when a pediatrician
 * has actually confirmed one — see `isParentVisible`), then history. Nothing
 * on this screen ever compares one sibling against another.
 */
export function ParentDashboard() {
  const { state, child, profiles, sessions, flags, selectProfile, chatMessagesFor, sendChatMessage } = useApp();
  const nav = useNav();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const chatOrigin: ChatOrigin = { type: 'general' };

  // Load chat messages on mount
  React.useEffect(() => {
    if (child) {
      const msgs = chatMessagesFor(child.child_id, chatOrigin);
      setChatMessages(msgs);
    }
  }, [child, chatMessagesFor]);

  const handleSendChatMessage = async (text: string) => {
    if (!child) return;
    try {
      setChatLoading(true);
      sendChatMessage(child.child_id, chatOrigin, text);
      const result = await askChatbot({
        message: text,
        history: chatMessages,
      });
      sendChatMessage(child.child_id, chatOrigin, result.reply);
      const msgs = chatMessagesFor(child.child_id, chatOrigin);
      setChatMessages(msgs);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setChatLoading(false);
    }
  };

  const ageMonths = child ? ageInMonths(child.dob_iso) : 48;
  const weekStart = startOfWeek().getTime();

  const sessionsThisWeek = sessions.filter(
    s => s.ended_at >= weekStart && !s.abandoned,
  ).length;

  const coverage = useMemo(() => weekCoverage(sessions), [sessions]);
  const tracked = domainsTrackedThisWeek(coverage);
  const focus = weeklyFocus(coverage);
  const report = useMemo(() => reportCard(sessions), [sessions]);
  const periods = useMemo(() => pastPeriods(sessions), [sessions]);

  const plan = useMemo(
    () =>
      planSession({
        ageMonths,
        sessions,
        mvpOnly: state.settings.mvpOnly,
      }),
    [ageMonths, sessions, state.settings.mvpOnly],
  );

  // Only a pediatrician-confirmed flag is ever shown here — a candidate the
  // algorithm raised but nobody has reviewed yet does not exist as far as
  // this screen is concerned. See domain/flagEngine.ts `isParentVisible`.
  const visibleFlag = flags.find(f => isParentVisible(f));
  const specialist = state.account ? clusterByPin(state.account.pin)?.specialist : undefined;
  const lastSession = sessions[sessions.length - 1];
  const minutes = Math.max(2, Math.round(plan.estimated_ms / 60000));

  return (
    <View style={{ flex: 1 }}>
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
      {/*
        Netflix-style profile strip. Tapping another child's avatar switches
        the whole dashboard immediately — no navigating away — and every
        child's data (sessions, flags, report) is filtered by child_id, so
        nothing here can ever mix between siblings.
      */}
      <Row style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
          style={styles.strip}
        >
          {profiles.map(p => (
            <ProfileChip
              key={p.child_id}
              profile={p}
              active={p.child_id === child?.child_id}
              onPress={() => selectProfile(p.child_id)}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage profiles"
            onPress={() => nav.push('profileGate')}
            style={styles.manageChip}
          >
            <Txt variant="micro" tone="faint">
              manage
            </Txt>
          </Pressable>
        </ScrollView>

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

      {/* Overview strip: the bloom, plus light game-like stats. */}
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

      {/* The report card — the main new piece. */}
      {report.length > 0 ? (
        <Card label="Report card">
          <Txt variant="micro" tone="faint" style={styles.negTop}>
            This period · updates as {child?.name ?? 'they'} play
          </Txt>
          <View style={styles.reportList}>
            {report.map(r => (
              <ReportRow key={r.domain} report={r} />
            ))}
          </View>
        </Card>
      ) : null}

      {/* The flag. Indigo, not red. Plain language, no score, no clinical term,
          and only ever a conclusion — never the measurement behind it. */}
      {visibleFlag ? (
        <Card tone="notice">
          <Row gap={space.sm} align="flex-start">
            <Txt variant="heading" tone="notice">
              ⚑
            </Txt>
            <View style={styles.grow}>
              <Txt variant="label" tone="notice">
                {visibleFlag.parent_headline}
              </Txt>
              <Txt variant="body" tone="notice" style={styles.mtSm}>
                {visibleFlag.parent_body}
              </Txt>
              <Txt variant="small" tone="notice" style={styles.mtSm}>
                This is not a diagnosis — just something worth having a specialist look at.
              </Txt>

              {visibleFlag.status === 'booked' ? (
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
                    onPress={() => nav.push('flagDetail', { flagId: visibleFlag.id })}
                  />
                  <Button
                    label="Read more"
                    variant="secondary"
                    onPress={() => nav.push('flagDetail', { flagId: visibleFlag.id })}
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
            sessions and more than one kind of game — and only after the matched specialist
            has had a look. Most weeks, it stays quiet.
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

      {/* History / past reports, plus a way to take a report to a visit. */}
      <Card label="Past reports">
        {periods.length === 0 ? (
          <Txt variant="small" tone="soft">
            Reports build up as your child plays — check back after a few sessions.
          </Txt>
        ) : (
          <View style={styles.periods}>
            {periods.map(p => (
              <Pressable
                key={p.index}
                onPress={() => nav.push('reportHistory', { periodIndex: p.index })}
                style={styles.periodRow}
              >
                <Txt variant="small">{p.label}</Txt>
                <Txt variant="small" tone="brand">
                  View ›
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.mtMd}>
          <Button
            label="Share or save a report"
            variant="secondary"
            onPress={() => nav.push('reportHistory', { periodIndex: 0 })}
          />
        </View>
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

      <Pressable onPress={() => child && nav.push('chat', { childId: child.child_id })} style={styles.portalLink}>
        <Txt variant="smallStrong" tone="soft">
          💬 Ask Khil
        </Txt>
        <Txt variant="micro" tone="faint">
          Research-grounded Q&A about screening, development, and play. ›
        </Txt>
      </Pressable>

      <Pressable onPress={() => nav.push('privacy')} style={styles.portalLink}>
        <Txt variant="smallStrong" tone="soft">
          Privacy & data
        </Txt>
        <Txt variant="micro" tone="faint">
          See exactly what Khil has stored, or delete it. ›
        </Txt>
      </Pressable>
      </Screen>

      <FloatingChatButton
        onPress={() => setChatOpen(true)}
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
      >
        <MiniChatModal
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
          onClose={() => setChatOpen(false)}
        />
      </FloatingChatButton>
    </View>
  );
}

function ProfileChip({
  profile,
  active,
  onPress,
}: {
  profile: ChildProfile;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Switch to ${profile.name}`}
      onPress={onPress}
      style={styles.profileChip}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: profile.avatar.color },
          active && styles.avatarActive,
        ]}
      >
        <Txt style={styles.avatarGlyph}>{profile.avatar.glyph}</Txt>
      </View>
      <Txt variant="micro" tone={active ? 'ink' : 'faint'} numberOfLines={1} style={styles.profileName}>
        {profile.name}
      </Txt>
    </Pressable>
  );
}

/** One report-card row: a non-numeric status, a one-line note, a trend of practice. */
function ReportRow({ report }: { report: DomainReport }) {
  const maxRounds = Math.max(1, ...report.trend.map(t => t.rounds));
  return (
    <View style={styles.reportRow}>
      <Row style={styles.reportHead}>
        <Txt variant="bodyStrong" style={styles.grow}>
          {DOMAINS[report.domain].label}
        </Txt>
        <Chip label={STATUS_LABEL[report.status]} tone={STATUS_TONE[report.status]} />
      </Row>
      <Txt variant="small" tone="soft" style={styles.mtXs}>
        {report.note}
      </Txt>
      {/* Trend: how much this was practiced each week. Not a score, not a
          speed — a bar chart cannot read as clinical when the only thing it
          plots is play count. */}
      <Row gap={4} style={styles.trend}>
        {report.trend.map((point, i) => (
          <View
            key={point.weekStart}
            style={[
              styles.trendBar,
              {
                height: 6 + 22 * (point.rounds / maxRounds),
                backgroundColor: i === report.trend.length - 1 ? color.brand : color.brandSoft,
              },
            ]}
          />
        ))}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { justifyContent: 'space-between', alignItems: 'center' },
  strip: { flexGrow: 0 },
  stripContent: { alignItems: 'center', gap: space.md, paddingRight: space.sm },
  profileChip: { alignItems: 'center', gap: 2, width: 56 },
  manageChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.xs,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarActive: { borderColor: color.ink },
  avatarGlyph: { fontSize: 22 },
  profileName: { maxWidth: 56 },
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
  reportList: { marginTop: space.md, gap: space.lg },
  reportRow: { gap: 2 },
  reportHead: { alignItems: 'center' },
  trend: { marginTop: space.sm, alignItems: 'flex-end', height: 28 },
  trendBar: { width: 10, borderRadius: 3 },
  periods: { gap: space.sm },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  portalLink: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairlineStrong,
    borderRadius: radius.md,
    padding: space.lg,
    gap: 2,
    backgroundColor: color.surface,
  },
});
