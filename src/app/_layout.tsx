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

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout() {
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
          <RootNavigator />
        </ClerkProvider>
      )}
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <LoadingView />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
