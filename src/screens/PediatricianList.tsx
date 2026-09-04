import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Divider, Row } from '../ui/Bits';
import { color, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { clusterByPin } from '../domain/coverage';
import { ageInYears, relativeDay } from '../lib/time';

/**
 * Screen 05 — Pediatrician portal, patient list.
 *
 * Wireframe notes:
 *  1. Scope is strictly this clinician's own PIN-code cluster.
 *  2. Only patients with an active flag get a "review" action — that is the
 *     portal's entire job; everything else stays secondary.
 *  3. A simple capacity indicator, so an over- or under-loaded cluster is visible.
 */
export function PediatricianList() {
  const { state, profiles, flagsFor } = useApp();
  const nav = useNav();

  const pin = state.account?.pin ?? '380015';
  const cluster = clusterByPin(pin);
  const specialist = cluster?.specialist;

  // The whole household shares one specialist, so the portal shows every
  // child on the account — not just whoever is currently the active profile.
  const householdRows = useMemo(
    () =>
      profiles.map(profile => {
        const childFlags = flagsFor(profile.child_id);
        const openFlag = childFlags.find(
          f => f.status === 'open' || f.status === 'booked' || f.status === 'snoozed',
        );
        const closedFlags = childFlags.filter(f => f.status.startsWith('closed'));
        return {
          id: profile.child_id,
          name: profile.name,
          age: ageInYears(profile.dob_iso),
          flagged: !!openFlag,
          note: openFlag
            ? openFlag.status === 'booked'
              ? 'new flag · consultation requested'
              : 'new flag · replay attached'
            : closedFlags.length > 0
              ? 'reviewed · no open flags'
              : 'no flags this month',
          flagId: openFlag?.id,
          closedFlags,
        };
      }),
    [profiles, flagsFor],
  );

  const openFlagCount = householdRows.filter(r => r.flagged).length;
  const allClosedFlags = householdRows.flatMap(r =>
    r.closedFlags.map(flag => ({ flag, childName: r.name })),
  );
  const mappedCount = (specialist?.familiesMapped ?? 0) + profiles.length;

  const rows = useMemo(() => {
    // The fictional roster is a static, name-based demo fixture, and a real
    // parent is free to pick any name for their child — including one that
    // happens to match a fictional patient. Filtering the collision out here,
    // rather than trying to pick "safe" fictional names, is the fix that
    // still holds no matter what a parent names their child.
    const householdNames = new Set(householdRows.map(r => r.name.trim().toLowerCase()));
    const others = state.clusterPatients
      .filter(p => !householdNames.has(p.name.trim().toLowerCase()))
      .map(p => ({
        id: p.id,
        name: p.name,
        age: p.age_years,
        flagged: false,
        note: p.note,
        flagId: undefined as string | undefined,
      }));
    return [...householdRows, ...others];
  }, [householdRows, state.clusterPatients]);

  return (
    <Screen
      background={color.paper}
      backLabel="parent view"
      eyebrow="Specialist portal"
      title={`Mapped patients — PIN ${pin}`}
    >
      <Card tone="clinic">
        <Row style={styles.between}>
          <View>
            <Txt variant="bodyStrong" tone="ink">
              {specialist?.name ?? 'Unassigned'}
            </Txt>
            <Txt variant="small" tone="soft">
              {specialist?.clinic} · {cluster?.area}
            </Txt>
          </View>
          <Chip
            label={openFlagCount > 0 ? `${openFlagCount} open flag${openFlagCount === 1 ? '' : 's'}` : 'no open flags'}
            tone={openFlagCount > 0 ? 'notice' : 'positive'}
          />
        </Row>
        <Divider style={styles.divider} />
        <Txt variant="micro" tone="faint">
          Visibility is limited to families mapped to this PIN cluster. Khil never exposes
          families outside it.
        </Txt>
      </Card>

      <Card padded={false}>
        {rows.map((row, index) => (
          <View key={row.id}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.row}>
              <View style={styles.grow}>
                <Row gap={space.sm}>
                  <Txt variant="bodyStrong">
                    {row.name}, age {row.age}
                  </Txt>
                  {row.flagged ? <Chip label="flag" tone="notice" glyph="⚑" /> : null}
                </Row>
                <Txt variant="small" tone="soft" style={styles.mtXs}>
                  {row.note}
                </Txt>
              </View>

              {row.flagged && row.flagId ? (
                <Button
                  label="Review"
                  small
                  full={false}
                  variant="clinic"
                  onPress={() => nav.push('clinicReview', { flagId: row.flagId as string })}
                />
              ) : (
                <Txt variant="micro" tone="faint">
                  —
                </Txt>
              )}
            </View>
          </View>
        ))}
      </Card>

      <Card tone="sunk" label="Notes">
        <Txt variant="bodyStrong">
          {mappedCount} families mapped · {openFlagCount} open flag{openFlagCount === 1 ? '' : 's'}
        </Txt>
        <Txt variant="small" tone="soft" style={styles.mtXs}>
          Capacity indicator. A cluster far above or below the others is a signal for Khil’s
          operations team, not a clinical one.
        </Txt>
      </Card>

      {allClosedFlags.length > 0 ? (
        <Card label="Recently reviewed">
          {allClosedFlags.map(({ flag, childName }) => (
            <Row key={flag.id} style={styles.between}>
              <Txt variant="small" tone="soft">
                {childName} · {relativeDay(flag.outcome?.marked_at ?? flag.created_at)}
              </Txt>
              <Chip
                label={flag.outcome?.outcome === 'needs_visit' ? 'needs visit' : 'not concerning'}
                tone={flag.outcome?.outcome === 'needs_visit' ? 'notice' : 'positive'}
              />
            </Row>
          ))}
          <Txt variant="micro" tone="faint" style={styles.mtMd}>
            Outcome tags feed the flag-usefulness measure — this is how the false-positive
            rate gets tracked over time.
          </Txt>
        </Card>
      ) : null}

      <Pressable onPress={() => nav.back()} style={styles.exit}>
        <Txt variant="small" tone="brand">
          ‹ Back to the parent view
        </Txt>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  divider: { marginVertical: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  grow: { flex: 1 },
  mtXs: { marginTop: space.xs },
  mtMd: { marginTop: space.md },
  exit: { alignSelf: 'center', paddingVertical: space.md },
});
