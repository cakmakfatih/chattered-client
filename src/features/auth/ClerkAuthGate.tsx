import { useAuth } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import type { HostedAuthMode } from '@clerk/expo/hosted-auth';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { LoadingView } from '../../components/LoadingView';
import { WelcomeScreen } from '../../screens/WelcomeScreen';

export function ClerkAuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const { startHostedAuth } = useHostedAuth();
  const [authMode, setAuthMode] = useState<HostedAuthMode | null>(null);

  const openAuth = async (mode: HostedAuthMode) => {
    if (authMode) return;
    setAuthMode(mode);
    try {
      await startHostedAuth({ mode });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lütfen bağlantınızı kontrol edip tekrar deneyin.';
      Alert.alert('Giriş açılamadı', message);
    } finally {
      setAuthMode(null);
    }
  };

  if (!isLoaded) return <LoadingView />;

  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return (
    <WelcomeScreen
      isBusy={authMode !== null}
      onSignUp={() => { void openAuth('sign-up'); }}
      onSignIn={() => { void openAuth('sign-in'); }}
    />
  );
}
