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
    expect(getOnboardingFieldErrors(apiError(code, field))).toEqual([{ field: expectedField, message }]);
  });

  it('ignores unknown fields and the retryable photo upload error', () => {
    expect(getOnboardingFieldErrors(apiError('validation_failed', 'unknown'))).toEqual([]);
    expect(getOnboardingFieldErrors(apiError('photo_upload_incomplete', 'photo'))).toEqual([]);
  });

  it('collects fields from every details shape', () => {
    const details = {
      fields: ['gender', 42],
      errors: [{ field: 'bio', code: 'invalid_bio' }, { code: 'no_field' }, null],
      field_errors: { username: ['taken'] },
    };

    expect(getOnboardingFieldErrors(apiError('validation_failed', undefined, details)).map(({ field }) => field))
      .toEqual(['gender', 'bio', 'username']);
  });

  it('ignores details that are not an object', () => {
    expect(getOnboardingFieldErrors(apiError('invalid_gender', undefined, 'details'))).toHaveLength(1);
  });
});

describe('getOnboardingActionMessage', () => {
  it.each([
    [apiError('photo_upload_incomplete'), 'Fotoğraf yüklemesi tamamlanmadı. Tekrar dene ya da fotoğrafı kaldır.'],
    [apiError(undefined, undefined, undefined, 409), 'Kayıt bu sırada değişti. Bilgilerini kontrol edip tekrar dene.'],
    [apiError(undefined, undefined, undefined, 401), 'Oturum doğrulanamadı. Yeniden giriş yapıp tekrar dene.'],
    [new Error('Bağlantı kesildi'), 'Bağlantı kesildi'],
    ['boom', 'İşlem tamamlanamadı. Tekrar dene.'],
  ])('returns the message for %p', (error, message) => {
    expect(getOnboardingActionMessage(error)).toBe(message);
  });
});
