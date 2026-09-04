import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Chip, Row } from '../ui/Bits';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { PLANS, planFor, type PlanId } from '../store/types';

const ORDER: PlanId[] = ['basic', 'family', 'familyPlus'];

/**
 * Plans, which here means one thing: how many children the account covers.
 *
 * No plan gates a game, a skill area, or anything the screening actually does.
 * Putting the flag engine behind a paywall would mean choosing not to tell a
 * parent something Khil already noticed, and there is no version of that this
 * product can defend.
 */
export function Plans() {
  const { state, profiles, setPlan } = useApp();
  const nav = useNav();
  const current = planFor(state.account);

  return (
    <Screen backLabel="back" eyebrow="Account" title="Plans">
      <Txt variant="small" tone="soft" style={styles.negTop}>
        Every plan includes all eight games, every skill area, and the same
        specialist match. The only difference is how many children the account covers.
      </Txt>

      {ORDER.map(id => {
        const plan = PLANS[id];
        const isCurrent = plan.id === current.id;
        const tooSmall = profiles.length > plan.profileLimit;
        return (
          <Pressable
            key={plan.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent, disabled: tooSmall }}
            accessibilityLabel={`${plan.name}, ${plan.profileLimit} children, ${plan.price}`}
            disabled={tooSmall || isCurrent}
            onPress={() => setPlan(plan.id)}
          >
            <Card
              tone={isCurrent ? 'brand' : 'plain'}
              style={[styles.card, tooSmall && styles.cardDim] as never}
            >
              <Row style={styles.head}>
                <View style={styles.grow}>
                  <Txt variant="heading">{plan.name}</Txt>
                  <Txt variant="small" tone="soft" style={styles.mtXs}>
                    {plan.blurb}
                  </Txt>
                </View>
                <View style={styles.price}>
                  <Txt variant="title">{plan.price}</Txt>
                  {plan.cadence ? (
                    <Txt variant="micro" tone="faint">
                      {plan.cadence}
                    </Txt>
                  ) : null}
                </View>
              </Row>

              <View style={styles.perks}>
                {plan.perks.map(perk => (
                  <Row key={perk} gap={space.sm} align="flex-start">
                    <Txt variant="small" tone="brand">
                      ✓
                    </Txt>
                    <Txt variant="small" tone="soft" style={styles.grow}>
                      {perk}
                    </Txt>
                  </Row>
                ))}
              </View>

              <View style={styles.foot}>
                {isCurrent ? (
                  <Chip label="Current plan" tone="brand" glyph="✓" />
                ) : tooSmall ? (
                  <Chip
                    label={`You have ${profiles.length} children — remove one first`}
                    tone="notice"
                  />
                ) : (
                  <Txt variant="smallStrong" tone="brand">
                    Switch to {plan.name} ›
                  </Txt>
                )}
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Card tone="sunk" label="On this device">
        <Txt variant="small" tone="soft">
          This is a prototype: switching plans takes effect immediately and nothing is
          charged. In a real build this would be the point at which billing is set up.
        </Txt>
      </Card>

      <Pressable onPress={() => nav.back()} style={styles.exit}>
        <Txt variant="small" tone="brand" center>
          ‹ Back
        </Txt>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  negTop: { marginTop: -6 },
  card: { borderRadius: radius.lg },
  cardDim: { opacity: 0.55 },
  head: { alignItems: 'flex-start', gap: space.md },
  grow: { flex: 1 },
  price: { alignItems: 'flex-end' },
  perks: { marginTop: space.lg, gap: space.sm },
  foot: {
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
  mtXs: { marginTop: space.xs },
  exit: { paddingVertical: space.md },
});
