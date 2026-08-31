import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './store/AppStore';
import { NavigationProvider, useNav, type RouteName } from './nav/navigation';
import { color } from './theme/tokens';
import { BloomMark } from './ui/Bits';
import { Txt } from './ui/Txt';
import { prepareAudio } from './lib/sounds';
import { Onboarding } from './screens/Onboarding';
import { ParentDashboard } from './screens/ParentDashboard';
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
  parentHome: ParentDashboard,
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

function Gate() {
  const { state } = useApp();

  useEffect(() => {
    void prepareAudio();
  }, []);

  if (!state.hydrated) {
    return (
      <View style={styles.splash}>
        <BloomMark size={52} />
        <Txt variant="title" style={styles.splashTitle}>
          Khil
        </Txt>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }

  const initial = state.child && state.consent ? 'parentHome' : 'onboarding';

  return (
    <NavigationProvider initial={{ name: initial, params: undefined }}>
      <Router />
    </NavigationProvider>
  );
}

export function Root() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Gate />
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
    backgroundColor: color.paper,
  },
  splashTitle: { letterSpacing: 1 },
});
