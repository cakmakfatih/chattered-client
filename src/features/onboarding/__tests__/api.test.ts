import { File, UploadType } from 'expo-file-system';
import {
  ApiRequestError,
  checkUsernameAvailability,
  completeRegistration,
  getRegistrationStatus,
  uploadProfilePhoto,
  validateBiography,
  validatePhoto,
} from '../api';
import type { SelectedPhoto } from '../types';

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
}));

const apiUrl = 'https://api.chattered.test/api/v1';
const getToken = jest.fn<Promise<string | null>, []>();
const fetchMock = jest.fn();
const uploadMock = jest.fn();
const completeProfile = { username: 'maviay', gender: 'female', bio: null } as const;
const selectedPhoto: SelectedPhoto = {
  uri: 'file:///cache/profile-photo.jpg',
  width: 1024,
  height: 1024,
  file_name: 'profile-photo.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 240_000,
};
const uploadAuthorization = {
  upload_url: 'https://storage.chattered.test/photo?signature=abc',
  method: 'PUT',
  expires_at: '2026-10-13T10:10:00Z',
  headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '240000' },
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) };
}

function abortableFetch(_url: string, init: { signal: AbortSignal }) {
  return new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
}

async function captureError(promise: Promise<unknown>): Promise<ApiRequestError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiRequestError;
  }
  throw new Error('Expected the promise to reject.');
}

beforeEach(() => {
  getToken.mockResolvedValue('session-token');
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  jest.mocked(File).mockImplementation(() => ({ upload: uploadMock }) as never);
});

afterEach(() => {
  jest.useRealTimers();
});


describe('request handling', () => {
  it('sends an authenticated GET without a body', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, { registration_complete: false, user: null }));

    // Act
    await getRegistrationStatus(getToken);

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/me`, expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer session-token' },
    }));
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });

  it('sends JSON bodies with POST by default', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, { valid: true }));

    // Act
    await validatePhoto(null, getToken);

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/onboarding/photo/validate`, expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: null }),
    }));
  });

  it.each([
    ['throws', () => getToken.mockRejectedValue(new Error('clerk offline'))],
    ['returns no token', () => getToken.mockResolvedValue(null)],
  ])('rejects as unauthorized when the session token provider %s', async (_case, mockTokenProvider) => {
    // Arrange
    mockTokenProvider();

    // Act
    const error = await captureError(getRegistrationStatus(getToken));

    // Assert
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps network failures to a connection error', async () => {
    // Arrange
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    // Act
    const error = await captureError(getRegistrationStatus(getToken));

    // Assert
    expect(error).toMatchObject({ message: 'Lütfen bağlantınızı kontrol edin.', status: 0, code: 'network_error' });
  });

  it('aborts slow requests after fifteen seconds', async () => {
    // Arrange
    jest.useFakeTimers();
    fetchMock.mockImplementation(abortableFetch);
    const pending = captureError(getRegistrationStatus(getToken));

    // Act
    await jest.advanceTimersByTimeAsync(15_000);

    // Assert
    expect(await pending).toMatchObject({ status: 0, code: 'request_timeout' });
  });

  it('tolerates error responses without a JSON body', async () => {
    // Arrange
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: jest.fn().mockRejectedValue(new SyntaxError('bad json')) });

    // Act
    const error = await captureError(getRegistrationStatus(getToken));

    // Assert
    expect(error).toMatchObject({ status: 502, message: 'İşlem şu anda tamamlanamıyor. Lütfen daha sonra tekrar deneyin.' });
  });

  it.each([
    [404, undefined, 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'],
    [409, 'username_taken', 'Bu kullanıcı adı kullanımda.'],
    [422, 'invalid_bio', 'Bilgileri kontrol edip tekrar deneyin.'],
    [422, 'unexpected_field', 'Bilgileri kontrol edip tekrar deneyin.'],
    [409, 'profile_already_complete', 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'],
  ])('maps HTTP %p with code %p to a user-facing message', async (status, code, message) => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(status, { error: { code, field: 'bio', details: { max: 300 } } }));

    // Act
    const error = await captureError(validateBiography('x', getToken));

    // Assert
    expect(error).toMatchObject({ status, code, message, field: 'bio', details: { max: 300 } });
  });

  it('maps HTTP 401 to an unauthorized error', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'token_expired' } }));

    // Act
    const error = await captureError(getRegistrationStatus(getToken));

    // Assert
    expect(error).toMatchObject({ status: 401, code: 'unauthorized', message: 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.' });
  });

  describe('without a configured API URL', () => {
    const originalUrl = process.env.EXPO_PUBLIC_API_URL;

    beforeEach(() => {
      delete process.env.EXPO_PUBLIC_API_URL;
    });

    afterEach(() => {
      process.env.EXPO_PUBLIC_API_URL = originalUrl;
    });

    it('fails fast without calling the network', async () => {
      // Arrange
      let isolatedApi: typeof import('../api') | undefined;
      jest.isolateModules(() => {
        isolatedApi = jest.requireActual('../api');
      });

      // Act
      const error = await captureError(isolatedApi!.getRegistrationStatus(getToken));

      // Assert
      expect(error).toEqual(new Error('Lütfen bağlantınızı kontrol edin.'));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

describe('getRegistrationStatus', () => {
  it.each([
    ['a complete registration with its profile', { registration_complete: true, user: completeProfile }],
    ['an incomplete registration', { registration_complete: false, user: null }],
  ])('returns %s', async (_case, payload) => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, payload));

    // Act
    const status = await getRegistrationStatus(getToken);

    // Assert
    expect(status).toEqual(payload);
  });

  it.each([
    ['an empty body', null, 'Sunucudan geçersiz kayıt durumu alındı.'],
    ['a non-boolean completion flag', { registration_complete: 'yes', user: null }, 'Sunucudan geçersiz kayıt durumu alındı.'],
    ['an incomplete registration with a profile', { registration_complete: false, user: completeProfile }, 'Sunucudan geçersiz kayıt durumu alındı.'],
    ['a complete registration with an invalid profile', { registration_complete: true, user: { username: 'x', gender: 'unknown', bio: null } }, 'Kullanıcı profili yüklenemedi. Ana ekrana geçiş engellendi.'],
  ])('rejects %s', async (_case, payload, message) => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, payload));

    // Act
    const error = await captureError(getRegistrationStatus(getToken));

    // Assert
    expect(error.message).toBe(message);
  });
});

describe('checkUsernameAvailability', () => {
  it('posts the username and returns its availability', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, { available: false }));

    // Act
    const isAvailable = await checkUsernameAvailability('maviay', getToken);

    // Assert
    expect(isAvailable).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/onboarding/username/check`, expect.objectContaining({
      body: JSON.stringify({ username: 'maviay' }),
    }));
  });

  it('retries while the session is still being validated', async () => {
    // Arrange
    jest.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { available: true }));
    const pending = checkUsernameAvailability('maviay', getToken);

    // Act
    await jest.advanceTimersByTimeAsync(250 + 500);

    // Assert
    expect(await pending).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after three retries with a username specific message', async () => {
    // Arrange
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const pending = captureError(checkUsernameAvailability('maviay', getToken));

    // Act
    await jest.advanceTimersByTimeAsync(250 + 500 + 1000);

    // Assert
    expect(await pending).toMatchObject({
      status: 401,
      code: 'unauthorized',
      message: 'Kullanıcı adı şu an kontrol edilemedi. Lütfen tekrar deneyin.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry other errors', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    // Act
    const error = await captureError(checkUsernameAvailability('maviay', getToken));

    // Assert
    expect(error).toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a response without an availability flag', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    // Act
    const error = await captureError(checkUsernameAvailability('maviay', getToken));

    // Assert
    expect(error.message).toBe('Kullanıcı adı kontrol sonucu okunamadı.');
  });
});

describe('validateBiography', () => {
  it('accepts a bio the server confirms unchanged', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, { valid: true, normalized_bio: 'Merhaba' }));

    // Act
    const result = await validateBiography('Merhaba', getToken);

    // Assert
    expect(result).toBeUndefined();
  });

  it.each([
    { valid: false, normalized_bio: 'Merhaba' },
    { valid: true, normalized_bio: 'merhaba' },
  ])('rejects a result with valid $valid and the normalized bio $normalized_bio', async (result) => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, result));

    // Act
    const error = await captureError(validateBiography('Merhaba', getToken));

    // Assert
    expect(error.message).toBe('Biyografi doğrulaması sunucudan onaylanmadı.');
  });
});

describe('validatePhoto', () => {
  it('rejects a photo the server does not confirm', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, { valid: false }));

    // Act
    const error = await captureError(validatePhoto(null, getToken));

    // Assert
    expect(error.message).toBe('Fotoğraf doğrulaması sunucudan onaylanmadı.');
  });
});

describe('uploadProfilePhoto', () => {
  it('authorizes the upload and sends the bytes to the signed URL without the session token', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, uploadAuthorization));
    uploadMock.mockResolvedValue({ status: 200, body: '', headers: {} });

    // Act
    await uploadProfilePhoto(selectedPhoto, getToken);

    // Assert
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/me/profile-photo`, expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ photo: { file_name: 'profile-photo.jpg', mime_type: 'image/jpeg', size_bytes: 240_000 } }),
    }));
    expect(File).toHaveBeenCalledWith(selectedPhoto.uri);
    expect(uploadMock).toHaveBeenCalledWith(uploadAuthorization.upload_url, expect.objectContaining({
      httpMethod: 'PUT',
      uploadType: UploadType.BINARY_CONTENT,
      headers: uploadAuthorization.headers,
      sessionType: 'foreground',
    }));
  });

  it.each([
    ['a non-HTTPS upload URL', { ...uploadAuthorization, upload_url: 'ftp://storage.chattered.test/photo' }],
    ['a method other than PUT', { ...uploadAuthorization, method: 'POST' }],
    ['missing headers', { ...uploadAuthorization, headers: null }],
    ['non-string header values', { ...uploadAuthorization, headers: { 'Content-Length': 240000 } }],
  ])('rejects an upload authorization with %s', async (_case, authorization) => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, authorization));

    // Act
    const error = await captureError(uploadProfilePhoto(selectedPhoto, getToken));

    // Assert
    expect(error.message).toBe('Fotoğraf yükleme izni sunucudan alınamadı.');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects a non-2xx storage response', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, uploadAuthorization));
    uploadMock.mockResolvedValue({ status: 403, body: 'SignatureDoesNotMatch', headers: {} });

    // Act
    const error = await captureError(uploadProfilePhoto(selectedPhoto, getToken));

    // Assert
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 0, code: 'photo_upload_failed' });
  });

  it('maps a failed transfer to an upload error', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, uploadAuthorization));
    uploadMock.mockRejectedValue(new Error('socket closed'));

    // Act
    const error = await captureError(uploadProfilePhoto(selectedPhoto, getToken));

    // Assert
    expect(error).toMatchObject({ code: 'photo_upload_failed' });
  });

  it('aborts the transfer after sixty seconds', async () => {
    // Arrange
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(200, uploadAuthorization));
    uploadMock.mockImplementation(abortableFetch);
    const pending = captureError(uploadProfilePhoto(selectedPhoto, getToken));

    // Act
    await jest.advanceTimersByTimeAsync(60_000);

    // Assert
    expect(await pending).toMatchObject({ code: 'request_timeout' });
  });
});

describe('completeRegistration', () => {
  const profile = { username: 'maviay', gender: 'female' as const, bio: null, photo: null };

  it('posts the profile and returns the completed registration', async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, { registration_complete: true, user: completeProfile }));

    // Act
    const registration = await completeRegistration(profile, getToken);

    // Assert
    expect(registration).toEqual({ registration_complete: true, user: completeProfile });
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/onboarding/complete`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(profile),
    }));
  });

  it.each([
    ['an empty body', null, 'Sunucudan geçersiz kayıt yanıtı alındı.'],
    ['an incomplete registration', { registration_complete: false, user: null }, 'Kullanıcı profili oluşturulamadı. Ana ekrana geçiş engellendi.'],
    ['a complete registration with an invalid profile', { registration_complete: true, user: { username: 1, gender: 'male', bio: null } }, 'Kullanıcı profili oluşturulamadı. Ana ekrana geçiş engellendi.'],
  ])('rejects %s', async (_case, payload, message) => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, payload));

    // Act
    const error = await captureError(completeRegistration(profile, getToken));

    // Assert
    expect(error.message).toBe(message);
  });
});
