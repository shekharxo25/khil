import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius } from '../theme/tokens';
import { HIT_TARGET_MIN } from '../theme/tokens';

export type TileState = 'idle' | 'wrong' | 'correct' | 'dimmed';

/**
 * A big, forgiving tap target.
 *
 * Feedback vocabulary is fixed across all four games so the child learns it
 * once: a wrong tap wobbles and stays available, a right tap pops and settles.
 * Nothing ever turns red and nothing is ever taken away as a punishment.
 */
export function TapTarget({
  children,
  onPress,
  disabled,
  state = 'idle',
  size,
  accessibilityLabel,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  state?: TileState;
  size: number;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'wrong') {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.6, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]).start();
    }
    if (state === 'correct') {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 26, bounciness: 12 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }),
      ]).start();
      Animated.timing(glow, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [state, scale, shake, glow]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale },
          { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) },
        ],
        opacity: state === 'dimmed' ? 0.42 : 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
            speed: 40,
            bounciness: 0,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 26,
            bounciness: 8,
          }).start()
        }
        onPress={onPress}
        style={[
          styles.tile,
          { width: size, height: size, minWidth: HIT_TARGET_MIN, minHeight: HIT_TARGET_MIN },
          state === 'correct' && styles.tileCorrect,
          style,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { opacity: glow, borderRadius: radius.xl }]}
        />
        <View style={styles.body}>{children}</View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#2A3A55',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    overflow: 'hidden',
  },
  tileCorrect: { borderColor: '#48A97C' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#48A97C22' },
  body: { alignItems: 'center', justifyContent: 'center' },
});
