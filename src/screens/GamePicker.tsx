import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Row } from '../ui/Bits';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { DOMAINS } from '../domain/domains';
import { GAME_LIST, type GameId } from '../domain/games';
import { AGE_BANDS, bandForAge } from '../domain/norms';
import { planSession, weekCoverage } from '../domain/rotation';
import { ageInMonths } from '../lib/time';

/**
 * Choose today's games.
 *
 * The rotation planner still exists and still leads — it is better than a
 * parent at spotting which skill areas have gone untouched this week. But
 * being told what to play and never being allowed to choose is its own kind of
 * bad product, especially when a child asks for the drums by name. So the
 * rotation's pick is offered first, and everything else is one tap away.
 *
 * The age-group control sits here rather than on the profile, because it is a
 * choice about today's play rather than a fact about the child.
 */
export function GamePicker() {
  const { child, sessions, state, updateProfile } = useApp();
  const nav = useNav();

  const realAgeMonths = child ? ageInMonths(child.dob_iso) : 48;
  const override = child?.band_override ?? null;
  const activeBand = override
    ? (AGE_BANDS.find(b => b.id === override) ?? bandForAge(realAgeMonths))
    : bandForAge(realAgeMonths);
  /** Age used to decide which games are offered. */
  const playAgeMonths = override ? activeBand.minMonths + 6 : realAgeMonths;

  const coverage = useMemo(() => weekCoverage(sessions), [sessions]);
  const recommended = useMemo(
    () =>
      planSession({
        ageMonths: playAgeMonths,
        sessions,
        mvpOnly: state.settings.mvpOnly,
      }),
    [playAgeMonths, sessions, state.settings.mvpOnly],
  );

  const [selected, setSelected] = useState<GameId[]>([]);

  const toggle = (id: GameId) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(g => g !== id)
        : // Two games is the session cap (spec §3), so the oldest choice drops.
          [...prev, id].slice(-2),
    );
  };

  const start = (ids?: GameId[]) => {
    nav.push('sessionIntro', ids && ids.length > 0 ? { gameIds: ids } : undefined);
  };

  return (
    <Screen
      backLabel="progress"
      eyebrow={child ? child.name : undefined}
      title="Choose today’s play"
      footer={
        selected.length > 0 ? (
          <>
            <Button
              label={`Start ${selected.length} game${selected.length === 1 ? '' : 's'}`}
              glyph="▶"
              onPress={() => start(selected)}
            />
            <Pressable onPress={() => setSelected([])} hitSlop={8}>
              <Txt variant="small" tone="faint" center>
                Clear selection
              </Txt>
            </Pressable>
          </>
        ) : (
          <Button
            label="Use today’s suggestion"
            glyph="▶"
            onPress={() => start()}
          />
        )
      }
    >
      {/* The planner's pick, offered rather than imposed. */}
      <Card tone="brand" label="Suggested for today">
        <Txt variant="heading">
          {recommended.games.map(g => GAME_LIST.find(x => x.id === g.game_id)?.title).join('  ·  ')}
        </Txt>
        <Txt variant="small" tone="soft" style={styles.mtXs}>
          {recommended.rationale}
        </Txt>
      </Card>

      {/* Age group. Off-band play is allowed, and its consequence is stated. */}
      <Card label="Age group">
        <Txt variant="small" tone="soft">
          {child?.name ?? 'This child'} is {Math.floor(realAgeMonths / 12)}, so Khil normally
          offers the {bandForAge(realAgeMonths).label} games.
        </Txt>
        <Row gap={space.sm} wrap style={styles.mtMd}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: override === null }}
            onPress={() => child && updateProfile(child.child_id, { band_override: null })}
          >
            <View style={[styles.band, override === null && styles.bandOn]}>
              <Txt variant="smallStrong" tone={override === null ? 'inverse' : 'soft'}>
                Their age
              </Txt>
            </View>
          </Pressable>
          {AGE_BANDS.map(band => {
            const on = override === band.id;
            return (
              <Pressable
                key={band.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() =>
                  child && updateProfile(child.child_id, { band_override: on ? null : band.id })
                }
              >
                <View style={[styles.band, on && styles.bandOn]}>
                  <Txt variant="smallStrong" tone={on ? 'inverse' : 'soft'}>
                    {band.label}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </Row>
        {override ? (
          <View style={styles.warn}>
            <Txt variant="micro" tone="notice">
              Playing the {activeBand.label} games. These sessions are saved and shown in
              progress, but they are left out of the comparison against{' '}
              {child?.name ?? 'this child'}’s own age range — measuring them against a
              different age group’s timings would not mean anything.
            </Txt>
          </View>
        ) : null}
      </Card>

      <View>
        <Txt variant="label" tone="faint">
          All games
        </Txt>
        <Txt variant="micro" tone="faint" style={styles.mtXs}>
          Pick up to two. Tap again to unpick.
        </Txt>
      </View>

      {GAME_LIST.map(game => {
        const inBand =
          playAgeMonths >= game.minAgeMonths && playAgeMonths <= game.maxAgeMonths;
        const isSelected = selected.includes(game.id);
        const isSuggested = recommended.games.some(g => g.game_id === game.id);
        const playsThisWeek = Math.min(
          ...game.domains.map(d => coverage[d] ?? 0),
        );

        return (
          <Pressable
            key={game.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: !inBand }}
            accessibilityLabel={`${game.title}. ${game.tagline}.${inBand ? '' : ' Not offered at this age group.'}`}
            disabled={!inBand}
            onPress={() => toggle(game.id)}
          >
            <Card
              style={
                [
                  styles.gameCard,
                  isSelected && { borderColor: game.accent, borderWidth: 2 },
                  !inBand && styles.gameCardOff,
                ] as never
              }
            >
              <Row gap={space.md} align="flex-start">
                <View style={[styles.badge, { backgroundColor: `${game.accent}22` }]}>
                  <Txt style={styles.badgeGlyph}>{game.emoji}</Txt>
                </View>

                <View style={styles.grow}>
                  <Row style={styles.titleRow}>
                    <Txt variant="bodyStrong" numberOfLines={1} style={styles.grow}>
                      {game.title}
                    </Txt>
                    {isSelected ? (
                      <View style={[styles.tick, { backgroundColor: game.accent }]}>
                        <Txt variant="micro" tone="inverse">
                          ✓
                        </Txt>
                      </View>
                    ) : null}
                  </Row>

                  <Txt variant="small" tone="soft" style={styles.mtXs}>
                    {game.tagline}
                  </Txt>

                  <Row gap={space.sm} wrap style={styles.mtMd}>
                    {game.domains.map(d => (
                      <Chip key={d} label={DOMAINS[d].label} glyph={DOMAINS[d].emoji} />
                    ))}
                  </Row>

                  <Row gap={space.md} style={styles.mtMd}>
                    <Txt variant="micro" tone="faint">
                      ages {Math.floor(game.minAgeMonths / 12)}–{Math.floor(game.maxAgeMonths / 12)}
                    </Txt>
                    <Txt variant="micro" tone="faint">
                      {game.rounds} rounds
                    </Txt>
                    {isSuggested ? (
                      <Txt variant="micro" tone="brand">
                        suggested today
                      </Txt>
                    ) : playsThisWeek === 0 ? (
                      <Txt variant="micro" tone="notice">
                        not played this week
                      </Txt>
                    ) : null}
                  </Row>

                  {!inBand ? (
                    <Txt variant="micro" tone="faint" style={styles.mtMd}>
                      Not offered at the {activeBand.label} setting.
                    </Txt>
                  ) : null}
                </View>
              </Row>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  mtXs: { marginTop: space.xs },
  mtMd: { marginTop: space.md },
  band: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    backgroundColor: color.surface,
  },
  bandOn: { backgroundColor: color.brandDeep, borderColor: color.brandDeep },
  warn: {
    marginTop: space.lg,
    backgroundColor: color.noticeSurface,
    borderColor: color.noticeEdge,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  gameCard: { borderColor: color.hairline },
  gameCardOff: { opacity: 0.45 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 24 },
  titleRow: { alignItems: 'center', gap: space.sm },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
