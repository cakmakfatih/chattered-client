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
  it('offers sign-up and sign-in', async () => {
    const onSignUp = jest.fn();
    const onSignIn = jest.fn();
    await render(<WelcomeScreen onSignUp={onSignUp} onSignIn={onSignIn} />);

    await fireEvent.press(screen.getByText('Sohbete katıl'));
    await fireEvent.press(screen.getByText('Giriş yap'));

    expect(screen.getByText('Anonim sohbet, gerçek bağlar.')).toBeOnTheScreen();
    expect(onSignUp).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('shows an error message', async () => {
    await render(<WelcomeScreen errorMessage="Bir sorun oluştu." onSignUp={jest.fn()} onSignIn={jest.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Bir sorun oluştu.');
  });

  it('disables both actions while busy', async () => {
    await render(<WelcomeScreen isBusy onSignUp={jest.fn()} onSignIn={jest.fn()} />);

    const [signUpButton, signInButton] = screen.getAllByRole('button');
    expect(signUpButton).toBeDisabled();
    expect(signInButton).toBeDisabled();
    expect(screen.queryByText('Sohbete katıl')).toBeNull();
  });
});

describe('SignedInScreen', () => {
  it('shows the empty chat state and signs out', async () => {
    const onSignOut = jest.fn();
    await render(<SignedInScreen onSignOut={onSignOut} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Çıkış yap' }));

    expect(screen.getByText('Henüz sohbetin yok')).toBeOnTheScreen();
    expect(onSignOut).toHaveBeenCalled();
  });
});

describe('MissingClerkKeyScreen', () => {
  it('explains how to configure the Clerk key', async () => {
    await render(<MissingClerkKeyScreen />);

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

  it('retries loading the registration status', async () => {
    mockStatusScreen();
    let finishRefresh: () => void = () => undefined;
    refresh.mockReturnValue(new Promise<void>((resolve) => { finishRefresh = resolve; }));
    await render(<RegistrationStatusScreen isUnauthorized={false} message="Sunucuya ulaşılamadı." />);

    expect(screen.getByText('Sunucuya ulaşılamadı.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Yeniden dene' }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBeDisabled();

    await act(async () => finishRefresh());
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('ends the session when the user is unauthorized', async () => {
    mockStatusScreen();
    endSession.mockResolvedValue(undefined);
    await render(<RegistrationStatusScreen isUnauthorized message="Oturum doğrulanamadı." />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar giriş yap' }));

    expect(endSession).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows an error when signing out fails', async () => {
    mockStatusScreen();
    endSession.mockRejectedValue(new Error('offline'));
    await render(<RegistrationStatusScreen isUnauthorized message="Oturum doğrulanamadı." />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar giriş yap' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Oturum kapatılamadı. Lütfen tekrar deneyin.');
  });

  it('is disabled while signing out', async () => {
    mockStatusScreen(true);
    await render(<RegistrationStatusScreen isUnauthorized message="Oturum doğrulanamadı." />);

    await fireEvent.press(screen.getByRole('button'));

    expect(screen.getByRole('button')).toBeDisabled();
    expect(endSession).not.toHaveBeenCalled();
  });
});
