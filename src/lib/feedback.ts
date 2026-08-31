import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Haptics are additive only — never the sole channel for any signal. */

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

export function tapFeedback(): void {
  if (!supported) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function padFeedback(): void {
  if (!supported) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

export function successFeedback(): void {
  if (!supported) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function softFeedback(): void {
  if (!supported) return;
  Haptics.selectionAsync().catch(() => undefined);
}
