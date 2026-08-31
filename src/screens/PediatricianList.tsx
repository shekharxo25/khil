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
  const { state } = useApp();
  const nav = useNav();

  const pin = state.child?.pin ?? '380015';
  const cluster = clusterByPin(pin);
  const specialist = cluster?.specialist;

  const openFlag = state.flags.find(
    f => f.status === 'open' || f.status === 'booked' || f.status === 'snoozed',
  );
  const closedFlags = state.flags.filter(f => f.status.startsWith('closed'));

  const mappedCount = (specialist?.familiesMapped ?? 0) + (state.child ? 1 : 0);

  const rows = useMemo(() => {
    const own = state.child
      ? [
          {
            id: state.child.child_id,
            name: state.child.name,
            age: ageInYears(state.child.dob_iso),
            flagged: !!openFlag,
            note: openFlag
              ? openFlag.status === 'booked'
                ? 'new flag · consultation requested'
                : 'new flag · replay attached'
              : closedFlags.length > 0
                ? 'reviewed · no open flags'
                : 'no flags this month',
            flagId: openFlag?.id,
          },
        ]
      : [];
    const others = state.clusterPatients.map(p => ({
      id: p.id,
      name: p.name,
      age: p.age_years,
      flagged: false,
      note: p.note,
      flagId: undefined as string | undefined,
    }));
    return [...own, ...others];
  }, [state.child, state.clusterPatients, openFlag, closedFlags.length]);

  return (
    <Screen
      background={color.clinicSurface}
      backLabel="parent view"
      eyebrow="Specialist portal"
      title={`Mapped patients — PIN ${pin}`}
    >
      <Card tone="clinic">
        <Row style={styles.between}>
          <View>
            <Txt variant="bodyStrong" tone="clinic">
              {specialist?.name ?? 'Unassigned'}
            </Txt>
            <Txt variant="small" tone="soft">
              {specialist?.clinic} · {cluster?.area}
            </Txt>
          </View>
          <Chip
            label={openFlag ? '1 open flag' : 'no open flags'}
            tone={openFlag ? 'notice' : 'positive'}
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
          {mappedCount} families mapped · {openFlag ? 1 : 0} open flag
        </Txt>
        <Txt variant="small" tone="soft" style={styles.mtXs}>
          Capacity indicator. A cluster far above or below the others is a signal for Khil’s
          operations team, not a clinical one.
        </Txt>
      </Card>

      {closedFlags.length > 0 ? (
        <Card label="Recently reviewed">
          {closedFlags.map(flag => (
            <Row key={flag.id} style={styles.between}>
              <Txt variant="small" tone="soft">
                {state.child?.name} · {relativeDay(flag.outcome?.marked_at ?? flag.created_at)}
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
