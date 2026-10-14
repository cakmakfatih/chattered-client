import { useAuth } from '@clerk/expo';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuthTransition } from '../../auth/AuthTransitionProvider';
import { ApiRequestError, completeRegistration, uploadProfilePhoto, validateBiography, validatePhoto } from '../api';
import { OnboardingWizard } from '../OnboardingWizard';
import { useRegistrationStatus } from '../RegistrationStatusProvider';
import type { SelectedPhoto } from '../types';
import { useUsernameAvailability } from '../useUsernameAvailability';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../../auth/AuthTransitionProvider', () => ({ useAuthTransition: jest.fn() }));
jest.mock('../RegistrationStatusProvider', () => ({ useRegistrationStatus: jest.fn() }));
jest.mock('../useUsernameAvailability', () => ({
  ...jest.requireActual('../useUsernameAvailability'),
  useUsernameAvailability: jest.fn(),
}));
jest.mock('../api', () => ({
  ApiRequestError: jest.requireActual('../api').ApiRequestError,
  completeRegistration: jest.fn(),
  uploadProfilePhoto: jest.fn(),
  validateBiography: jest.fn(),
  validatePhoto: jest.fn(),
}));
jest.mock('../PhotoStep', () => ({ PhotoStep: mockPhotoStep }));

const mockSquarePhoto: SelectedPhoto = {
  uri: 'file:///cropped.jpg',
  width: 1024,
  height: 1024,
  file_name: 'profile-photo.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 200_000,
};
const profile = { username: 'maviay', gender: 'female' as const, bio: null };
const stepTitles = ['Bir kullanıcı adı seç', 'Cinsiyetin', 'Biraz kendinden bahset', 'Bir fotoğraf ekle', 'Her şey hazır'];

/** Stand-in for the photo step, which has its own suite; it exposes the callbacks the wizard wires up. */
function mockPhotoStep({ errorMessage, onChange, onPhotoRejected }: {
  errorMessage?: string;
  onChange: (photo: SelectedPhoto | null) => void;
  onPhotoRejected: (message: string) => void;
}) {
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={() => onChange(mockSquarePhoto)}><Text>Kare fotoğraf seç</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => onChange({ ...mockSquarePhoto, height: 800 })}><Text>Dikdörtgen fotoğraf seç</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => onChange({ ...mockSquarePhoto, mime_type: 'image/gif' })}><Text>Geçersiz fotoğraf seç</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => onPhotoRejected('Fotoğraf çok küçük.')}><Text>Küçük fotoğraf seç</Text></Pressable>
      {errorMessage ? <Text>{errorMessage}</Text> : null}
    </View>
  );
}

const authTransition = { endSession: jest.fn(), isSigningOut: false, isAuthenticating: false, authenticate: jest.fn() };
const registrationStatus = { markComplete: jest.fn(), refresh: jest.fn() };
const getToken = jest.fn();

async function finishTransition() {
  await act(async () => { jest.runAllTimers(); });
}

function getPrimaryButton() {
  return screen.getByRole('button', { name: /Devam et|Hesabı oluştur|Kontrol ediliyor…|Fotoğraf yükleniyor…/ });
}

async function pressPrimary() {
  await fireEvent.press(getPrimaryButton());
  await finishTransition();
}

async function renderWizardAtStep(step: number, options: { selectPhoto?: string } = {}) {
  await render(<OnboardingWizard />);
  if (step === 0) return;
  await fireEvent.changeText(screen.getByLabelText('Kullanıcı adı'), 'maviay');
  await pressPrimary();
  if (step === 1) return;
  await fireEvent.press(screen.getByRole('radio', { name: /Kadın/ }));
  await pressPrimary();
  if (step === 2) return;
  await pressPrimary();
  if (step === 3) return;
  if (options.selectPhoto) await fireEvent.press(screen.getByText(options.selectPhoto));
  await pressPrimary();
}

function expectStep(step: number) {
  expect(screen.getByText(stepTitles[step])).toBeOnTheScreen();
  expect(screen.getByText(`Adım ${step + 1} / 5`)).toBeOnTheScreen();
}

beforeEach(() => {
  jest.useFakeTimers();
  Object.assign(authTransition, { endSession: jest.fn().mockResolvedValue(undefined), isSigningOut: false });
  Object.assign(registrationStatus, { markComplete: jest.fn(), refresh: jest.fn() });
  getToken.mockResolvedValue('session-token');
  jest.mocked(useAuth).mockReturnValue({ getToken } as never);
  jest.mocked(useAuthTransition).mockImplementation(() => authTransition);
  jest.mocked(useRegistrationStatus).mockImplementation(() => registrationStatus as never);
  jest.mocked(useUsernameAvailability).mockReturnValue({ status: 'available', message: undefined, retry: jest.fn() });
  jest.mocked(validateBiography).mockResolvedValue(undefined);
  jest.mocked(validatePhoto).mockResolvedValue(undefined);
  jest.mocked(uploadProfilePhoto).mockResolvedValue(undefined);
  jest.mocked(completeRegistration).mockResolvedValue({ registration_complete: true, user: profile });
});

afterEach(() => {
  jest.useRealTimers();
});

async function pressButtonAndSettle(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
  await finishTransition();
}

function pendingRequest() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((onResolve) => { resolve = onResolve; });
  return { promise, resolve };
}

async function resolveRequest(request: { resolve: () => void }) {
  await act(async () => request.resolve());
  await finishTransition();
}

describe('OnboardingWizard navigation', () => {
  it('starts at the username step', async () => {
    // Arrange
    const wizard = <OnboardingWizard />;

    // Act
    await render(wizard);

    // Assert
    expectStep(0);
    expect(screen.getByLabelText('Kayıt adımı 1 / 5')).toBeOnTheScreen();
  });

  it('checks the username availability on the username step', async () => {
    // Arrange
    const wizard = <OnboardingWizard />;

    // Act
    await render(wizard);

    // Assert
    expect(jest.mocked(useUsernameAvailability).mock.lastCall?.[2]).toBe(true);
  });

  it('stops checking the username availability after the username step', async () => {
    // Arrange
    await renderWizardAtStep(0);
    await fireEvent.changeText(screen.getByLabelText('Kullanıcı adı'), 'maviay');

    // Act
    await pressPrimary();

    // Assert
    expect(jest.mocked(useUsernameAvailability).mock.lastCall?.[2]).toBe(false);
  });

  it('waits for an available username before continuing', async () => {
    // Arrange
    jest.mocked(useUsernameAvailability).mockReturnValue({ status: 'checking', message: undefined, retry: jest.fn() });

    // Act
    await renderWizardAtStep(0);

    // Assert
    expect(getPrimaryButton()).toBeDisabled();
  });

  it('shows the local username format error', async () => {
    // Arrange
    await renderWizardAtStep(0);

    // Act
    await fireEvent.changeText(screen.getByLabelText('Kullanıcı adı'), 'ab');

    // Assert
    expect(screen.getByText('Kullanıcı adı en az 3 karakter olmalı.')).toBeOnTheScreen();
  });

  it('moves to the gender step and requires a choice', async () => {
    // Arrange
    await renderWizardAtStep(0);
    await fireEvent.changeText(screen.getByLabelText('Kullanıcı adı'), 'maviay');

    // Act
    await pressPrimary();

    // Assert
    expectStep(1);
    expect(getPrimaryButton()).toBeDisabled();
  });

  it('goes back one step at a time', async () => {
    // Arrange
    await renderWizardAtStep(2);

    // Act
    await pressButtonAndSettle('Geri');

    // Assert
    expectStep(1);
    expect(authTransition.endSession).not.toHaveBeenCalled();
  });

  it('ends the session when going back from the first step', async () => {
    // Arrange
    await renderWizardAtStep(0);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Geri' }));

    // Assert
    expect(authTransition.endSession).toHaveBeenCalledTimes(1);
  });

  it('reports a failed sign out', async () => {
    // Arrange
    authTransition.endSession.mockRejectedValue(new Error('offline'));
    await renderWizardAtStep(0);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Geri' }));

    // Assert
    expect(await screen.findByText('Oturum kapatılamadı. Tekrar dene.')).toBeOnTheScreen();
  });

  it('locks both actions while signing out', async () => {
    // Arrange
    authTransition.isSigningOut = true;

    // Act
    await renderWizardAtStep(0);

    // Assert
    expect(screen.getByRole('button', { name: 'Çıkılıyor…' })).toBeDisabled();
    expect(getPrimaryButton()).toBeDisabled();
  });

  it('jumps from the review to the edited step and keeps its value', async () => {
    // Arrange
    await renderWizardAtStep(4);

    // Act
    await pressButtonAndSettle('Cinsiyet bilgisini düzenle');

    // Assert
    expectStep(1);
    expect(screen.getByRole('radio', { name: /Kadın/ })).toBeChecked();
  });
});

describe('OnboardingWizard step validation', () => {
  it('validates the bio before continuing', async () => {
    // Arrange
    await renderWizardAtStep(2);
    await fireEvent.changeText(screen.getByLabelText('Biyografi'), 'Merhaba');

    // Act
    await pressPrimary();

    // Assert
    expect(validateBiography).toHaveBeenCalledWith('Merhaba', expect.any(Function));
    expectStep(3);
  });

  it('gives the bio validation access to the session token', async () => {
    // Arrange
    await renderWizardAtStep(2);
    await pressPrimary();
    const getSessionToken = jest.mocked(validateBiography).mock.calls[0][1];

    // Act
    const token = getSessionToken();

    // Assert
    await expect(token).resolves.toBe('session-token');
  });

  it('keeps the user on the bio step when the server rejects it', async () => {
    // Arrange
    jest.mocked(validateBiography).mockRejectedValue(new ApiRequestError('invalid', 422, 'invalid_bio', 'bio'));
    await renderWizardAtStep(2);

    // Act
    await pressPrimary();

    // Assert
    expectStep(2);
    expect(screen.getByText('Biyografi biçimini kontrol et. En fazla 300 karakter kullanabilirsin.')).toBeOnTheScreen();
    expect(getPrimaryButton()).toBeDisabled();
  });

  it('clears a field error once the field is edited', async () => {
    // Arrange
    jest.mocked(validateBiography).mockRejectedValueOnce(new ApiRequestError('invalid', 422, 'invalid_bio', 'bio'));
    await renderWizardAtStep(2);
    await pressPrimary();

    // Act
    await fireEvent.changeText(screen.getByLabelText('Biyografi'), 'Yeni');

    // Assert
    expect(getPrimaryButton()).toBeEnabled();
  });

  it('shows a general error when validation fails without a field', async () => {
    // Arrange
    jest.mocked(validateBiography).mockRejectedValue(new ApiRequestError('Sunucuya ulaşılamadı.', 0, 'network_error'));
    await renderWizardAtStep(2);

    // Act
    await pressPrimary();

    // Assert
    expect(screen.getByText('Sunucuya ulaşılamadı.')).toBeOnTheScreen();
    expect(getPrimaryButton()).toBeEnabled();
  });

  it('shows progress while a step is being validated', async () => {
    // Arrange
    jest.mocked(validateBiography).mockReturnValue(pendingRequest().promise);
    await renderWizardAtStep(2);

    // Act
    await fireEvent.press(getPrimaryButton());

    // Assert
    expect(getPrimaryButton()).toHaveTextContent('Kontrol ediliyor…');
    expect(getPrimaryButton()).toBeDisabled();
  });

  it('continues once the pending validation succeeds', async () => {
    // Arrange
    const validation = pendingRequest();
    jest.mocked(validateBiography).mockReturnValue(validation.promise);
    await renderWizardAtStep(2);
    await fireEvent.press(getPrimaryButton());

    // Act
    await resolveRequest(validation);

    // Assert
    expectStep(3);
  });

  it('validates the selected photo metadata', async () => {
    // Arrange
    await renderWizardAtStep(3);
    await fireEvent.press(screen.getByText('Kare fotoğraf seç'));

    // Act
    await pressPrimary();

    // Assert
    expect(validatePhoto).toHaveBeenCalledWith(
      { file_name: 'profile-photo.jpg', mime_type: 'image/jpeg', size_bytes: 200_000 },
      expect.any(Function),
    );
    expectStep(4);
  });

  it('allows skipping the photo', async () => {
    // Arrange
    await renderWizardAtStep(3);

    // Act
    await pressPrimary();

    // Assert
    expect(validatePhoto).toHaveBeenCalledWith(null, expect.any(Function));
    expectStep(4);
  });

  it.each(['Geçersiz fotoğraf seç', 'Dikdörtgen fotoğraf seç'])('blocks a photo chosen with %p', async (choice) => {
    // Arrange
    await renderWizardAtStep(3);

    // Act
    await fireEvent.press(screen.getByText(choice));

    // Assert
    expect(getPrimaryButton()).toBeDisabled();
  });

  it('shows rejected photos in a snackbar', async () => {
    // Arrange
    await renderWizardAtStep(3);

    // Act
    await fireEvent.press(screen.getByText('Küçük fotoğraf seç'));

    // Assert
    expect(screen.getByText('Fotoğraf çok küçük.')).toBeOnTheScreen();
  });
});

describe('OnboardingWizard registration', () => {
  it('summarises the profile on the review step before creating the account', async () => {
    // Arrange
    await renderWizardAtStep(3);

    // Act
    await pressPrimary();

    // Assert
    expectStep(4);
    expect(getPrimaryButton()).toHaveTextContent('Hesabı oluştur');
    expect(screen.getByText('@maviay')).toBeOnTheScreen();
  });

  it('creates the profile without a photo and opens the home route', async () => {
    // Arrange
    await renderWizardAtStep(4);

    // Act
    await pressPrimary();

    // Assert
    expect(uploadProfilePhoto).not.toHaveBeenCalled();
    expect(completeRegistration).toHaveBeenCalledWith(
      { username: 'maviay', gender: 'female', bio: null, photo: null },
      expect.any(Function),
    );
    expect(registrationStatus.markComplete).toHaveBeenCalledWith(profile);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('uploads the photo before completing the registration', async () => {
    // Arrange
    jest.mocked(uploadProfilePhoto).mockReturnValue(pendingRequest().promise);
    await renderWizardAtStep(4, { selectPhoto: 'Kare fotoğraf seç' });

    // Act
    await fireEvent.press(getPrimaryButton());

    // Assert
    expect(uploadProfilePhoto).toHaveBeenCalledWith(mockSquarePhoto, expect.any(Function));
    expect(getPrimaryButton()).toHaveTextContent('Fotoğraf yükleniyor…');
    expect(completeRegistration).not.toHaveBeenCalled();
  });

  it('completes the registration with the uploaded photo metadata', async () => {
    // Arrange
    const upload = pendingRequest();
    jest.mocked(uploadProfilePhoto).mockReturnValue(upload.promise);
    await renderWizardAtStep(4, { selectPhoto: 'Kare fotoğraf seç' });
    await fireEvent.press(getPrimaryButton());

    // Act
    await resolveRequest(upload);

    // Assert
    expect(jest.mocked(completeRegistration).mock.calls[0][0].photo).toEqual({
      file_name: 'profile-photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 200_000,
    });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('rejects an incomplete registration response', async () => {
    // Arrange
    jest.mocked(completeRegistration).mockResolvedValue({ registration_complete: false, user: null });
    await renderWizardAtStep(4);

    // Act
    await pressPrimary();

    // Assert
    expect(screen.getByText('Kayıt tamamlandı yanıtı geçersiz. Ana ekrana geçiş engellendi.')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('continues when the profile was already completed', async () => {
    // Arrange
    const existingProfile = { username: 'maviay', gender: 'female' as const, bio: 'Merhaba' };
    jest.mocked(completeRegistration).mockRejectedValue(new ApiRequestError('done', 409, 'profile_already_complete'));
    registrationStatus.refresh.mockResolvedValue({ status: 'complete', profile: existingProfile });
    await renderWizardAtStep(4);

    // Act
    await pressPrimary();

    // Assert
    expect(registrationStatus.markComplete).toHaveBeenCalledWith(existingProfile);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('reports a completed profile that cannot be confirmed', async () => {
    // Arrange
    jest.mocked(completeRegistration).mockRejectedValue(new ApiRequestError('done', 409, 'profile_already_complete'));
    registrationStatus.refresh.mockResolvedValue({ status: 'error', message: 'offline', isUnauthorized: false });
    await renderWizardAtStep(4);

    // Act
    await pressPrimary();

    // Assert
    expect(screen.getByText('Kayıt bu sırada değişti. Bilgilerini kontrol edip tekrar dene.')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ['an incomplete photo upload', new ApiRequestError('missing', 409, 'photo_upload_incomplete', 'photo'), 'Fotoğraf yüklemesi tamamlanmadı. Tekrar dene ya da fotoğrafı kaldır.'],
    ['a registration conflict', new ApiRequestError('conflict', 409, 'conflict'), 'Kayıt bu sırada değişti. Bilgilerini kontrol edip tekrar dene.'],
    ['an expired session', new ApiRequestError('expired', 401, 'unauthorized'), 'Oturum doğrulanamadı. Yeniden giriş yapıp tekrar dene.'],
    ['a server error', new ApiRequestError('Sunucu hatası.', 500, 'internal'), 'Sunucu hatası.'],
    ['an unexpected failure', 'boom', 'İşlem tamamlanamadı. Tekrar dene.'],
  ])('shows an action error for %s', async (_case, error, message) => {
    // Arrange
    jest.mocked(completeRegistration).mockRejectedValue(error);
    await renderWizardAtStep(4);

    // Act
    await pressPrimary();

    // Assert
    expectStep(4);
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(screen.getByTestId('icon-AlertCircle')).toBeOnTheScreen();
  });

  it.each([
    ['a taken username', new ApiRequestError('taken', 409, 'username_taken'), 0, 'Bu kullanıcı adı az önce alınmış. Başka bir ad seç.'],
    ['an invalid username', new ApiRequestError('bad', 422, 'invalid_username'), 0, 'Kullanıcı adı 3–15 karakter olmalı; küçük harfle başlamalı, yalnızca küçük harf, rakam ve alt çizgi kullanılmalı.'],
    ['an unknown username code', new ApiRequestError('bad', 422, 'validation_failed', 'username'), 0, 'Bu alanı kontrol edip tekrar dene.'],
    ['an invalid gender', new ApiRequestError('bad', 422, 'invalid_gender'), 1, 'Bir cinsiyet seçeneği belirle.'],
    ['a large photo', new ApiRequestError('bad', 422, 'invalid_photo', 'photo.size_bytes'), 3, 'Fotoğraf en fazla 10 MiB olabilir.'],
    ['an invalid photo', new ApiRequestError('bad', 422, 'invalid_photo'), 3, 'Fotoğraf JPG, PNG veya HEIC olmalı ve dosya bilgileri eşleşmeli.'],
    ['a photo detail field', new ApiRequestError('bad', 422, 'validation_failed', undefined, { field_errors: { 'photo.mime_type': 'bad' } }), 3, 'Fotoğraf bilgileri geçerli değil.'],
    ['detail errors', new ApiRequestError('bad', 422, 'validation_failed', undefined, { errors: [{ field: 'bio', code: 'invalid_bio' }, { field: 'gender', code: 'invalid_gender' }, 'ignored'] }), 1, 'Bir cinsiyet seçeneği belirle.'],
    ['detail field names', new ApiRequestError('bad', 422, 'validation_failed', undefined, { fields: ['bio', 42] }), 2, 'Bu alanı kontrol edip tekrar dene.'],
  ])('returns to the first invalid field for %s', async (_case, error, step, message) => {
    // Arrange
    jest.mocked(completeRegistration).mockRejectedValue(error);
    await renderWizardAtStep(4);

    // Act
    await pressPrimary();

    // Assert
    expectStep(step);
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(screen.queryByTestId('icon-AlertCircle')).toBeNull();
  });
});
