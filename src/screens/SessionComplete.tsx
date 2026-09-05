import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BloomMark, Chip, Row } from '../ui/Bits';
import { space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav, useParams } from '../nav/navigation';
import { GAMES } from '../domain/games';
import { DOMAINS } from '../domain/domains';
import { isParentVisible } from '../domain/flagEngine';
import { playSound } from '../lib/sounds';
import { median } from '../domain/telemetry';

/**
 * Post-session, parent-facing.
 *
 * A flag that just fired is `pending_review` — see domain/flagEngine.ts — and
 * a pediatrician has not looked at it yet. This screen must not hint that one
 * exists until `isParentVisible` says so, even though `completeSession` did
 * just hand back its id: the id is used only to poll for it later, from
 * `parentHome`, once it has actually been reviewed.
 */
export function SessionComplete() {
  const { child, sessions, flags } = useApp();
  const nav = useNav();
  const params = useParams<'sessionComplete'>();

  const session = sessions[sessions.length - 1];
  const candidateFlag = params?.flagId ? flags.find(f => f.id === params.flagId) : undefined;
  const flag = candidateFlag && isParentVisible(candidateFlag) ? candidateFlag : undefined;

  useEffect(() => {
    playSound('celebrate');
  }, []);

  const summary = useMemo(() => {
    if (!session) return null;
    const rounds = session.rounds;
    const correct = rounds.filter(r => r.response_correct).length;
    const latency = median(
      rounds.map(r => r.response_latency_ms).filter((v): v is number => v !== null),
    );
    return {
      rounds: rounds.length,
      correct,
      latency: latency === null ? null : Math.round(latency),
      domains: Array.from(new Set(session.game_ids.flatMap(g => GAMES[g].domains))),
    };
  }, [session]);

  return (
    <Screen
      footer={
        <>
          {flag ? (
            <Button
              label="Read what we noticed"
              variant="notice"
              onPress={() => nav.replace('flagDetail', { flagId: flag.id })}
            />
          ) : null}
          <Button
            label="Back to progress"
            variant={flag ? 'secondary' : 'primary'}
            onPress={() => nav.reset('parentHome')}
          />
        </>
      }
    >
      <View style={styles.hero}>
        <BloomMark size={54} />
        <Txt variant="display" center>
          Nice playing
        </Txt>
        <Txt variant="body" tone="soft" center>
          {child?.name ?? 'Your child'} finished today’s session.
        </Txt>
      </View>

      {summary ? (
        <Card label="What just happened">
          <Row>
            <View style={styles.grow}>
              <Txt variant="title">{summary.rounds}</Txt>
              <Txt variant="small" tone="soft">
                rounds played
              </Txt>
            </View>
            <View style={styles.grow}>
              <Txt variant="title">{summary.correct}</Txt>
              <Txt variant="small" tone="soft">
                found first try
              </Txt>
            </View>
            <View style={styles.grow}>
              <Txt variant="title">{summary.latency ? `${(summary.latency / 1000).toFixed(1)}s` : '—'}</Txt>
              <Txt variant="small" tone="soft">
                typical response
              </Txt>
            </View>
          </Row>

          <Row gap={space.sm} wrap style={styles.mt}>
            {summary.domains.map(d => (
              <Chip key={d} label={DOMAINS[d].label} glyph={DOMAINS[d].emoji} tone="brand" />
            ))}
          </Row>
        </Card>
      ) : null}

      {flag ? (
        <Card tone="notice">
          <Txt variant="label" tone="notice">
            {flag.parent_headline}
          </Txt>
          <Txt variant="body" tone="notice" style={styles.mt}>
            {flag.parent_body}
          </Txt>
          <Txt variant="small" tone="notice" style={styles.mt}>
            This came from a pattern across several sessions — not from today alone.
          </Txt>
        </Card>
      ) : (
        <Card tone="sunk">
          <Txt variant="small" tone="soft">
            Nothing stood out today. Khil stays quiet unless the same unusual pattern turns
            up across more than one session and more than one kind of game.
          </Txt>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  grow: { flex: 1 },
  mt: { marginTop: space.md },
});
