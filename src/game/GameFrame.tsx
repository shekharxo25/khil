import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space } from '../theme/tokens';
import { Txt } from '../ui/Txt';
import { ProgressBar } from '../ui/Bits';

/**
 * The shared phone frame for every game (spec §3).
 *
 * Nothing game-specific lives here. Swap `children` and you have the next game:
 * the voice bar, the progress meter, the "Session X of 10" counter and the
 * hold-to-exit affordance are identical across all four, which is the whole
 * point of the template.
 */

type Props = {
  /** Adult-facing game name, rendered very quietly. */
  title: string;
  /** The current spoken instruction. Shown as text only when `showPromptText`. */
  prompt: string;
  speaking: boolean;
  onReplayPrompt: () => void;
  /** 0…1 across the whole session, not just this game. */
  progress: number;
  sessionNumber: number;
  sessionTotal: number;
  showPromptText: boolean;
  showCaptureDebug: boolean;
  /** Live telemetry lines for the presenter overlay. */
  captureLines?: string[];
  accent: string;
  onExit: () => void;
  children: React.ReactNode;
};

export function GameFrame({
  title,
  prompt,
  speaking,
  onReplayPrompt,
  progress,
  sessionNumber,
  sessionTotal,
  showPromptText,
  showCaptureDebug,
  captureLines,
  accent,
  onExit,
  children,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[color.slate, color.slateDeep]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.root}
    >
      <View style={[styles.inner, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.topRow}>
          {/* Hold-to-exit: a stray toddler tap must not end the session. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hold to exit the session"
            accessibilityHint="Press and hold for a moment"
            onLongPress={onExit}
            delayLongPress={650}
            hitSlop={14}
            style={styles.exit}
          >
            <Txt variant="micro" tone="faint">
              ✕ hold
            </Txt>
          </Pressable>

          <Txt variant="micro" tone="faint">
            Session {sessionNumber} of {sessionTotal}
          </Txt>

          <Txt variant="micro" tone="faint" style={styles.gameName} numberOfLines={1}>
            {title}
          </Txt>
        </View>

        <ProgressBar value={progress} tint={accent} height={8} />

        <VoiceBar
          prompt={prompt}
          speaking={speaking}
          showText={showPromptText}
          accent={accent}
          onReplay={onReplayPrompt}
        />

        <View style={styles.stage}>{children}</View>

        {showCaptureDebug ? (
          <View style={[styles.capture, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
            <Txt variant="micro" tone="faint">
              [ PASSIVE CAPTURE RUNNING — NOT SHOWN DURING REAL PLAY ]
            </Txt>
            {(captureLines ?? []).map((line, i) => (
              <Txt key={i} variant="micro" tone="faint" style={styles.captureLine}>
                {line}
              </Txt>
            ))}
          </View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, space.md) }} />
        )}
      </View>
    </LinearGradient>
  );
}

/**
 * The voice bar. Instructions are spoken; the bar shows that something is being
 * said and lets the child (or the adult beside them) hear it again.
 */
function VoiceBar({
  prompt,
  speaking,
  showText,
  accent,
  onReplay,
}: {
  prompt: string;
  speaking: boolean;
  showText: boolean;
  accent: string;
  onReplay: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Say it again: ${prompt}`}
      onPress={onReplay}
      style={styles.voiceBar}
    >
      <View style={[styles.speaker, { backgroundColor: `${accent}22` }]}>
        <Txt style={styles.speakerGlyph}>🔊</Txt>
      </View>

      <View style={styles.voiceBody}>
        {showText ? (
          <Txt variant="heading" numberOfLines={2}>
            {prompt}
          </Txt>
        ) : (
          <Waveform active={speaking} tint={accent} />
        )}
      </View>

      <Txt variant="micro" tone="faint">
        {speaking ? '' : 'again'}
      </Txt>
    </Pressable>
  );
}

/** Five bars that breathe while the instruction plays. Decorative, never load-bearing. */
function Waveform({ active, tint }: { active: boolean; tint: string }) {
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.28))).current;

  useEffect(() => {
    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(bar, {
            toValue: 1,
            duration: 340,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: 0.28,
            duration: 340,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ]),
      ),
    );

    if (active) {
      loops.forEach(l => l.start());
    } else {
      bars.forEach(bar => {
        bar.stopAnimation();
        Animated.timing(bar, { toValue: 0.28, duration: 180, useNativeDriver: false }).start();
      });
    }

    return () => loops.forEach(l => l.stop());
  }, [active, bars]);

  return (
    <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              backgroundColor: tint,
              opacity: active ? 0.95 : 0.35,
              height: bar.interpolate({ inputRange: [0, 1], outputRange: [8, 30] }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exit: { paddingVertical: 4, paddingRight: space.md, minWidth: 64 },
  gameName: { maxWidth: 120, textAlign: 'right' },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: '#FFFFFFEE',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 74,
    shadowColor: '#2A3A55',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  speaker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerGlyph: { fontSize: 22 },
  voiceBody: { flex: 1, justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32 },
  waveBar: { width: 6, borderRadius: 3 },
  stage: { flex: 1, justifyContent: 'center' },
  capture: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000018',
    paddingTop: space.sm,
    gap: 2,
  },
  captureLine: { fontVariant: ['tabular-nums'] },
});
