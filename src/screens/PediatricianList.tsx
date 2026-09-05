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
        // A candidate the algorithm raised but nobody has looked at yet.
        // This is the row the whole portal exists to surface — spec §2:
        // "flags always sorted to the top."
        const needsReview = childFlags.find(f => f.status === 'pending_review');
        // Already reviewed and shared with the parent — still tracked, but
        // no longer the urgent case.
        const shared = childFlags.find(
          f => f.status === 'open' || f.status === 'booked' || f.status === 'snoozed',
        );
        const closedFlags = childFlags.filter(f => f.status.startsWith('closed'));
        const active = needsReview ?? shared;
        return {
          id: profile.child_id,
          name: profile.name,
          age: ageInYears(profile.dob_iso),
          needsReview: !!needsReview,
          note: needsReview
            ? 'new pattern · needs your review'
            : shared
              ? shared.status === 'booked'
                ? 'shared with parent · consultation requested'
                : shared.status === 'snoozed'
                  ? 'shared with parent · reminder set'
                  : 'shared with parent · awaiting booking'
              : closedFlags.length > 0
                ? 'reviewed · no open flags'
                : 'no flags this month',
          flagId: active?.id,
          closedFlags,
        };
      }),
      // Needs-review rows first, exactly as the spec asks.
    [profiles, flagsFor],
  );

  const sortedHouseholdRows = useMemo(
    () => [...householdRows].sort((a, b) => Number(b.needsReview) - Number(a.needsReview)),
    [householdRows],
  );

  const reviewCount = householdRows.filter(r => r.needsReview).length;
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
        needsReview: false,
        note: p.note,
        flagId: undefined as string | undefined,
      }));
    return [...sortedHouseholdRows, ...others];
  }, [sortedHouseholdRows, householdRows, state.clusterPatients]);

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
            label={reviewCount > 0 ? `${reviewCount} to review` : 'no new flags'}
            tone={reviewCount > 0 ? 'notice' : 'positive'}
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
                  {row.needsReview ? <Chip label="flag" tone="notice" glyph="⚑" /> : null}
                </Row>
                <Txt variant="small" tone="soft" style={styles.mtXs}>
                  {row.note}
                </Txt>
              </View>

              {row.flagId ? (
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
          {mappedCount} families mapped · {reviewCount} flag{reviewCount === 1 ? '' : 's'} to review
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
                label={OUTCOME_LABEL[flag.outcome?.outcome ?? 'not_concerning']}
                tone={flag.outcome?.outcome === 'not_concerning' ? 'positive' : 'notice'}
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

const OUTCOME_LABEL: Record<string, string> = {
  not_concerning: 'not concerning',
  needs_visit: 'needs visit',
  diagnosis_pending: 'diagnosis pending',
};

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
