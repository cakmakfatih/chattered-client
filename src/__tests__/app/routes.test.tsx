import { useAuth } from '@clerk/expo';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CallbackRoute from '../../app/callback';
import HostedAuthCallbackRoute from '../../app/hosted-auth-callback';
import IndexRoute from '../../app/index';
import OnboardingRoute from '../../app/onboarding';
import WelcomeRoute from '../../app/welcome';
import ChatsRoute from '../../app/(tabs)/chats';
import ExploreRoute from '../../app/(tabs)/index';
import ProfileRoute from '../../app/(tabs)/profile';
import { useAuthTransition } from '../../features/auth/AuthTransitionProvider';
import { useRegistrationStatus } from '../../features/onboarding/RegistrationStatusProvider';
import { UserDirectoryScreen } from '../../screens/UserDirectoryScreen';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return { Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text> };
});
jest.mock('../../components/LoadingView', () => {
  const { Text } = require('react-native');
  return { LoadingView: () => <Text>loading</Text> };
});
jest.mock('../../screens/RegistrationStatusScreen', () => {
  const { Text } = require('react-native');
  return {
    RegistrationStatusScreen: ({ isUnauthorized, message }: { isUnauthorized: boolean; message: string }) => (
      <Text>{`status-error:${isUnauthorized}:${message}`}</Text>
    ),
  };
});
jest.mock('../../features/onboarding/RegistrationStatusProvider', () => ({ useRegistrationStatus: jest.fn() }));
jest.mock('../../features/auth/AuthTransitionProvider', () => ({ useAuthTransition: jest.fn() }));
jest.mock('../../features/onboarding/OnboardingWizard', () => {
  const { Text } = require('react-native');
  return { OnboardingWizard: () => <Text>onboarding-wizard</Text> };
});
jest.mock('../../features/auth/ClerkAuthGate', () => {
  const { Text } = require('react-native');
  return { ClerkAuthGate: () => <Text>clerk-auth-gate</Text> };
});
jest.mock('../../features/auth/HostedAuthCallback', () => {
  const { Text } = require('react-native');
  return { HostedAuthCallback: () => <Text>hosted-auth-callback</Text> };
});

const signedIn = { userId: 'user_1', sessionId: 'sess_1' };

function mockSession(auth: { isLoaded: boolean; isSignedIn?: boolean }, state: object = { status: 'loading', userId: null }) {
  jest.mocked(useAuth).mockReturnValue(auth as never);
  jest.mocked(useRegistrationStatus).mockReturnValue({ state, refresh: jest.fn(), markComplete: jest.fn() } as never);
}

describe('IndexRoute', () => {
  it.each([
    ['Clerk is loading', { isLoaded: false }, undefined, 'loading'],
    ['the user is signed out', { isLoaded: true, isSignedIn: false }, undefined, 'redirect:/welcome'],
    ['the registration is loading', { isLoaded: true, isSignedIn: true }, { status: 'loading', userId: 'user_1' }, 'loading'],
    ['the registration is incomplete', { isLoaded: true, isSignedIn: true }, { status: 'incomplete', ...signedIn }, 'redirect:/onboarding'],
    ['the registration is complete', { isLoaded: true, isSignedIn: true }, { status: 'complete', ...signedIn, profile: {} }, 'redirect:/(tabs)'],
    ['the state is not resolved yet', { isLoaded: true, isSignedIn: true }, { status: 'signed-out', userId: null }, 'loading'],
  ])('renders the right destination when %s', async (_case, auth, state, expected) => {
    mockSession(auth, state);

    await render(<IndexRoute />);

    expect(screen.getByText(expected)).toBeOnTheScreen();
  });

  it.each([
    [{ apiStatus: 500, errorCode: 'internal' }, false],
    [{ apiStatus: 401, errorCode: null }, true],
    [{ apiStatus: null, errorCode: 'unauthorized' }, true],
  ])('shows the status error screen for %p', async (error, isUnauthorized) => {
    mockSession({ isLoaded: true, isSignedIn: true }, { status: 'error', ...signedIn, message: 'Durum alınamadı.', ...error });

    await render(<IndexRoute />);

    expect(screen.getByText(`status-error:${isUnauthorized}:Durum alınamadı.`)).toBeOnTheScreen();
  });
});

describe('screen routes', () => {
  it.each([
    ['onboarding', OnboardingRoute, 'onboarding-wizard'],
    ['welcome', WelcomeRoute, 'clerk-auth-gate'],
    ['callback', CallbackRoute, 'hosted-auth-callback'],
    ['hosted-auth-callback', HostedAuthCallbackRoute, 'hosted-auth-callback'],
  ])('renders the %s feature screen', async (_route, Route, text) => {
    await render(<Route />);

    expect(screen.getByText(text)).toBeOnTheScreen();
  });

  it('uses the user directory as the explore tab', () => {
    expect(ExploreRoute).toBe(UserDirectoryScreen);
  });

  it('renders the chats placeholder', async () => {
    await render(<ChatsRoute />);

    expect(screen.getByText('Başlattığın anonim sohbetler burada görünecek.')).toBeOnTheScreen();
  });
});

describe('ProfileRoute', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs the user out', async () => {
    const endSession = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useAuthTransition).mockReturnValue({ endSession } as never);
    await render(<ProfileRoute />);

    await fireEvent.press(screen.getByText('Çıkış yap'));

    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it('alerts when signing out fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(useAuthTransition).mockReturnValue({ endSession: jest.fn().mockRejectedValue(new Error('offline')) } as never);
    await render(<ProfileRoute />);

    await fireEvent.press(screen.getByText('Çıkış yap'));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Çıkış yapılamadı', 'Lütfen tekrar deneyin.'));
  });
});
