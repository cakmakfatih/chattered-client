import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  GoogleSansFlex_400Regular,
  GoogleSansFlex_500Medium,
  GoogleSansFlex_600SemiBold,
  GoogleSansFlex_700Bold,
  useFonts,
} from '@expo-google-fonts/google-sans-flex';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ClerkAuthGate } from './src/features/auth/ClerkAuthGate';
import { LoadingView } from './src/components/LoadingView';
import { MissingClerkKeyScreen } from './src/screens/MissingClerkKeyScreen';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function App() {
  const [fontsLoaded] = useFonts({
    GoogleSansRegular: GoogleSansFlex_400Regular,
    GoogleSansMedium: GoogleSansFlex_500Medium,
    GoogleSansSemiBold: GoogleSansFlex_600SemiBold,
    GoogleSansBold: GoogleSansFlex_700Bold,
  });

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      {!fontsLoaded ? (
        <LoadingView />
      ) : publishableKey ? (
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ClerkAuthGate />
        </ClerkProvider>
      ) : (
        <MissingClerkKeyScreen />
      )}
    </SafeAreaProvider>
  );
}
