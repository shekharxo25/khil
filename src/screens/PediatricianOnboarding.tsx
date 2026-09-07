import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';

/**
 * Pediatrician onboarding.
 *
 * Collects specialist name, clinic, and confirms access to clustered patients.
 * More professional UI than child/parent screens.
 */
export function PediatricianOnboarding() {
  const { createAccount } = useApp();
  const nav = useNav();

  const [pin, setPin] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [ready, setReady] = useState(false);

  const handleContinue = () => {
    if (!pin.trim() || !clinicName.trim()) return;

    // Demo: create a minimal account for pediatrician
    createAccount({
      pin: pin.trim(),
      specialistId: 'spec-' + pin,
      consentClipSharing: true,
      consentScreeningNotDiagnosis: true,
    });

    nav.reset('clinicList');
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            label="Access Patient List"
            onPress={handleContinue}
            disabled={!pin.trim() || !clinicName.trim()}
          />
          <Txt variant="micro" tone="faint" center style={styles.mt}>
            Your patient data is matched by postal code cluster.
          </Txt>
        </>
      }
    >
      <View style={styles.header}>
        <Txt variant="display">Khil Specialist</Txt>
        <Txt variant="body" tone="soft">
          Set up your clinic access to review patient screening sessions.
        </Txt>
      </View>

      <Txt variant="title" style={styles.sectionTop}>
        Your Details
      </Txt>

      <Card>
        <Field
          label="Your PIN Code"
          value={pin}
          onChangeText={next => setPin(next.replace(/\D/g, '').slice(0, 6))}
          placeholder="e.g. 380015"
          keyboardType="number-pad"
          maxLength={6}
        />
        <Txt variant="micro" tone="faint" style={styles.mt}>
          Used to match your clinic to patient households in your region.
        </Txt>
      </Card>

      <Card style={styles.mt}>
        <Field
          label="Clinic Name"
          value={clinicName}
          onChangeText={setClinicName}
          placeholder="e.g. ABC Pediatric Clinic"
        />
      </Card>

      <Card tone="sunk" label="About Khil for Pediatricians">
        <Txt variant="small" tone="soft">
          Khil is a screening aid — developmental patterns are flagged for your review, never shared with families until you confirm.
        </Txt>
        <Txt variant="small" tone="soft" style={styles.mt}>
          You can approve, dismiss, or request more data on each candidate flag. Only flagged clips are available — never raw full recordings.
        </Txt>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, marginBottom: space.lg },
  sectionTop: { marginTop: space.lg, marginBottom: space.md },
  mt: { marginTop: space.sm },
});
