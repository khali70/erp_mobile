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

export default function App() {
  const [ready, setReady] = useState(false);

  // Privacy mode's AppState listener + idle timer — registered once, here, and
  // inert while privacy mode is off.
  usePrivacyGuard();

  useEffect(() => {
    runMigrations();
    seedCategoriesIfEmpty(); // registry must exist before demo items reference it
    seedDemoDataIfEmpty(); // self-gated on __DEV__ (DEMO_SEED_ENABLED): a no-op in prod
    setReady(true);
  }, []);

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
