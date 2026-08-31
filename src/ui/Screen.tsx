import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '../theme/tokens';
import { Txt } from './Txt';
import { useNav } from '../nav/navigation';

type Props = {
  children: React.ReactNode;
  /** Left-aligned screen title in the header row. */
  title?: string;
  /** Small caps eyebrow above the title. */
  eyebrow?: string;
  backLabel?: string;
  onBack?: () => void;
  scroll?: boolean;
  background?: string;
  /** Pinned footer that never scrolls (used for primary actions). */
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
};

export function Screen({
  children,
  title,
  eyebrow,
  backLabel,
  onBack,
  scroll = true,
  background = color.paper,
  footer,
  contentStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const showBack = !!backLabel || (!!onBack && !!backLabel);

  const header =
    showBack || title ? (
      <View style={styles.header}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back to ${backLabel}`}
            hitSlop={12}
            onPress={onBack ?? (() => nav.back())}
            style={styles.back}
          >
            <Txt variant="small" tone="brand">
              ‹ {backLabel}
            </Txt>
          </Pressable>
        ) : null}
        {eyebrow ? (
          <Txt variant="label" tone="faint" style={styles.eyebrow}>
            {eyebrow}
          </Txt>
        ) : null}
        {title ? <Txt variant="title">{title}</Txt> : null}
      </View>
    ) : null;

  const body = (
    <>
      {header}
      {children}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: background, paddingTop: insets.top }]}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: footer ? space.lg : insets.bottom + space.xxl },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content, contentStyle]}>{body}</View>
      )}

      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, space.lg), backgroundColor: background },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    gap: space.lg,
  },
  header: { gap: space.xs, marginBottom: space.xs },
  back: { marginBottom: space.sm, alignSelf: 'flex-start' },
  eyebrow: {},
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    gap: space.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -4 },
      },
      default: {},
    }),
  },
});
