import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './store/AppStore';
import { NavigationProvider, useNav, type RouteName } from './nav/navigation';
import { color } from './theme/tokens';
import { useAppFonts } from './theme/fonts';
import { BloomMark } from './ui/Bloom';
import { Txt } from './ui/Txt';
import { prepareAudio } from './lib/sounds';
import { Onboarding } from './screens/Onboarding';
import { ProfileGate } from './screens/ProfileGate';
import { ProfileEditor } from './screens/ProfileEditor';
import { Plans } from './screens/Plans';
import { ParentDashboard } from './screens/ParentDashboard';
import { GamePicker } from './screens/GamePicker';
import { SessionIntro } from './screens/SessionIntro';
import { SessionRunner } from './screens/SessionRunner';
import { SessionComplete } from './screens/SessionComplete';
import { FlagDetail } from './screens/FlagDetail';
import { SkillsScreen } from './screens/SkillsScreen';
import { PediatricianList } from './screens/PediatricianList';
import { ClipReview } from './screens/ClipReview';
import { DevPanel } from './screens/DevPanel';

const SCREENS: Record<RouteName, React.ComponentType> = {
  onboarding: Onboarding,
  profileGate: ProfileGate,
  profileEditor: ProfileEditor,
  plans: Plans,
  parentHome: ParentDashboard,
  gamePicker: GamePicker,
  sessionIntro: SessionIntro,
  session: SessionRunner,
  sessionComplete: SessionComplete,
  flagDetail: FlagDetail,
  skills: SkillsScreen,
  clinicList: PediatricianList,
  clinicReview: ClipReview,
  devPanel: DevPanel,
};

function Router() {
  const { current } = useNav();
  const Active = SCREENS[current.name];
  // Keying on the route name gives each screen a clean mount, which matters for
  // the session runner: it decides its whole plan once, on mount.
  return <Active key={current.name} />;
}

function Splash() {
  return (
    <View style={styles.splash}>
      <BloomMark size={52} tint={color.kite.parrot} />
      <Txt variant="title" tone="chalk" style={styles.splashTitle}>
        Khil
      </Txt>
      <ActivityIndicator color={color.kite.parrot} />
    </View>
  );
}

function Gate() {
  const { state } = useApp();

  useEffect(() => {
    void prepareAudio();
  }, []);

  if (!state.hydrated) return <Splash />;

  // Three thresholds, in order: an account (PIN + consent), at least one
  // child profile, and a profile actually selected. Each one routes to the
  // screen that fixes exactly what is missing.
  const initial: RouteName = !state.account || !state.consent
    ? 'onboarding'
    : state.profiles.length === 0
      ? 'profileEditor'
      : state.activeProfileId
        ? 'parentHome'
        : 'profileGate';

  return (
    <NavigationProvider initial={{ name: initial, params: undefined }}>
      <Router />
    </NavigationProvider>
  );
}

export function Root() {
  const fontsReady = useAppFonts();

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        {fontsReady ? <Gate /> : <Splash />}
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: color.slate,
  },
  splashTitle: { letterSpacing: 1 },
});
