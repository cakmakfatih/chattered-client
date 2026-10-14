import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  GoogleSansFlex_400Regular,
  GoogleSansFlex_500Medium,
  GoogleSansFlex_600SemiBold,
  GoogleSansFlex_700Bold,
  useFonts,
} from '@expo-google-fonts/google-sans-flex';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { LoadingView } from '../components/LoadingView';
import { MissingClerkKeyScreen } from '../screens/MissingClerkKeyScreen';
import { AuthTransitionProvider } from '../features/auth/AuthTransitionProvider';
import { RegistrationStatusProvider, useRegistrationStatus } from '../features/onboarding/RegistrationStatusProvider';

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const [fontsLoaded] = useFonts({
    GoogleSansRegular: GoogleSansFlex_400Regular,
    GoogleSansMedium: GoogleSansFlex_500Medium,
    GoogleSansSemiBold: GoogleSansFlex_600SemiBold,
    GoogleSansBold: GoogleSansFlex_700Bold,
  });

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      {!fontsLoaded ? <LoadingView /> : !publishableKey ? (
        <MissingClerkKeyScreen />
      ) : (
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <AuthTransitionProvider>
            <RegistrationStatusProvider>
              <RootNavigator />
            </RegistrationStatusProvider>
          </AuthTransitionProvider>
        </ClerkProvider>
      )}
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const { state } = useRegistrationStatus();

  if (!isLoaded) return <LoadingView />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="hosted-auth-callback" />
      <Stack.Screen name="callback" />
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && state.status === 'incomplete'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && state.status === 'complete'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
