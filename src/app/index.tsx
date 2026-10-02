import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { LoadingView } from '../components/LoadingView';

export default function IndexRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <LoadingView />;

  return <Redirect href={isSignedIn ? '/(tabs)' : '/welcome'} />;
}
