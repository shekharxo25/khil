import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { Txt } from './Txt';
import { tapFeedback } from '../lib/feedback';

type Variant = 'primary' | 'secondary' | 'quiet' | 'notice' | 'clinic' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  /** Leading glyph. Decorative only — the label always carries the meaning. */
  glyph?: string;
  style?: ViewStyle;
  haptics?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  full = true,
  small,
  glyph,
  style,
  haptics = true,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();

  const v = VARIANTS[variant];

  return (
    <Animated.View style={[{ transform: [{ scale }] }, full && styles.full, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityLabel={label}
        disabled={disabled}
        onPressIn={() => spring(0.97)}
        onPressOut={() => spring(1)}
        onPress={() => {
          if (haptics) tapFeedback();
          onPress();
        }}
        style={[
          styles.base,
          small && styles.small,
          { backgroundColor: v.bg, borderColor: v.border },
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.row}>
          {glyph ? (
            <Txt variant="bodyStrong" style={[styles.glyph, { color: v.fg }]}>
              {glyph}
            </Txt>
          ) : null}
          <Txt
            variant={small ? 'small' : 'bodyStrong'}
            style={[styles.label, { color: v.fg }]}
            numberOfLines={2}
          >
            {label}
          </Txt>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: color.brand, fg: '#FFFFFF', border: color.brand },
  secondary: { bg: color.surface, fg: color.brandDeep, border: color.hairlineStrong },
  quiet: { bg: 'transparent', fg: color.inkSoft, border: 'transparent' },
  notice: { bg: color.notice, fg: '#FFFFFF', border: color.notice },
  clinic: { bg: color.slate, fg: '#FFFFFF', border: color.slate },
  danger: { bg: '#FCEDEA', fg: '#9C3A26', border: '#F0CFC6' },
};

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 40, paddingVertical: space.sm, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  glyph: { fontSize: 15 },
  label: { textAlign: 'center', letterSpacing: 0.2 },
  disabled: { opacity: 0.42 },
});
