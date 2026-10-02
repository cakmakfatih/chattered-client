import { useAuth } from '@clerk/expo';
import type { HostedAuthMode } from '@clerk/expo/hosted-auth';
import { Redirect } from 'expo-router';
import { Alert } from 'react-native';
import { LoadingView } from '../../components/LoadingView';
import { WelcomeScreen } from '../../screens/WelcomeScreen';
import { useAuthTransition } from './AuthTransitionProvider';

export function ClerkAuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const { authenticate, isAuthenticating, isSigningOut } = useAuthTransition();

  const openAuth = async (mode: HostedAuthMode) => {
    if (isAuthenticating || isSigningOut) return;
    try {
      await authenticate(mode);
    } catch {
      Alert.alert('Giriş açılamadı', 'Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.');
    }
  };

  if (!isLoaded || isAuthenticating || isSigningOut) return <LoadingView />;

  if (isSignedIn) return <Redirect href="/" />;

  return (
    <WelcomeScreen
      isBusy={isAuthenticating}
      onSignUp={() => { void openAuth('sign-up'); }}
      onSignIn={() => { void openAuth('sign-in'); }}
    />
  );
}
