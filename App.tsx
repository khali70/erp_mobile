import './global.css';
import '@/i18n';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from '@/navigation/RootNavigator';
import { runMigrations } from '@/db/migrate';
import { seedDemoDataIfEmpty, seedCategoriesIfEmpty } from '@/db/seed';
import { usePrivacyGuard } from '@/privacy/usePrivacyGuard';
import { UpdatesProvider } from '@/features/updates/UpdatesProvider';
import { detectInterruptedRestore } from '@/features/settings/restore';
import { RestoreRecoveryScreen } from '@/features/settings/components/RestoreRecoveryScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  /**
   * A restore that never finished leaves a marker. Read it BEFORE migrations:
   * the file at the live database path may be half written, and running the
   * boot DDL over it — or rendering a screen that queries it — is how a bad
   * restore turns into a crash loop with no way back to the safety snapshot.
   */
  const [interrupted, setInterrupted] = useState(() => detectInterruptedRestore() !== null);

  // Privacy mode's AppState listener + idle timer — registered once, here, and
  // inert while privacy mode is off.
  usePrivacyGuard();

  useEffect(() => {
    if (interrupted) return; // do not boot the db against a half-written file
    runMigrations();
    seedCategoriesIfEmpty(); // registry must exist before demo items reference it
    // seedDemoDataIfEmpty(); // self-gated on __DEV__ (DEMO_SEED_ENABLED): a no-op in prod
    setReady(true);
  }, [interrupted]);

  if (interrupted) {
    return (
      <SafeAreaProvider>
        <RestoreRecoveryScreen onResolved={() => setInterrupted(false)} />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          {/* Mounted only after the ready gate above, so the boot-time OTA check
              never runs before migrations/seed and never gates the splash. */}
          <UpdatesProvider>
            <RootNavigator />
          </UpdatesProvider>
          <StatusBar style="auto" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
