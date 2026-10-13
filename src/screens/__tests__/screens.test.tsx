import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuthTransition } from '../../features/auth/AuthTransitionProvider';
import { useRegistrationStatus } from '../../features/onboarding/RegistrationStatusProvider';
import { MissingClerkKeyScreen } from '../MissingClerkKeyScreen';
import { RegistrationStatusScreen } from '../RegistrationStatusScreen';
import { SignedInScreen } from '../SignedInScreen';
import { WelcomeScreen } from '../WelcomeScreen';

jest.mock('../../features/auth/AuthTransitionProvider', () => ({ useAuthTransition: jest.fn() }));
jest.mock('../../features/onboarding/RegistrationStatusProvider', () => ({ useRegistrationStatus: jest.fn() }));

describe('WelcomeScreen', () => {
  it('shows the tagline', async () => {
    // Arrange
    const welcomeScreen = <WelcomeScreen onSignUp={jest.fn()} onSignIn={jest.fn()} />;

    // Act
    await render(welcomeScreen);

    // Assert
    expect(screen.getByText('Anonim sohbet, gerçek bağlar.')).toBeOnTheScreen();
  });

  it('starts sign-up from the join button', async () => {
    // Arrange
    const onSignUp = jest.fn();
    await render(<WelcomeScreen onSignUp={onSignUp} onSignIn={jest.fn()} />);

    // Act
    await fireEvent.press(screen.getByText('Sohbete katıl'));

    // Assert
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it('starts sign-in from the sign-in button', async () => {
    // Arrange
    const onSignIn = jest.fn();
    await render(<WelcomeScreen onSignUp={jest.fn()} onSignIn={onSignIn} />);

    // Act
    await fireEvent.press(screen.getByText('Giriş yap'));

    // Assert
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('shows an error message', async () => {
    // Arrange
    const errorMessage = 'Bir sorun oluştu.';

    // Act
    await render(<WelcomeScreen errorMessage={errorMessage} onSignUp={jest.fn()} onSignIn={jest.fn()} />);

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Bir sorun oluştu.');
  });

  it('disables both actions while busy', async () => {
    // Arrange
    const isBusy = true;

    // Act
    await render(<WelcomeScreen isBusy={isBusy} onSignUp={jest.fn()} onSignIn={jest.fn()} />);

    // Assert
    const [signUpButton, signInButton] = screen.getAllByRole('button');
    expect(signUpButton).toBeDisabled();
    expect(signInButton).toBeDisabled();
    expect(screen.queryByText('Sohbete katıl')).toBeNull();
  });
});

describe('SignedInScreen', () => {
  it('shows the empty chat state', async () => {
    // Arrange
    const signedInScreen = <SignedInScreen onSignOut={jest.fn()} />;

    // Act
    await render(signedInScreen);

    // Assert
    expect(screen.getByText('Henüz sohbetin yok')).toBeOnTheScreen();
  });

  it('signs out from the sign-out button', async () => {
    // Arrange
    const onSignOut = jest.fn();
    await render(<SignedInScreen onSignOut={onSignOut} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Çıkış yap' }));

    // Assert
    expect(onSignOut).toHaveBeenCalled();
  });
});

describe('MissingClerkKeyScreen', () => {
  it('explains how to configure the Clerk key', async () => {
    // Arrange
    const missingKeyScreen = <MissingClerkKeyScreen />;

    // Act
    await render(missingKeyScreen);

    // Assert
    expect(screen.getByText('Clerk yapılandırması eksik')).toBeOnTheScreen();
    expect(screen.getByText(/publishable key/)).toBeOnTheScreen();
  });
});

describe('RegistrationStatusScreen', () => {
  const refresh = jest.fn();
  const endSession = jest.fn();

  function mockStatusScreen(isSigningOut = false) {
    jest.mocked(useRegistrationStatus).mockReturnValue({ refresh, markComplete: jest.fn(), state: { status: 'loading', userId: null } });
    jest.mocked(useAuthTransition).mockReturnValue({ endSession, isSigningOut, isAuthenticating: false, authenticate: jest.fn() });
  }

  function mockPendingRefresh() {
    const pending = { finish: () => undefined as void };
    refresh.mockReturnValue(new Promise<void>((resolve) => { pending.finish = resolve; }));
    return pending;
  }

  it('shows the status message', async () => {
    // Arrange
    mockStatusScreen();

    // Act
    await render(<RegistrationStatusScreen isUnauthorized={false} message="Sunucuya ulaşılamadı." />);

    // Assert
    expect(screen.getByText('Sunucuya ulaşılamadı.')).toBeOnTheScreen();
  });

  it('retries loading the registration status and disables the button meanwhile', async () => {
    // Arrange
    mockStatusScreen();
    mockPendingRefresh();
    await render(<RegistrationStatusScreen isUnauthorized={false} message="Sunucuya ulaşılamadı." />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Yeniden dene' }));

    // Assert
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('enables the retry button again once the refresh finishes', async () => {
    // Arrange
    mockStatusScreen();
    const pendingRefresh = mockPendingRefresh();
    await render(<RegistrationStatusScreen isUnauthorized={false} message="Sunucuya ulaşılamadı." />);
    await fireEvent.press(screen.getByRole('button', { name: 'Yeniden dene' }));

    // Act
    await act(async () => pendingRefresh.finish());

    // Assert
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('ends the session when the user is unauthorized', async () => {
    // Arrange
    mockStatusScreen();
    endSession.mockResolvedValue(undefined);
    await render(<RegistrationStatusScreen isUnauthorized message="Oturum doğrulanamadı." />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar giriş yap' }));

    // Assert
    expect(endSession).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows an error when signing out fails', async () => {
    // Arrange
    mockStatusScreen();
    endSession.mockRejectedValue(new Error('offline'));
    await render(<RegistrationStatusScreen isUnauthorized message="Oturum doğrulanamadı." />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar giriş yap' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Oturum kapatılamadı. Lütfen tekrar deneyin.');
  });

  it('is disabled while signing out', async () => {
    // Arrange
    mockStatusScreen(true);
    await render(<RegistrationStatusScreen isUnauthorized message="Oturum doğrulanamadı." />);

    // Act
    await fireEvent.press(screen.getByRole('button'));

    // Assert
    expect(screen.getByRole('button')).toBeDisabled();
    expect(endSession).not.toHaveBeenCalled();
  });
});
