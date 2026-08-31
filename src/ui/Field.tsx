import React from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextStyle,
} from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { Txt } from './Txt';
import { softFeedback } from '../lib/feedback';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  /** Inline validation message. Shown in notice tone, never red. */
  hint?: string;
  hintTone?: 'faint' | 'notice' | 'positive';
  style?: TextStyle;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  autoCapitalize = 'sentences',
  hint,
  hintTone = 'faint',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Txt variant="label" tone="faint">
        {label}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.inkFaint}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        accessibilityLabel={label}
        style={styles.input}
      />
      {hint ? (
        <Txt variant="micro" tone={hintTone}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

type CheckProps = {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Optional annotation number from the wireframe, shown as a small marker. */
  marker?: string;
};

export function Checkbox({ checked, onToggle, children, marker }: CheckProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => {
        softFeedback();
        onToggle();
      }}
      style={styles.checkRow}
      hitSlop={6}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? (
          <Txt variant="small" tone="inverse" style={styles.tick}>
            ✓
          </Txt>
        ) : null}
      </View>
      <View style={styles.checkBody}>{children}</View>
      {marker ? (
        <View style={styles.marker}>
          <Txt variant="micro" tone="faint">
            {marker}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  input: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 16,
    color: color.ink,
    minHeight: 50,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.sm,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.6,
    borderColor: color.hairlineStrong,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: color.brand, borderColor: color.brand },
  tick: { fontWeight: '800', lineHeight: 16 },
  checkBody: { flex: 1 },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
