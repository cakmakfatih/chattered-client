import { useAuth } from '@clerk/expo';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAuthTransition } from '../AuthTransitionProvider';
import { ClerkAuthGate } from '../ClerkAuthGate';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('../AuthTransitionProvider', () => ({ useAuthTransition: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return { Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text> };
});

const authenticate = jest.fn();

function mockGate({ isLoaded = true, isSignedIn = false, isAuthenticating = false, isSigningOut = false } = {}) {
  jest.mocked(useAuth).mockReturnValue({ isLoaded, isSignedIn } as never);
  jest.mocked(useAuthTransition).mockReturnValue({ authenticate, isAuthenticating, isSigningOut, endSession: jest.fn() });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ClerkAuthGate', () => {
  it.each([
    ['Clerk is loading', { isLoaded: false }],
    ['hosted auth is running', { isAuthenticating: true }],
    ['the user is signing out', { isSigningOut: true }],
  ])('shows a loader while %s', async (_case, state) => {
    // Arrange
    mockGate(state);

    // Act
    await render(<ClerkAuthGate />);

    // Assert
    expect(screen.queryByText('Sohbete katıl')).toBeNull();
    expect(screen.queryByText(/redirect:/)).toBeNull();
  });

  it('redirects a signed-in user to the root route', async () => {
    // Arrange
    mockGate({ isSignedIn: true });

    // Act
    await render(<ClerkAuthGate />);

    // Assert
    expect(screen.getByText('redirect:/')).toBeOnTheScreen();
  });

  it.each([
    ['Sohbete katıl', 'sign-up'],
    ['Giriş yap', 'sign-in'],
  ])('starts hosted auth from %p in %p mode', async (label, mode) => {
    // Arrange
    mockGate();
    authenticate.mockResolvedValue(undefined);
    await render(<ClerkAuthGate />);

    // Act
    await fireEvent.press(screen.getByText(label));

    // Assert
    expect(authenticate).toHaveBeenCalledWith(mode);
  });

  it('alerts when hosted auth fails', async () => {
    // Arrange
    mockGate();
    authenticate.mockRejectedValue(new Error('cancelled'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<ClerkAuthGate />);

    // Act
    await fireEvent.press(screen.getByText('Sohbete katıl'));

    // Assert
    expect(alert).toHaveBeenCalledWith('Giriş açılamadı', 'Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.');
  });
});
