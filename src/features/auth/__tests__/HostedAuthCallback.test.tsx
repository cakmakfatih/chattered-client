import { useAuth } from '@clerk/expo';
import { render, screen } from '@testing-library/react-native';
import { useRegistrationStatus } from '../../onboarding/RegistrationStatusProvider';
import { useAuthTransition } from '../AuthTransitionProvider';
import { HostedAuthCallback } from '../HostedAuthCallback';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('../AuthTransitionProvider', () => ({ useAuthTransition: jest.fn() }));
jest.mock('../../onboarding/RegistrationStatusProvider', () => ({ useRegistrationStatus: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return { Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text> };
});

function mockCallbackState({ isLoaded = true, isSignedIn = true, isAuthenticating = false, status = 'incomplete' } = {}) {
  jest.mocked(useAuth).mockReturnValue({ isLoaded, isSignedIn } as never);
  jest.mocked(useAuthTransition).mockReturnValue({ isAuthenticating } as never);
  jest.mocked(useRegistrationStatus).mockReturnValue({ state: { status } } as never);
}

describe('HostedAuthCallback', () => {
  it.each([
    ['Clerk is loading', { isLoaded: false }],
    ['hosted auth is still finishing', { isAuthenticating: true }],
    ['the registration status is loading', { status: 'loading' }],
  ])('waits while %s', async (_case, state) => {
    // Arrange
    mockCallbackState(state);

    // Act
    await render(<HostedAuthCallback />);

    // Assert
    expect(screen.queryByText(/redirect:/)).toBeNull();
  });

  it('returns a signed-out user to the welcome screen', async () => {
    // Arrange
    mockCallbackState({ isSignedIn: false, status: 'signed-out' });

    // Act
    await render(<HostedAuthCallback />);

    // Assert
    expect(screen.getByText('redirect:/welcome')).toBeOnTheScreen();
  });

  it('sends a signed-in user to the root route', async () => {
    // Arrange
    mockCallbackState();

    // Act
    await render(<HostedAuthCallback />);

    // Assert
    expect(screen.getByText('redirect:/')).toBeOnTheScreen();
  });
});
