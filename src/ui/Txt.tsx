import React from 'react';
import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { color, font } from '../theme/tokens';

export type TxtVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'micro'
  | 'label';

type Props = TextProps & {
  variant?: TxtVariant;
  tone?: 'ink' | 'soft' | 'faint' | 'brand' | 'notice' | 'inverse' | 'clinic' | 'positive';
  center?: boolean;
};

/**
 * Single text component so type scale and tone stay consistent across three
 * very different audiences. `label` is the small tracked caps used for section
 * headers throughout the parent and clinician views.
 */
export function Txt({ variant = 'body', tone = 'ink', center, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        variants[variant],
        { color: tones[tone] },
        center && styles.center,
        style,
      ]}
    />
  );
}

const tones: Record<NonNullable<Props['tone']>, string> = {
  ink: color.ink,
  soft: color.inkSoft,
  faint: color.inkFaint,
  brand: color.brand,
  notice: color.notice,
  inverse: '#FFFFFF',
  clinic: color.clinic,
  positive: color.positive,
};

const systemSerifless = Platform.select({ ios: undefined, default: undefined });

const styles = StyleSheet.create({
  base: {
    fontFamily: systemSerifless,
    includeFontPadding: false,
  },
  center: { textAlign: 'center' },
});

const variants: Record<TxtVariant, TextStyle> = {
  display: { fontSize: font.display, fontWeight: '800', letterSpacing: -0.7, lineHeight: font.display * 1.16 },
  title: { fontSize: font.title, fontWeight: '700', letterSpacing: -0.4, lineHeight: font.title * 1.24 },
  heading: { fontSize: font.heading, fontWeight: '700', letterSpacing: -0.2, lineHeight: font.heading * 1.32 },
  body: { fontSize: font.body, fontWeight: '400', lineHeight: font.body * 1.52 },
  bodyStrong: { fontSize: font.body, fontWeight: '600', lineHeight: font.body * 1.5 },
  small: { fontSize: font.small, fontWeight: '400', lineHeight: font.small * 1.5 },
  micro: { fontSize: font.micro, fontWeight: '500', lineHeight: font.micro * 1.45 },
  label: {
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    lineHeight: font.micro * 1.4,
  },
};
