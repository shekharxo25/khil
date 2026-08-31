import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Checkbox, Field } from '../ui/Field';
import { BloomMark, Chip, Row } from '../ui/Bits';
import { color, space } from '../theme/tokens';
import { COVERED_PINS, lookupPin } from '../domain/coverage';
import { ageInMonths, parseDob } from '../lib/time';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';

/**
 * Screen 01 — Onboarding & consent.
 *
 * Wireframe notes, all four:
 *  1. Name + DOB drive age-banded content — there is no "select age group" step.
 *  2. PIN validates against covered clusters and shows a waitlist state if not.
 *  3. Consent copy is explicit that only the flagged clip is shared.
 *  4. The second checkbox sets diagnostic expectations before any flag exists.
 */

const MIN_MONTHS = 24;
const MAX_MONTHS = 83;

export function Onboarding() {
  const { onboard } = useApp();
  const nav = useNav();

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [pin, setPin] = useState('');
  const [consentClip, setConsentClip] = useState(false);
  const [consentScreening, setConsentScreening] = useState(false);

  const dobDate = useMemo(() => parseDob(dob), [dob]);
  const months = dobDate ? ageInMonths(dobDate.toISOString()) : null;
  const coverage = useMemo(() => lookupPin(pin), [pin]);

  const ageHint = (() => {
    if (dob.length === 0) return undefined;
    if (!dobDate) return 'Use the format DD / MM / YYYY';
    if (months === null) return undefined;
    if (months < MIN_MONTHS) return 'Khil’s games start at age 2. You can set this up later.';
    if (months > MAX_MONTHS) return 'Khil’s games are designed for ages 2 to 6.';
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return `Age ${years}y ${rem}m — games and comparison ranges will match this.`;
  })();

  const ageOk = months !== null && months >= MIN_MONTHS && months <= MAX_MONTHS;
  const ready =
    name.trim().length > 1 && ageOk && coverage.covered && consentClip && consentScreening;

  const onContinue = () => {
    if (!ready || !dobDate || !coverage.covered) return;
    onboard({
      name,
      dobIso: dobDate.toISOString(),
      pin: pin.trim(),
      specialistId: coverage.cluster.specialist.id,
      consentClipSharing: consentClip,
      consentScreeningNotDiagnosis: consentScreening,
    });
    nav.reset('parentHome');
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Continue" onPress={onContinue} disabled={!ready} />
          <Txt variant="micro" tone="faint" center>
            Everything stays on this device unless a flag is raised.
          </Txt>
        </>
      }
    >
      <View style={styles.brand}>
        <BloomMark size={40} />
        <View>
          <Txt variant="display">Khil</Txt>
          <Txt variant="small" tone="soft">
            Play that quietly notices how your child is growing.
          </Txt>
        </View>
      </View>

      <Txt variant="title">Set up your child’s profile</Txt>

      <Card>
        <View style={styles.form}>
          <Field
            label="Child’s name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Aarav"
            autoCapitalize="words"
            maxLength={40}
          />

          <Field
            label="Date of birth"
            value={dob}
            onChangeText={next => setDob(formatDobInput(next))}
            placeholder="DD / MM / YYYY"
            keyboardType="number-pad"
            maxLength={10}
            hint={ageHint}
            hintTone={ageHint && !ageOk && dob.length >= 8 ? 'notice' : 'faint'}
          />
          <Txt variant="micro" tone="faint">
            Date of birth sets the games and the comparison ranges. There is no age
            group to pick.
          </Txt>

          <Field
            label="PIN code"
            value={pin}
            onChangeText={next => setPin(next.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 380015"
            keyboardType="number-pad"
            maxLength={6}
          />
          {pin.length === 0 ? (
            <Txt variant="micro" tone="faint">
              Covered at launch: {COVERED_PINS.join(' · ')}
            </Txt>
          ) : null}
        </View>
      </Card>

      {/* Auto-matched specialist, or an honest waitlist state. */}
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
          <View style={styles.waitlistRow}>
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
            <Txt variant="small" style={styles.em}>
              on this device
            </Txt>{' '}
            for developmental patterns, and to{' '}
            <Txt variant="small" style={styles.em}>
              only the specific flagged segment
            </Txt>{' '}
            — never full recordings — being shared with the matched specialist above.
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
            <Txt variant="small" style={styles.em}>
              not a diagnosis
            </Txt>
            , and that any concern will always be confirmed by the specialist directly.
          </Txt>
        </Checkbox>
      </Card>

      <Card tone="sunk">
        <Txt variant="label" tone="faint">
          What Khil records
        </Txt>
        <Txt variant="small" tone="soft" style={styles.mt}>
          How long your child takes to respond, what they tap, and how often they change
          their mind. No camera, no microphone, no video.
        </Txt>
      </Card>
    </Screen>
  );
}

/** Types DD / MM / YYYY as the user enters digits. */
function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  form: { gap: space.lg },
  grow: { flex: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitlistRow: { marginTop: space.md },
  consentDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hairline,
    marginVertical: space.sm,
  },
  em: { fontWeight: '700' },
  mt: { marginTop: space.sm },
});
