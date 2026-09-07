import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from './Txt';
import { color, radius, space } from '../theme/tokens';

/**
 * Kid-friendly navigation buttons with large emoji icons and colors.
 *
 * Used for: back, exit, skip, home actions that kids recognize by symbol.
 */

export type NavButtonType = 'back' | 'exit' | 'skip' | 'home' | 'play';

const BUTTON_STYLES: Record<
  NavButtonType,
  { emoji: string; label: string; bgColor: string; fg: string }
> = {
  back: {
    emoji: '⬅️',
    label: 'Back',
    bgColor: color.kite.cobalt,
    fg: '#FFFFFF',
  },
  exit: {
    emoji: '🚪',
    label: 'Exit',
    bgColor: color.kite.coral,
    fg: '#FFFFFF',
  },
  skip: {
    emoji: '⏭️',
    label: 'Skip',
    bgColor: color.kite.saffron,
    fg: '#FFFFFF',
  },
  home: {
    emoji: '🏠',
    label: 'Home',
    bgColor: color.kite.parrot,
    fg: '#FFFFFF',
  },
  play: {
    emoji: '▶️',
    label: 'Play',
    bgColor: color.kite.lime,
    fg: '#FFFFFF',
  },
};

type Props = {
  type: NavButtonType;
  onPress: () => void;
  disabled?: boolean;
};

export function NavigationButton({ type, onPress, disabled }: Props) {
  const style = BUTTON_STYLES[type];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={style.label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <View
        style={[
          styles.button,
          { backgroundColor: style.bgColor },
          disabled && styles.disabled,
        ]}
      >
        <Txt variant="display" style={{ fontSize: 32, color: style.fg }}>
          {style.emoji}
        </Txt>
        <Txt variant="small" style={{ color: style.fg, fontWeight: '600' }}>
          {style.label}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 80,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  disabled: {
    opacity: 0.5,
  },
});
