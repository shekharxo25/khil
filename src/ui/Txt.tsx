import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { color, family, font } from '../theme/tokens';

export type TxtVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'micro'
  | 'label'
  | 'numeric';

export type TxtTone =
  | 'ink'
  | 'soft'
  | 'faint'
  | 'brand'
  | 'notice'
  | 'positive'
  | 'chalk'
  | 'chalkSoft'
  | 'chalkFaint'
  | 'noticeOnSlate'
  | 'inverse';

type Props = TextProps & {
  variant?: TxtVariant;
  tone?: TxtTone;
  center?: boolean;
};

/**
 * The single text component. It owns the family-per-weight mapping, because
 * with custom fonts loaded `fontWeight` does nothing and picking the wrong
 * family is the easiest way to end up with a page in three different faces.
 */
export function Txt({ variant = 'body', tone = 'ink', center, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[styles.base, variants[variant], { color: tones[tone] }, center && styles.center, style]}
    />
  );
}

const tones: Record<TxtTone, string> = {
  ink: color.ink,
  soft: color.inkSoft,
  faint: color.inkFaint,
  brand: color.brandDeep,
  notice: color.notice,
  positive: color.positive,
  chalk: color.chalk,
  chalkSoft: color.chalkSoft,
  chalkFaint: color.chalkFaint,
  noticeOnSlate: color.noticeOnSlate,
  inverse: '#FFFFFF',
};

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
  center: { textAlign: 'center' },
});

const variants: Record<TxtVariant, TextStyle> = {
  display: {
    fontFamily: family.display,
    fontSize: font.display,
    letterSpacing: -0.6,
    lineHeight: font.display * 1.1,
  },
  title: {
    fontFamily: family.displayBold,
    fontSize: font.title,
    letterSpacing: -0.3,
    lineHeight: font.title * 1.2,
  },
  heading: {
    fontFamily: family.bold,
    fontSize: font.heading,
    letterSpacing: -0.1,
    lineHeight: font.heading * 1.34,
  },
  body: { fontFamily: family.body, fontSize: font.body, lineHeight: font.body * 1.54 },
  bodyStrong: { fontFamily: family.semibold, fontSize: font.body, lineHeight: font.body * 1.5 },
  small: { fontFamily: family.body, fontSize: font.small, lineHeight: font.small * 1.52 },
  smallStrong: { fontFamily: family.semibold, fontSize: font.small, lineHeight: font.small * 1.5 },
  micro: { fontFamily: family.medium, fontSize: font.micro, lineHeight: font.micro * 1.45 },
  label: {
    fontFamily: family.bold,
    fontSize: font.micro,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    lineHeight: font.micro * 1.4,
  },
  /** Tabular figures for the clinician's tables. */
  numeric: {
    fontFamily: family.medium,
    fontSize: font.small,
    lineHeight: font.small * 1.5,
    fontVariant: ['tabular-nums'],
  },
};
