import { useAuth, useClerk } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import type { HostedAuthMode } from '@clerk/expo/hosted-auth';
import { useState } from 'react';
import { Alert } from 'react-native';
import { LoadingView } from '../../components/LoadingView';
import { SignedInScreen } from '../../screens/SignedInScreen';
import { WelcomeScreen } from '../../screens/WelcomeScreen';

export function ClerkAuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
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

  if (isSignedIn) {
    return (
      <SignedInScreen
        onSignOut={() => { void signOut(); }}
      />
    );
  }

  return (
    <WelcomeScreen
      isBusy={authMode !== null}
      onSignUp={() => { void openAuth('sign-up'); }}
      onSignIn={() => { void openAuth('sign-in'); }}
    />
  );
}
