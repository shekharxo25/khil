import React from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { color, radius, shadow, space } from '../theme/tokens';
import { Txt } from './Txt';

type Tone = 'plain' | 'notice' | 'brand' | 'clinic' | 'sunk';

type Props = ViewProps & {
  tone?: Tone;
  /** Small tracked caps header inside the card. */
  label?: string;
  padded?: boolean;
  style?: ViewStyle;
};

export function Card({ tone = 'plain', label, padded = true, style, children, ...rest }: Props) {
  const t = TONES[tone];
  return (
    <View
      {...rest}
      style={[
        styles.base,
        { backgroundColor: t.bg, borderColor: t.border },
        padded && styles.padded,
        tone === 'plain' && shadow.card,
        style,
      ]}
    >
      {label ? (
        <Txt variant="label" tone={t.labelTone} style={styles.label}>
          {label}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

const TONES: Record<Tone, { bg: string; border: string; labelTone: 'faint' | 'notice' | 'brand' | 'ink' }> = {
  plain: { bg: color.surface, border: color.hairline, labelTone: 'faint' },
  notice: { bg: color.noticeSurface, border: color.noticeEdge, labelTone: 'notice' },
  brand: { bg: color.brandTint, border: color.brandSoft, labelTone: 'brand' },
  clinic: { bg: color.surfaceSunk, border: color.hairlineStrong, labelTone: 'ink' },
  sunk: { bg: color.surfaceSunk, border: color.hairline, labelTone: 'faint' },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  padded: { padding: space.lg },
  label: { marginBottom: space.sm },
});
