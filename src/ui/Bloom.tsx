import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { DOMAINS, DOMAIN_IDS, type DomainId } from '../domain/domains';
import { PETAL_COLORS, color } from '../theme/tokens';
import { Txt } from './Txt';

/**
 * The bloom.
 *
 * Khil (खिल) means "to bloom", and this is that made literal: one petal per
 * skill area, filling in as the week's play covers it. It replaces the progress
 * bar and stat row that would otherwise carry "10 skills tracked", because a
 * bar can only say how much, and this says how much of what — a half-covered
 * week looks visibly lopsided rather than merely short.
 *
 * Petal order and colour come from DOMAIN_IDS, so a domain always occupies the
 * same position. A parent learns the shape of their own child's week.
 */

type Props = {
  coverage: Record<DomainId, number>;
  /** Plays per domain per week that counts as fully covered. */
  target: number;
  size?: number;
  /** Renders on the dark shell instead of paper. */
  onSlate?: boolean;
  centerLabel?: string;
  centerCaption?: string;
  onPress?: () => void;
};

function petalPath(length: number, halfWidth: number): string {
  const w = halfWidth;
  const h = length;
  return `M 0 0 C ${-w} ${-h * 0.35}, ${-w} ${-h * 0.82}, 0 ${-h} C ${w} ${-h * 0.82}, ${w} ${-h * 0.35}, 0 0 Z`;
}

export function Bloom({
  coverage,
  target,
  size = 200,
  onSlate,
  centerLabel,
  centerCaption,
  onPress,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const petalLength = size * 0.4;
  const petalHalf = (Math.PI * petalLength) / DOMAIN_IDS.length / 1.35;
  const step = 360 / DOMAIN_IDS.length;

  const covered = DOMAIN_IDS.filter(id => coverage[id] > 0).length;

  const body = (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G x={cx} y={cy}>
          {DOMAIN_IDS.map((id, index) => {
            const fraction = Math.min(1, (coverage[id] ?? 0) / target);
            const tint = PETAL_COLORS[index];
            return (
              <G key={id} rotation={index * step}>
                {/* The empty petal is always drawn, so the shape of the week
                    is legible from what is missing as much as what is there. */}
                <Path
                  d={petalPath(petalLength, petalHalf)}
                  fill={onSlate ? color.slateRaise : color.surfaceSunk}
                  stroke={onSlate ? color.slateLine : color.hairline}
                  strokeWidth={1}
                />
                {fraction > 0 ? (
                  <Path
                    d={petalPath(petalLength * (0.42 + 0.58 * fraction), petalHalf)}
                    fill={tint}
                    opacity={0.35 + 0.65 * fraction}
                  />
                ) : null}
              </G>
            );
          })}
          <Circle
            r={size * 0.15}
            fill={onSlate ? color.slate : color.surface}
            stroke={onSlate ? color.slateLine : color.hairline}
            strokeWidth={1}
          />
        </G>
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Txt variant="title" tone={onSlate ? 'chalk' : 'ink'}>
          {centerLabel ?? `${covered}`}
        </Txt>
        {centerCaption ? (
          <Txt variant="micro" tone={onSlate ? 'chalkFaint' : 'faint'}>
            {centerCaption}
          </Txt>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${covered} of ${DOMAIN_IDS.length} skill areas covered this week. Open the full list.`}
      onPress={onPress}
    >
      {body}
    </Pressable>
  );
}

/** The wordmark bloom — same geometry, one colour, no data. */
export function BloomMark({
  size = 34,
  tint = color.brand,
}: {
  size?: number;
  tint?: string;
}) {
  const petalLength = size * 0.42;
  const petalHalf = (Math.PI * petalLength) / DOMAIN_IDS.length / 1.25;
  const step = 360 / DOMAIN_IDS.length;
  return (
    <Svg width={size} height={size}>
      <G x={size / 2} y={size / 2}>
        {DOMAIN_IDS.map((id, index) => (
          <G key={id} rotation={index * step}>
            <Path d={petalPath(petalLength, petalHalf)} fill={tint} opacity={0.42} />
          </G>
        ))}
        <Circle r={size * 0.15} fill={tint} />
      </G>
    </Svg>
  );
}

/** A small legend that names each petal, for the skills screen. */
export function BloomLegend({ coverage, target }: { coverage: Record<DomainId, number>; target: number }) {
  return (
    <View style={styles.legend}>
      {DOMAIN_IDS.map((id, index) => (
        <View key={id} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: PETAL_COLORS[index] }]} />
          <Txt variant="micro" tone="soft" style={styles.legendLabel} numberOfLines={1}>
            {DOMAINS[id].label}
          </Txt>
          <Txt variant="micro" tone={coverage[id] >= target ? 'positive' : 'faint'}>
            {coverage[id]}/{target}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1 },
});
