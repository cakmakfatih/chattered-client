import { ApiRequestError } from '../api';
import { getOnboardingActionMessage, getOnboardingFieldErrors } from '../onboardingApiErrors';

jest.mock('expo-file-system', () => ({ File: jest.fn(), UploadType: {} }));

function apiError(code?: string, field?: string, details?: unknown, status = 422) {
  return new ApiRequestError('Sunucu hatası', status, code, field, details);
}

describe('getOnboardingFieldErrors', () => {
  it.each([
    ['username_taken', undefined, 'username', 'Bu kullanıcı adı az önce alınmış. Başka bir ad seç.'],
    ['invalid_username', undefined, 'username', 'Kullanıcı adı 3–15 karakter olmalı; küçük harfle başlamalı, yalnızca küçük harf, rakam ve alt çizgi kullanılmalı.'],
    ['invalid_gender', undefined, 'gender', 'Bir cinsiyet seçeneği belirle.'],
    ['invalid_bio', undefined, 'bio', 'Biyografi biçimini kontrol et. En fazla 300 karakter kullanabilirsin.'],
    ['invalid_photo', 'photo.size_bytes', 'photo', 'Fotoğraf en fazla 10 MiB olabilir.'],
    ['invalid_photo', 'photo.content_type', 'photo', 'Fotoğraf JPG, PNG veya HEIC olmalı ve dosya bilgileri eşleşmeli.'],
    ['other', 'photo.width', 'photo', 'Fotoğraf bilgileri geçerli değil.'],
    ['other', 'bio', 'bio', 'Bu alanı kontrol edip tekrar dene.'],
  ])('maps code %s on field %s to %s', (code, field, expectedField, message) => {
    // Arrange
    const error = apiError(code, field);

    // Act
    const fieldErrors = getOnboardingFieldErrors(error);

    // Assert
    expect(fieldErrors).toEqual([{ field: expectedField, message }]);
  });

  it.each([
    ['an unknown field', apiError('validation_failed', 'unknown')],
    ['the retryable photo upload error', apiError('photo_upload_incomplete', 'photo')],
  ])('ignores %s', (_case, error) => {
    // Arrange
    const input = error;

    // Act
    const fieldErrors = getOnboardingFieldErrors(input);

    // Assert
    expect(fieldErrors).toEqual([]);
  });

  it('collects fields from every details shape', () => {
    // Arrange
    const details = {
      fields: ['gender', 42],
      errors: [{ field: 'bio', code: 'invalid_bio' }, { code: 'no_field' }, null],
      field_errors: { username: ['taken'] },
    };
    const error = apiError('validation_failed', undefined, details);

    // Act
    const fieldErrors = getOnboardingFieldErrors(error);

    // Assert
    expect(fieldErrors.map(({ field }) => field)).toEqual(['gender', 'bio', 'username']);
  });

  it('ignores details that are not an object', () => {
    // Arrange
    const error = apiError('invalid_gender', undefined, 'details');

    // Act
    const fieldErrors = getOnboardingFieldErrors(error);

    // Assert
    expect(fieldErrors).toHaveLength(1);
  });
});

describe('getOnboardingActionMessage', () => {
  it.each([
    [apiError('photo_upload_incomplete'), 'Fotoğraf yüklemesi tamamlanmadı. Tekrar dene ya da fotoğrafı kaldır.'],
    [apiError(undefined, undefined, undefined, 409), 'Kayıt bu sırada değişti. Bilgilerini kontrol edip tekrar dene.'],
    [apiError(undefined, undefined, undefined, 401), 'Oturum doğrulanamadı. Yeniden giriş yapıp tekrar dene.'],
    [new Error('Bağlantı kesildi'), 'Bağlantı kesildi'],
    ['boom', 'İşlem tamamlanamadı. Tekrar dene.'],
  ])('returns the message for %p', (error, expectedMessage) => {
    // Arrange
    const input = error;

    // Act
    const message = getOnboardingActionMessage(input);

    // Assert
    expect(message).toBe(expectedMessage);
  });
});
