import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Txt } from './Txt';
import { Field } from './Field';
import { Button } from './Button';
import { color, space, radius } from '../theme/tokens';
import type { ChatMessage } from '../store/types';

/**
 * Mini chat modal for the floating chat button.
 * Compact, overlay-based chat interface.
 */
export function MiniChatModal({
  messages,
  onSendMessage,
  onClose,
}: {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!draft.trim()) return;
    setIsLoading(true);
    try {
      onSendMessage(draft);
      setDraft('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Txt variant="bodyStrong">Ask Khil</Txt>
        <Button
          label="✕"
          variant="quiet"
          onPress={onClose}
          small
        />
      </View>

      <ScrollView
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <Txt variant="small" tone="faint" center style={styles.empty}>
            Ask about screening, development, or play — grounded in published research.
          </Txt>
        ) : (
          messages.map(m => {
            const mine = m.from === 'parent';
            return (
              <View key={m.id} style={[styles.row, mine && styles.rowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Txt variant="small" tone={mine ? 'inverse' : 'ink'}>
                    {m.body}
                  </Txt>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.composer}>
        <Field
          label=""
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask a question…"
        />
        <Button
          label="Send"
          small
          full={false}
          onPress={handleSend}
          disabled={!draft.trim() || isLoading}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.hairline,
  },
  messages: { flex: 1 },
  messagesContent: {
    padding: space.md,
    gap: space.sm,
  },
  empty: {
    marginVertical: space.lg,
  },
  row: {
    alignItems: 'flex-start',
    maxWidth: '84%',
  },
  rowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  bubbleTheirs: {
    backgroundColor: color.surfaceSunk,
    borderTopLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: color.brand,
    borderTopRightRadius: 4,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
});
