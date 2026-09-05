import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useParams } from '../nav/navigation';
import { clusterByPin } from '../domain/coverage';
import { formatTimeOfDay, relativeDay } from '../lib/time';

/**
 * Messages — Milestone spec §3: "Secure messaging thread between parent and
 * mapped pediatrician, so booking/follow-up doesn't need to leave the app."
 *
 * Honest scope note (also in the README): "secure" is doing real work in that
 * sentence, and this build cannot claim it. There is no server here — this
 * thread lives in the same local, on-device store as everything else, so a
 * message "sent" here is not actually transmitted to a pediatrician's own
 * device. What this demonstrates is the UI and the data shape a real
 * implementation would use; wiring it to a backend is what would make the
 * word "secure" true rather than aspirational.
 *
 * One screen serves both sides — `asClinician` only changes which bubble
 * style is "mine" and who the composer sends as.
 */
export function Messages() {
  const { state, profiles, messagesFor, sendMessage } = useApp();
  const { childId, asClinician } = useParams<'messages'>();
  const [draft, setDraft] = useState('');

  const child = profiles.find(p => p.child_id === childId);
  const specialist = state.account ? clusterByPin(state.account.pin)?.specialist : undefined;
  const thread = messagesFor(childId);

  const onSend = () => {
    if (!draft.trim()) return;
    sendMessage(childId, asClinician ? 'clinician' : 'parent', draft);
    setDraft('');
  };

  return (
    <Screen
      backLabel={asClinician ? 'patient list' : 'progress'}
      eyebrow={asClinician ? 'Specialist portal' : undefined}
      title={
        asClinician
          ? `Message ${child?.name ?? 'parent'}`
          : `Message ${specialist?.name ?? 'your specialist'}`
      }
      scroll={false}
      background={asClinician ? color.paper : undefined}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
        >
          {thread.length === 0 ? (
            <Txt variant="small" tone="faint" center style={styles.empty}>
              No messages yet. This thread stays on this device — see Privacy & data for what
              that means.
            </Txt>
          ) : (
            thread.map(m => {
              const mine = asClinician ? m.from === 'clinician' : m.from === 'parent';
              return (
                <View key={m.id} style={[styles.row, mine && styles.rowMine]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Txt variant="body" tone={mine ? 'inverse' : 'ink'}>
                      {m.body}
                    </Txt>
                  </View>
                  <Txt variant="micro" tone="faint" style={styles.timestamp}>
                    {relativeDay(m.sent_at)} · {formatTimeOfDay(m.sent_at)}
                  </Txt>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.composerField}>
            <Field
              label=""
              value={draft}
              onChangeText={setDraft}
              placeholder={asClinician ? 'Message the parent…' : 'Message the specialist…'}
            />
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
  empty: { marginTop: space.xxl },
  row: { alignItems: 'flex-start', maxWidth: '84%' },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  bubbleTheirs: { backgroundColor: color.surfaceSunk, borderTopLeftRadius: 4 },
  bubbleMine: { backgroundColor: color.brand, borderTopRightRadius: 4 },
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
