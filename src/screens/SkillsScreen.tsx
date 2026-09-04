import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { ProgressBar, Row } from '../ui/Bits';
import { color, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { DOMAIN_IDS, DOMAINS } from '../domain/domains';
import { GAME_LIST } from '../domain/games';
import { WEEKLY_DOMAIN_TARGET, weekCoverage } from '../domain/rotation';

/**
 * The six skill areas behind the dashboard's "6 skills tracked" stat.
 *
 * This screen exists to make that number auditable rather than decorative: a
 * parent can see which areas were touched, how often, and which game touched
 * them. Spec §1 is explicit that the stat only means something if the domains
 * are genuinely distinct.
 */
export function SkillsScreen() {
  const { sessions } = useApp();
  const coverage = useMemo(() => weekCoverage(sessions), [sessions]);

  return (
    <Screen backLabel="progress" title="Six skill areas" eyebrow="This week">
      <Txt variant="small" tone="soft" style={styles.negTop}>
        Khil aims to touch every area at least {WEEKLY_DOMAIN_TARGET} times a week. Rotation
        picks whichever areas have had the least play.
      </Txt>

      {DOMAIN_IDS.map(id => {
        const domain = DOMAINS[id];
        const count = coverage[id];
        const games = GAME_LIST.filter(g => g.domains.includes(id));
        return (
          <Card key={id}>
            <Row align="flex-start" gap={space.md}>
              <View style={styles.badge}>
                <Txt style={styles.glyph}>{domain.emoji}</Txt>
              </View>
              <View style={styles.grow}>
                <Row style={styles.titleRow}>
                  <Txt variant="bodyStrong">{domain.label}</Txt>
                  <Txt variant="micro" tone={count >= WEEKLY_DOMAIN_TARGET ? 'positive' : 'faint'}>
                    {count} / {WEEKLY_DOMAIN_TARGET} this week
                  </Txt>
                </Row>
                <Txt variant="small" tone="soft" style={styles.mtXs}>
                  {domain.blurb}
                </Txt>
                <View style={styles.bar}>
                  <ProgressBar
                    value={Math.min(1, count / WEEKLY_DOMAIN_TARGET)}
                    tint={count >= WEEKLY_DOMAIN_TARGET ? color.positive : color.kite.saffron}
                    height={6}
                  />
                </View>
                <Txt variant="micro" tone="faint" style={styles.mtXs}>
                  Seen in: {games.map(g => g.title).join(' · ')}
                </Txt>
              </View>
            </Row>
          </Card>
        );
      })}

      <Card tone="sunk">
        <Txt variant="small" tone="soft">
          None of these areas is a score, and none of them is a condition. They describe
          what a child was doing on screen — how quickly they answered, what they tapped,
          and how they changed their mind.
        </Txt>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  negTop: { marginTop: -6 },
  grow: { flex: 1 },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: color.surfaceSunk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 20 },
  titleRow: { justifyContent: 'space-between' },
  mtXs: { marginTop: space.xs },
  bar: { marginTop: space.md },
});
