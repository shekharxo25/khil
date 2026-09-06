import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Button } from '../ui/Button';
import { BloomMark } from '../ui/Bloom';
import { color, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';

/**
 * Role selection screen.
 *
 * First screen ever shown — parent or pediatrician login.
 * Kid-friendly design with large, colorful buttons and clear icons.
 */
export function Login() {
  const { loginAsParent, loginAsPediatrician } = useApp();
  const nav = useNav();

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <BloomMark size={64} tint={color.kite.parrot} />
        <Txt variant="display" center>
          Khil
        </Txt>
        <Txt variant="body" tone="soft" center>
          Play that quietly notices how children grow.
        </Txt>
      </View>

      <Txt variant="title" style={styles.section}>
        Who's here today?
      </Txt>

      <View style={styles.buttonGroup}>
        <Button
          label="👨‍👩‍👧‍👦 I'm a Parent"
          variant="primary"
          onPress={() => {
            loginAsParent();
            nav.reset('onboarding');
          }}
        />
        <Button
          label="👨‍⚕️ I'm a Pediatrician"
          variant="secondary"
          onPress={() => {
            loginAsPediatrician('specialist-demo');
            nav.reset('pediatricianOnboarding');
          }}
        />
      </View>

      <View style={styles.footer}>
        <Txt variant="small" tone="faint" center>
          Everything stays on this device unless a concern is raised and a specialist confirms it.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xl,
  },
  section: {
    marginTop: space.lg,
    marginBottom: space.md,
  },
  buttonGroup: {
    gap: space.md,
  },
  footer: {
    marginTop: space.xl,
    paddingVertical: space.md,
  },
});
