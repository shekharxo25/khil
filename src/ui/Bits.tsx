import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { Txt } from './Txt';

/** Animated progress track. Child-facing copy never depends on reading it. */
export function ProgressBar({
  value,
  tint = color.accent,
  height = 10,
}: {
  /** 0…1 */
  value: number;
  tint?: string;
  height?: number;
}) {
  const width = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, value));

  useEffect(() => {
    Animated.timing(width, {
      toValue: clamped,
      duration: 420,
      useNativeDriver: false,
    }).start();
  }, [clamped, width]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: tint,
            borderRadius: height / 2,
            width: width.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

export function StatTile({
  value,
  caption,
  tint = color.brand,
}: {
  value: string | number;
  caption: string;
  tint?: string;
}) {
  return (
    <View style={styles.stat}>
      <Txt variant="display" style={{ color: tint }}>
        {value}
      </Txt>
      <Txt variant="small" tone="soft" style={styles.statCaption}>
        {caption}
      </Txt>
    </View>
  );
}

export function Chip({
  label,
  tone = 'neutral',
  glyph,
}: {
  label: string;
  tone?: 'neutral' | 'brand' | 'notice' | 'positive' | 'clinic';
  glyph?: string;
}) {
  const t = CHIP_TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Txt variant="micro" style={{ color: t.fg }}>
        {glyph ? `${glyph} ` : ''}
        {label}
      </Txt>
    </View>
  );
}

const CHIP_TONES = {
  neutral: { bg: color.surfaceSunk, fg: color.inkSoft, border: color.hairline },
  brand: { bg: color.brandSoft, fg: color.brandDeep, border: color.brandSoft },
  notice: { bg: color.noticeSurface, fg: color.notice, border: color.noticeEdge },
  positive: { bg: color.positiveSoft, fg: color.positive, border: color.positiveSoft },
  clinic: { bg: color.clinicSurface, fg: color.clinic, border: color.clinicEdge },
} as const;

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function Row({
  children,
  gap = space.sm,
  align = 'center',
  style,
  wrap,
}: {
  children: React.ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, gap },
        wrap && { flexWrap: 'wrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * The Khil mark — खिल, "to bloom". Five petals around a centre, drawn with
 * plain views so it scales without an asset pipeline.
 */
export function BloomMark({ size = 34, tint = color.brand }: { size?: number; tint?: string }) {
  const petal = size * 0.4;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 72, 144, 216, 288].map(angle => (
        <View
          key={angle}
          style={{
            position: 'absolute',
            width: petal,
            height: petal * 1.5,
            borderRadius: petal,
            backgroundColor: tint,
            opacity: 0.34,
            transform: [
              { rotate: `${angle}deg` },
              { translateY: -size * 0.21 },
            ],
          }}
        />
      ))}
      <View
        style={{
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: size * 0.15,
          backgroundColor: tint,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: color.paperDeep, overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
  stat: { flex: 1, gap: 2 },
  statCaption: { maxWidth: 110 },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
});
