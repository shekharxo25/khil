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
import { Login } from './screens/Login';
import { Onboarding } from './screens/Onboarding';
import { PediatricianOnboarding } from './screens/PediatricianOnboarding';
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
import { ReportHistory } from './screens/ReportHistory';
import { Privacy } from './screens/Privacy';
import { Messages } from './screens/Messages';

const SCREENS: Record<RouteName, React.ComponentType> = {
  login: Login,
  onboarding: Onboarding,
  pediatricianOnboarding: PediatricianOnboarding,
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
  reportHistory: ReportHistory,
  privacy: Privacy,
  messages: Messages,
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

  // First check: does the user have a role (are they logged in)?
  if (!state.userRole) {
    const initial: RouteName = 'login';
    return (
      <NavigationProvider initial={{ name: initial, params: undefined }}>
        <Router />
      </NavigationProvider>
    );
  }

  // Parent flow: account (PIN + consent) → profiles → active profile
  if (state.userRole === 'parent') {
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

  // Pediatrician flow: onboarding → clinic list
  if (state.userRole === 'pediatrician') {
    const initial: RouteName = !state.account ? 'pediatricianOnboarding' : 'clinicList';
    return (
      <NavigationProvider initial={{ name: initial, params: undefined }}>
        <Router />
      </NavigationProvider>
    );
  }

  return <Splash />;
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
