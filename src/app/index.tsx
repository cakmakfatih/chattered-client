import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { LoadingView } from '../components/LoadingView';
import { useRegistrationStatus } from '../features/onboarding/RegistrationStatusProvider';
import { RegistrationStatusScreen } from '../screens/RegistrationStatusScreen';

export default function IndexRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const { state } = useRegistrationStatus();

  if (!isLoaded) return <LoadingView />;
  if (!isSignedIn) return <Redirect href="/welcome" />;
  if (state.status === 'loading') return <LoadingView />;
  if (state.status === 'error') {
    return (
      <RegistrationStatusScreen
        isUnauthorized={state.apiStatus === 401 || state.errorCode === 'unauthorized'}
        message={state.message}
      />
    );
  }
  if (state.status === 'incomplete') return <Redirect href="/onboarding" />;
  if (state.status === 'complete') return <Redirect href="/(tabs)" />;
  return <LoadingView />;
}
