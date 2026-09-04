import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Row } from '../ui/Bits';
import { color, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav, useParams } from '../nav/navigation';
import { GAMES, isGameInBand, type GameId } from '../domain/games';
import { DOMAINS } from '../domain/domains';
import { planSession, sessionNumberInBlock, type PlannedGame } from '../domain/rotation';
import { AGE_BANDS, bandForAge } from '../domain/norms';
import { ageInMonths } from '../lib/time';

/**
 * The hand-off screen.
 *
 * Wireframe 02, note 3: the session-length cap is "shown as reassurance to
 * parent, not a pressure indicator to the child". So the duration, the domains
 * and the "what gets recorded" reminder all live here — on the adult's side of
 * the hand-off — and none of it appears once the child is holding the phone.
 *
 * Two paths lead here: the rotation's own pick (no params), or a hand-picked
 * set of games from the game picker (`gameIds`). Either way this screen shows
 * exactly what is about to run before the phone changes hands.
 */
export function SessionIntro() {
  const { state, child, sessions } = useApp();
  const nav = useNav();
  const params = useParams<'sessionIntro'>();
  const ageMonths = child ? ageInMonths(child.dob_iso) : 48;
  const override = child?.band_override ?? null;
  const activeBand = override
    ? (AGE_BANDS.find(b => b.id === override) ?? bandForAge(ageMonths))
    : bandForAge(ageMonths);
  const playAgeMonths = override ? activeBand.minMonths + 6 : ageMonths;

  const recommended = useMemo(
    () =>
      planSession({
        ageMonths: playAgeMonths,
        sessions,
        mvpOnly: state.settings.mvpOnly,
      }),
    [playAgeMonths, sessions, state.settings.mvpOnly],
  );

  // A hand-picked set from the game picker overrides the rotation's choice,
  // but still respects the age band and the two-game session cap.
  const chosenIds = params?.gameIds?.filter(id => isGameInBand(id, playAgeMonths)).slice(0, 2);
  const plan =
    chosenIds && chosenIds.length > 0
      ? {
          ...recommended,
          games: chosenIds.map(
            (id): PlannedGame => ({
              game_id: id,
              rounds:
                recommended.games.find(g => g.game_id === id)?.rounds ?? GAMES[id].rounds,
            }),
          ),
          domains: Array.from(new Set(chosenIds.flatMap(id => GAMES[id].domains))),
          rationale: 'Picked by you for today’s session.',
        }
      : recommended;

  const minutes = Math.max(2, Math.round(plan.estimated_ms / 60000));
  const sessionNumber = sessionNumberInBlock(sessions.filter(s => !s.abandoned).length);

  return (
    <Screen
      backLabel="progress"
      eyebrow={`Session ${sessionNumber} of 10`}
      title="Ready to play"
      footer={
        <>
          <Button
            label={`Hand the phone to ${child?.name ?? 'your child'}`}
            glyph="▶"
            onPress={() =>
              nav.replace(
                'session',
                chosenIds && chosenIds.length > 0 ? { gameIds: chosenIds } : undefined,
              )
            }
          />
          <Txt variant="micro" tone="faint" center>
            You can end the session any time by holding the ✕ in the corner.
          </Txt>
        </>
      }
    >
      <Card>
        <Txt variant="label" tone="faint">
          Today’s games
        </Txt>
        <View style={styles.games}>
          {plan.games.map(planned => {
            const meta = GAMES[planned.game_id];
            return (
              <Row key={planned.game_id} gap={space.md} align="flex-start">
                <View style={[styles.badge, { backgroundColor: `${meta.accent}22` }]}>
                  <Txt style={styles.badgeGlyph}>{meta.emoji}</Txt>
                </View>
                <View style={styles.grow}>
                  <Txt variant="bodyStrong">{meta.title}</Txt>
                  <Txt variant="small" tone="soft">
                    {meta.mechanic}
                  </Txt>
                  <Txt variant="micro" tone="faint" style={styles.mtXs}>
                    {planned.rounds} rounds
                  </Txt>
                </View>
              </Row>
            );
          })}
        </View>
      </Card>

      <Card tone="brand">
        <Row gap={space.md} align="center">
          <Txt variant="title" tone="brand">
            {minutes}
          </Txt>
          <View style={styles.grow}>
            <Txt variant="bodyStrong" tone="brand">
              About {minutes} minutes
            </Txt>
            <Txt variant="small" tone="soft">
              Short on purpose. Sessions are capped to match a young child’s attention
              span — stopping early is completely fine.
            </Txt>
          </View>
        </Row>
      </Card>

      <Card label="Skill areas this session">
        <Row gap={space.sm} wrap>
          {plan.domains.map(d => (
            <Chip key={d} label={DOMAINS[d].label} glyph={DOMAINS[d].emoji} tone="neutral" />
          ))}
        </Row>
        <Txt variant="small" tone="soft" style={styles.mtMd}>
          {plan.rationale}
        </Txt>
      </Card>

      <Card tone="sunk">
        <Txt variant="label" tone="faint">
          While they play
        </Txt>
        <Txt variant="small" tone="soft" style={styles.mtXs}>
          Khil times responses and records which tiles are tapped. Nothing is filmed or
          recorded by microphone. Your child sees only the game.
        </Txt>
      </Card>

      {override ? (
        <Card tone="notice">
          <Txt variant="small" tone="notice">
            Playing the {activeBand.label} setting today. This session is saved and shown in
            progress, but left out of the comparison against {child?.name ?? 'this child'}’s
            own age range.
          </Txt>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  games: { gap: space.lg, marginTop: space.sm },
  grow: { flex: 1 },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 20 },
  mtXs: { marginTop: space.xs },
  mtMd: { marginTop: space.md },
  hairline: { backgroundColor: color.hairline },
});
