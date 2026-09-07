import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useParams } from '../nav/navigation';
import { relativeDay, formatClock } from '../lib/time';
import type { ChatOrigin } from '../store/types';

/**
 * Chat — a research-grounded assistant for parents.
 *
 * Unlike `Messages.tsx` (explicitly local-only), this one is real: sending a
 * message calls the `/api/chat` backend (see `api/chat.ts`), which retrieves
 * relevant passages from the research brief's sources and asks Claude to
 * answer, grounded in them. If the backend has no `ANTHROPIC_API_KEY`
 * configured yet, it returns a clearly-labeled stand-in reply instead of a
 * real generated one — the UI has no special-case for that, the label is
 * just part of the message body.
 *
 * `flagId` present means this thread is about one specific flag (opened via
 * "Chat about this flag ›" from `FlagDetail.tsx`); absent means the general,
 * app-wide Q&A thread. Both are `ChatMessage`s in the same per-child array,
 * kept apart by `origin` — see `store/types.ts`'s `ChatOrigin`.
 *
 * The assistant is never told to diagnose, and its replies pass through
 * `domain/safeLanguage.ts`'s `assertChatSafeReply` server-side before they
 * reach here — but nothing renders as an alarm regardless: no red, no bold
 * warning chrome, same restraint as the rest of the app.
 */
export function Chat() {
  const { child, flags, chatMessagesFor, sendChatMessage } = useApp();
  const { childId, flagId } = useParams<'chat'>();
  const [draft, setDraft] = useState('');

  const origin: ChatOrigin = flagId ? { type: 'flag', flagId } : { type: 'general' };
  const flag = flagId ? flags.find(f => f.id === flagId) : undefined;
  const thread = chatMessagesFor(childId, origin);

  const onSend = () => {
    if (!draft.trim()) return;
    sendChatMessage(childId, origin, draft);
    setDraft('');
  };

  return (
    <Screen
      backLabel={flagId ? 'flag report' : 'progress'}
      eyebrow="Ask Khil"
      title={flagId ? 'About this flag' : `Questions about ${child?.name ?? 'your child'}'s play`}
      scroll={false}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.disclaimer}>
            <Txt variant="micro" tone="faint" center>
              Answers are drawn from published research, not a read on your child specifically.
              For anything about your child, a specialist is the right person to ask.
            </Txt>
          </View>

          {flag ? (
            <View style={styles.flagContext}>
              <Txt variant="micro" tone="faint">
                Asking about:
              </Txt>
              <Txt variant="small" tone="soft" style={styles.mtXs}>
                {flag.parent_body}
              </Txt>
            </View>
          ) : null}

          {thread.length === 0 ? (
            <Txt variant="small" tone="faint" center style={styles.empty}>
              {flagId
                ? 'Ask anything about this flag — what it might mean, or what the research says.'
                : 'Ask about screening, specific games, or what any of this research actually says.'}
            </Txt>
          ) : (
            thread.map(m => {
              const mine = m.from === 'parent';
              return (
                <View key={m.id} style={[styles.row, mine && styles.rowMine]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Txt variant="body" tone={mine ? 'inverse' : 'ink'}>
                      {m.body}
                    </Txt>
                  </View>
                  {!mine && m.sources && m.sources.length > 0 ? (
                    <View style={styles.sources}>
                      <Txt variant="micro" tone="faint">
                        Sources: {m.sources.map(s => s.title).join(' · ')}
                      </Txt>
                    </View>
                  ) : null}
                  <Txt variant="micro" tone="faint" style={styles.timestamp}>
                    {relativeDay(m.sent_at)} · {formatClock(Date.now() - m.sent_at)} ago
                  </Txt>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.composerField}>
            <Field label="" value={draft} onChangeText={setDraft} placeholder="Ask a question…" />
          </View>
          <Button label="Send" small full={false} onPress={onSend} disabled={!draft.trim()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  thread: { padding: space.xl, gap: space.md, flexGrow: 1 },
  disclaimer: { paddingBottom: space.sm },
  flagContext: {
    backgroundColor: color.surfaceSunk,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  mtXs: { marginTop: space.xs },
  empty: { marginTop: space.xxl },
  row: { alignItems: 'flex-start', maxWidth: '84%' },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  bubbleTheirs: { backgroundColor: color.surfaceSunk, borderTopLeftRadius: 4 },
  bubbleMine: { backgroundColor: color.brand, borderTopRightRadius: 4 },
  sources: { marginTop: 4, marginHorizontal: 4, maxWidth: '100%' },
  timestamp: { marginTop: 4, marginHorizontal: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
  composerField: { flex: 1 },
});
