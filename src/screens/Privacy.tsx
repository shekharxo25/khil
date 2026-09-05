import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Row } from '../ui/Bits';
import { space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';

/**
 * Consent & data controls — Milestone spec §3: "lets a parent see exactly
 * what's stored, how long, and delete their data/account. This isn't
 * optional for anything handling children's data."
 *
 * The counts below are read straight from the same store every other screen
 * reads from, not a separate summary that could quietly drift out of date.
 *
 * Deletion is real (calls the same wipe every "erase" control in this app
 * calls) and is gated behind typing the child's name, rather than a single
 * tap — an irreversible action gets a harder-to-misfire control, not a
 * softer one.
 */
export function Privacy() {
  const { state, child, profiles, sessions, flags, resetAll } = useApp();
  const nav = useNav();
  const [confirmText, setConfirmText] = useState('');

  const totals = useMemo(() => {
    const allSessions = state.sessions.length;
    const allRounds = state.sessions.reduce((n, s) => n + s.rounds.length, 0);
    return { allSessions, allRounds, allFlags: state.flags.length, allMessages: state.messages.length };
  }, [state.sessions, state.flags, state.messages]);

  const readyToDelete = confirmText.trim().toLowerCase() === (child?.name.trim().toLowerCase() ?? '__none__');

  return (
    <Screen backLabel="progress" title="Privacy & data">
      <Card label="What Khil stores">
        <Txt variant="small" tone="soft">
          Response timings, which tile was tapped, and whether it matched — for every game,
          for every child on this account. No camera, no microphone, no video, no audio.
        </Txt>
        <View style={styles.rows}>
          <Row style={styles.between}>
            <Txt variant="small">Children on this account</Txt>
            <Txt variant="smallStrong">{profiles.length}</Txt>
          </Row>
          <Row style={styles.between}>
            <Txt variant="small">Sessions recorded (all children)</Txt>
            <Txt variant="smallStrong">{totals.allSessions}</Txt>
          </Row>
          <Row style={styles.between}>
            <Txt variant="small">Rounds recorded (all children)</Txt>
            <Txt variant="smallStrong">{totals.allRounds}</Txt>
          </Row>
          <Row style={styles.between}>
            <Txt variant="small">Flags ever raised (all children)</Txt>
            <Txt variant="smallStrong">{totals.allFlags}</Txt>
          </Row>
          <Row style={styles.between}>
            <Txt variant="small">Messages sent</Txt>
            <Txt variant="smallStrong">{totals.allMessages}</Txt>
          </Row>
        </View>
      </Card>

      <Card label="Where it lives">
        <Txt variant="small" tone="soft">
          Everything above lives only on this device, for as long as the account exists. There
          is no server copy. If a flag is ever shared with your matched specialist, only that
          flag's short description and the specific flagged rounds are sent — never a child's
          full history, and never to anyone outside your matched clinic.
        </Txt>
      </Card>

      <Card label="Sharing" tone="sunk">
        <Txt variant="small" tone="soft">
          {state.consent?.flagged_clip_sharing
            ? 'You’ve consented to sharing the flagged segment only, with your matched specialist.'
            : 'No sharing consent is currently on record.'}
        </Txt>
      </Card>

      <Card tone="notice" label="Delete everything">
        <Txt variant="body" tone="notice">
          This permanently erases every child's profile, every session, every flag, and every
          message on this device. It cannot be undone, and Khil keeps no other copy.
        </Txt>
        {profiles.length > 0 ? (
          <View style={styles.mtLg}>
            <Field
              label={`Type "${child?.name ?? profiles[0].name}" to confirm`}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={child?.name ?? profiles[0].name}
            />
          </View>
        ) : null}
        <View style={styles.mtMd}>
          <Button
            label="Delete my data and start over"
            variant="danger"
            disabled={profiles.length > 0 && !readyToDelete}
            onPress={() => {
              resetAll();
              nav.reset('onboarding');
            }}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: space.md, gap: space.sm },
  between: { justifyContent: 'space-between' },
  mtLg: { marginTop: space.lg },
  mtMd: { marginTop: space.md },
});
