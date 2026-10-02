import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { LoadingView } from '../../components/LoadingView';
import { useRegistrationStatus } from '../onboarding/RegistrationStatusProvider';
import { useAuthTransition } from './AuthTransitionProvider';

export function HostedAuthCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const { state } = useRegistrationStatus();
  const { isAuthenticating } = useAuthTransition();

  if (!isLoaded || isAuthenticating || state.status === 'loading') {
    return <LoadingView />;
  }

  if (!isSignedIn) return <Redirect href="/welcome" />;

  return <Redirect href="/" />;
}
