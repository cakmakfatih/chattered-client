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
    fetchMock.mockResolvedValue(jsonResponse(200, { registration_complete: false, user: null }));

    await getRegistrationStatus(getToken);

    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/me`, expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer session-token' },
    }));
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });

  it('sends JSON bodies with POST by default', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { valid: true }));

    await validatePhoto(null, getToken);

    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/onboarding/photo/validate`, expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: null }),
    }));
  });

  it.each([
    ['throws', () => getToken.mockRejectedValue(new Error('clerk offline'))],
    ['returns no token', () => getToken.mockResolvedValue(null)],
  ])('rejects as unauthorized when the session token provider %s', async (_case, arrange) => {
    arrange();

    const error = await captureError(getRegistrationStatus(getToken));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps network failures to a connection error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = await captureError(getRegistrationStatus(getToken));

    expect(error).toMatchObject({ message: 'Lütfen bağlantınızı kontrol edin.', status: 0, code: 'network_error' });
  });

  it('aborts slow requests after fifteen seconds', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(abortableFetch);

    const pending = captureError(getRegistrationStatus(getToken));
    await jest.advanceTimersByTimeAsync(15_000);

    expect(await pending).toMatchObject({ status: 0, code: 'request_timeout' });
  });

  it('tolerates error responses without a JSON body', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: jest.fn().mockRejectedValue(new SyntaxError('bad json')) });

    const error = await captureError(getRegistrationStatus(getToken));

    expect(error).toMatchObject({ status: 502, message: 'İşlem şu anda tamamlanamıyor. Lütfen daha sonra tekrar deneyin.' });
  });

  it.each([
    [404, undefined, 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'],
    [409, 'username_taken', 'Bu kullanıcı adı kullanımda.'],
    [422, 'invalid_bio', 'Bilgileri kontrol edip tekrar deneyin.'],
    [422, 'unexpected_field', 'Bilgileri kontrol edip tekrar deneyin.'],
    [409, 'profile_already_complete', 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'],
  ])('maps HTTP %p with code %p to a user-facing message', async (status, code, message) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error: { code, field: 'bio', details: { max: 300 } } }));

    const error = await captureError(validateBiography('x', getToken));

    expect(error).toMatchObject({ status, code, message, field: 'bio', details: { max: 300 } });
  });

  it('maps HTTP 401 to an unauthorized error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'token_expired' } }));

    const error = await captureError(getRegistrationStatus(getToken));

    expect(error).toMatchObject({ status: 401, code: 'unauthorized', message: 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.' });
  });

  it('fails fast when the API URL is not configured', async () => {
    const originalUrl = process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_URL;
    try {
      let isolatedApi: typeof import('../api') | undefined;
      jest.isolateModules(() => {
        isolatedApi = require('../api');
      });

      await expect(isolatedApi!.getRegistrationStatus(getToken)).rejects.toThrow('Lütfen bağlantınızı kontrol edin.');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      process.env.EXPO_PUBLIC_API_URL = originalUrl;
    }
  });
});

describe('getRegistrationStatus', () => {
  it('returns a complete registration with its profile', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { registration_complete: true, user: completeProfile }));

    await expect(getRegistrationStatus(getToken)).resolves.toEqual({ registration_complete: true, user: completeProfile });
  });

  it('returns an incomplete registration', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { registration_complete: false, user: null }));

    await expect(getRegistrationStatus(getToken)).resolves.toEqual({ registration_complete: false, user: null });
  });

  it.each([
    [null, 'Sunucudan geçersiz kayıt durumu alındı.'],
    [{ registration_complete: 'yes', user: null }, 'Sunucudan geçersiz kayıt durumu alındı.'],
    [{ registration_complete: false, user: completeProfile }, 'Sunucudan geçersiz kayıt durumu alındı.'],
    [{ registration_complete: true, user: { username: 'x', gender: 'unknown', bio: null } }, 'Kullanıcı profili yüklenemedi. Ana ekrana geçiş engellendi.'],
  ])('rejects the malformed payload %p', async (payload, message) => {
    fetchMock.mockResolvedValue(jsonResponse(200, payload));

    await expect(getRegistrationStatus(getToken)).rejects.toThrow(message);
  });
});

describe('checkUsernameAvailability', () => {
  it('posts the username and returns its availability', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { available: false }));

    await expect(checkUsernameAvailability('maviay', getToken)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/onboarding/username/check`, expect.objectContaining({
      body: JSON.stringify({ username: 'maviay' }),
    }));
  });

  it('retries while the session is still being validated', async () => {
    jest.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { available: true }));

    const pending = checkUsernameAvailability('maviay', getToken);
    await jest.advanceTimersByTimeAsync(250 + 500);

    await expect(pending).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after three retries with a username specific message', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(401, {}));

    const pending = captureError(checkUsernameAvailability('maviay', getToken));
    await jest.advanceTimersByTimeAsync(250 + 500 + 1000);

    expect(await pending).toMatchObject({
      status: 401,
      code: 'unauthorized',
      message: 'Kullanıcı adı şu an kontrol edilemedi. Lütfen tekrar deneyin.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry other errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    await expect(checkUsernameAvailability('maviay', getToken)).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a response without an availability flag', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await expect(checkUsernameAvailability('maviay', getToken)).rejects.toThrow('Kullanıcı adı kontrol sonucu okunamadı.');
  });
});

describe('validateBiography', () => {
  it('accepts a bio the server confirms unchanged', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { valid: true, normalized_bio: 'Merhaba' }));

    await expect(validateBiography('Merhaba', getToken)).resolves.toBeUndefined();
  });

  it.each([
    { valid: false, normalized_bio: 'Merhaba' },
    { valid: true, normalized_bio: 'merhaba' },
  ])('rejects the unconfirmed result %p', async (result) => {
    fetchMock.mockResolvedValue(jsonResponse(200, result));

    await expect(validateBiography('Merhaba', getToken)).rejects.toThrow('Biyografi doğrulaması sunucudan onaylanmadı.');
  });
});

describe('validatePhoto', () => {
  it('rejects a photo the server does not confirm', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { valid: false }));

    await expect(validatePhoto(null, getToken)).rejects.toThrow('Fotoğraf doğrulaması sunucudan onaylanmadı.');
  });
});

describe('uploadProfilePhoto', () => {
  it('authorizes the upload and sends the bytes to the signed URL without the session token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, uploadAuthorization));
    uploadMock.mockResolvedValue({ status: 200, body: '', headers: {} });

    await uploadProfilePhoto(selectedPhoto, getToken);

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
    { ...uploadAuthorization, upload_url: 'ftp://storage.chattered.test/photo' },
    { ...uploadAuthorization, method: 'POST' },
    { ...uploadAuthorization, headers: null },
    { ...uploadAuthorization, headers: { 'Content-Length': 240000 } },
  ])('rejects the invalid upload authorization %p', async (authorization) => {
    fetchMock.mockResolvedValue(jsonResponse(200, authorization));

    await expect(uploadProfilePhoto(selectedPhoto, getToken)).rejects.toThrow('Fotoğraf yükleme izni sunucudan alınamadı.');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects a non-2xx storage response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, uploadAuthorization));
    uploadMock.mockResolvedValue({ status: 403, body: 'SignatureDoesNotMatch', headers: {} });

    const error = await captureError(uploadProfilePhoto(selectedPhoto, getToken));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 0, code: 'photo_upload_failed' });
  });

  it('maps a failed transfer to an upload error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, uploadAuthorization));
    uploadMock.mockRejectedValue(new Error('socket closed'));

    await expect(uploadProfilePhoto(selectedPhoto, getToken)).rejects.toMatchObject({ code: 'photo_upload_failed' });
  });

  it('aborts the transfer after sixty seconds', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(200, uploadAuthorization));
    uploadMock.mockImplementation(abortableFetch);

    const pending = captureError(uploadProfilePhoto(selectedPhoto, getToken));
    await jest.advanceTimersByTimeAsync(60_000);

    expect(await pending).toMatchObject({ code: 'request_timeout' });
  });
});

describe('completeRegistration', () => {
  const profile = { username: 'maviay', gender: 'female' as const, bio: null, photo: null };

  it('returns the completed registration', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { registration_complete: true, user: completeProfile }));

    await expect(completeRegistration(profile, getToken)).resolves.toEqual({ registration_complete: true, user: completeProfile });
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/onboarding/complete`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(profile),
    }));
  });

  it.each([
    [null, 'Sunucudan geçersiz kayıt yanıtı alındı.'],
    [{ registration_complete: false, user: null }, 'Kullanıcı profili oluşturulamadı. Ana ekrana geçiş engellendi.'],
    [{ registration_complete: true, user: { username: 1, gender: 'male', bio: null } }, 'Kullanıcı profili oluşturulamadı. Ana ekrana geçiş engellendi.'],
  ])('rejects the malformed payload %p', async (payload, message) => {
    fetchMock.mockResolvedValue(jsonResponse(200, payload));

    await expect(completeRegistration(profile, getToken)).rejects.toThrow(message);
  });
});
