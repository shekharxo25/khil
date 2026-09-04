import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Checkbox, Field } from '../ui/Field';
import { Chip, Row } from '../ui/Bits';
import { BloomMark } from '../ui/Bloom';
import { color, radius, space } from '../theme/tokens';
import { COVERED_PINS, lookupPin } from '../domain/coverage';
import { DOMAIN_COUNT } from '../domain/domains';
import { GAME_IDS } from '../domain/games';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { PLANS, DEFAULT_PLAN } from '../store/types';

/**
 * Screen 01 — Account and consent.
 *
 * This used to be the child's profile too. It is now the household: the PIN
 * cluster, the matched specialist, and the two consents. Children are added
 * afterwards, one at a time, because a parent with more than one child should
 * not have to pretend they only have the first.
 *
 * Wireframe notes 2, 3 and 4 all still live here — PIN validated against the
 * covered clusters, consent explicit that only the flagged segment is shared,
 * and a separate acknowledgement that sets expectations before any flag exists.
 * Note 1 (date of birth drives content, no age picker) moved with the child to
 * the profile screen.
 */
export function Onboarding() {
  const { createAccount } = useApp();
  const nav = useNav();

  const [pin, setPin] = useState('');
  const [consentClip, setConsentClip] = useState(false);
  const [consentScreening, setConsentScreening] = useState(false);

  const coverage = useMemo(() => lookupPin(pin), [pin]);
  const plan = PLANS[DEFAULT_PLAN];
  const ready = coverage.covered && consentClip && consentScreening;

  const onContinue = () => {
    if (!ready || !coverage.covered) return;
    createAccount({
      pin: pin.trim(),
      specialistId: coverage.cluster.specialist.id,
      consentClipSharing: consentClip,
      consentScreeningNotDiagnosis: consentScreening,
    });
    nav.reset('profileEditor');
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Create account" onPress={onContinue} disabled={!ready} />
          <Txt variant="micro" tone="faint" center>
            Everything stays on this device unless a flag is raised.
          </Txt>
        </>
      }
    >
      <View style={styles.brand}>
        <BloomMark size={44} tint={color.kite.parrot} />
        <View style={styles.grow}>
          <Txt variant="display">Khil</Txt>
          <Txt variant="small" tone="soft">
            Play that quietly notices how your child is growing.
          </Txt>
        </View>
      </View>

      <Row gap={space.sm} wrap>
        <Chip label={`${GAME_IDS.length} games`} tone="brand" />
        <Chip label={`${DOMAIN_COUNT} skill areas`} tone="brand" />
        <Chip label="No camera, no microphone" tone="neutral" />
      </Row>

      <Txt variant="title" style={styles.sectionTop}>
        Set up your household
      </Txt>

      <Card>
        <Field
          label="PIN code"
          value={pin}
          onChangeText={next => setPin(next.replace(/\D/g, '').slice(0, 6))}
          placeholder="e.g. 380015"
          keyboardType="number-pad"
          maxLength={6}
        />
        {pin.length === 0 ? (
          <Txt variant="micro" tone="faint" style={styles.mt}>
            Covered at launch: {COVERED_PINS.join(' · ')}
          </Txt>
        ) : null}
      </Card>

      {coverage.covered ? (
        <Card tone="brand" label="Nearby specialist (auto-matched)">
          <Row gap={space.md} align="flex-start">
            <View style={styles.avatar}>
              <Txt variant="heading" tone="brand">
                {coverage.cluster.specialist.name.replace('Dr. ', '').charAt(0)}
              </Txt>
            </View>
            <View style={styles.grow}>
              <Txt variant="bodyStrong">{coverage.cluster.specialist.name}</Txt>
              <Txt variant="small" tone="soft">
                {coverage.cluster.specialist.clinic} · {coverage.cluster.specialist.distanceKm} km
              </Txt>
              <Txt variant="micro" tone="faint">
                {coverage.cluster.area}
              </Txt>
            </View>
          </Row>
        </Card>
      ) : pin.length === 6 ? (
        <Card tone="notice" label="Not covered yet">
          <Txt variant="body" tone="notice">
            Khil has not partnered with a specialist in {pin} yet.
          </Txt>
          {/*
            The gate is deliberate, and the copy says why. Khil's only useful
            output is a hand-off to a named clinician; raising a concern with a
            parent and no route to resolve it would be worse than staying shut.
          */}
          <Txt variant="small" tone="notice" style={styles.mt}>
            Sign-up opens when a clinic near you joins, because anything Khil noticed
            would have nowhere to go until then.
          </Txt>
          <View style={styles.mt}>
            <Chip label="Waitlist" tone="notice" glyph="⏳" />
          </View>
          <Txt variant="micro" tone="faint" style={styles.mt}>
            Covered at launch: {COVERED_PINS.join(' · ')}
          </Txt>
        </Card>
      ) : null}

      <Card label="Before you start">
        <Checkbox checked={consentClip} onToggle={() => setConsentClip(v => !v)} marker="3">
          <Txt variant="small">
            I consent to gameplay being reviewed{' '}
            <Txt variant="smallStrong">on this device</Txt> for developmental patterns, and
            to <Txt variant="smallStrong">only the specific flagged segment</Txt> — never
            full recordings — being shared with the matched specialist above.
          </Txt>
        </Checkbox>

        <View style={styles.consentDivider} />

        <Checkbox
          checked={consentScreening}
          onToggle={() => setConsentScreening(v => !v)}
          marker="4"
        >
          <Txt variant="small">
            I understand this is a screening aid,{' '}
            <Txt variant="smallStrong">not a diagnosis</Txt>, and that any concern will
            always be confirmed by the specialist directly.
          </Txt>
        </Checkbox>
      </Card>

      <Card tone="sunk" label="What happens next">
        <Txt variant="small" tone="soft">
          You’ll add your children one at a time. {plan.name} covers{' '}
          {plan.profileLimit} children, each with their own games and their own separate
          history.
        </Txt>
        <Txt variant="small" tone="soft" style={styles.mt}>
          Khil records how long your child takes to respond, what they tap, and how often
          they change their mind. No camera, no microphone, no video.
        </Txt>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  sectionTop: { marginTop: space.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hairline,
    marginVertical: space.sm,
  },
  mt: { marginTop: space.sm },
});
