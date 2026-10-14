import { File, UploadType, type UploadResult } from 'expo-file-system';
import type { Gender, PhotoMetadata, SelectedPhoto } from './types';

type GetSessionToken = () => Promise<string | null>;

type HttpMethod = 'GET' | 'POST' | 'PUT';

type ApiErrorBody = {
  error?: {
    code?: string;
    field?: string;
    details?: unknown;
  };
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly field?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export type RegistrationProfile = {
  username: string;
  gender: Gender;
  bio: string | null;
};

export type RegistrationStatusResponse = {
  registration_complete: boolean;
  user: RegistrationProfile | null;
};

type ProfilePhotoUploadAuthorization = {
  upload_url: string;
  method: 'PUT';
  headers: Record<string, string>;
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const apiRequestTimeoutMilliseconds = 15_000;
const photoUploadTimeoutMilliseconds = 60_000;
const photoUploadFailedMessage = 'Fotoğraf yüklenemedi. Bağlantını kontrol edip tekrar dene ya da fotoğrafı kaldır.';

const connectionErrorMessage = 'Lütfen bağlantınızı kontrol edin.';
const unauthorizedMessage = 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.';
const usernameCheckRetryDelays = [250, 500, 1000];

type JsonResponse = { response: Response; payload: unknown };

async function request<TResponse>(
  path: string,
  getToken: GetSessionToken,
  body?: unknown,
  method: HttpMethod = body === undefined ? 'GET' : 'POST',
): Promise<TResponse> {
  if (!apiBaseUrl) throw new Error(connectionErrorMessage);

  const token = await requireSessionToken(getToken);
  const { response, payload } = await fetchJson(`${apiBaseUrl}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) throw toApiRequestError(response.status, payload);
  return payload as TResponse;
}

async function requireSessionToken(getToken: GetSessionToken): Promise<string> {
  let token: string | null;
  try {
    token = await getToken();
  } catch {
    token = null;
  }
  if (!token) throw new ApiRequestError(unauthorizedMessage, 401, 'unauthorized');
  return token;
}

/** Sends the request with a timeout; a body that is not JSON is read as null unless the timeout cut it off. */
async function fetchJson(url: string, init: RequestInit): Promise<JsonResponse> {
  const abortController = new AbortController();
  const requestTimeout = setTimeout(() => abortController.abort(), apiRequestTimeoutMilliseconds);
  try {
    const response = await fetch(url, { ...init, signal: abortController.signal });
    const payload = await response.json().catch((error: unknown) => {
      if (abortController.signal.aborted) throw error;
      return null;
    });
    return { response, payload };
  } catch {
    const code = abortController.signal.aborted ? 'request_timeout' : 'network_error';
    throw new ApiRequestError(connectionErrorMessage, 0, code);
  } finally {
    clearTimeout(requestTimeout);
  }
}

function toApiRequestError(status: number, payload: unknown): ApiRequestError {
  if (status === 401) return new ApiRequestError(unauthorizedMessage, status, 'unauthorized');
  const apiError = asApiErrorBody(payload)?.error;
  return new ApiRequestError(
    getUserFacingApiErrorMessage(status, apiError?.code),
    status,
    apiError?.code,
    apiError?.field,
    apiError?.details,
  );
}

function getUserFacingApiErrorMessage(status: number, code?: string): string {
  if (status === 404) return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
  if (status >= 500) return 'İşlem şu anda tamamlanamıyor. Lütfen daha sonra tekrar deneyin.';
  if (code === 'username_taken') return 'Bu kullanıcı adı kullanımda.';
  if (code?.startsWith('invalid_') || code === 'unexpected_field') {
    return 'Bilgileri kontrol edip tekrar deneyin.';
  }
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}

function asApiErrorBody(value: unknown): ApiErrorBody | null {
  if (!value || typeof value !== 'object' || !('error' in value)) return null;
  return value as ApiErrorBody;
}

export async function getRegistrationStatus(getToken: GetSessionToken): Promise<RegistrationStatusResponse> {
  const result = await request<unknown>('/me', getToken);
  if (!result || typeof result !== 'object' || !('registration_complete' in result) || !('user' in result)) {
    throw new Error('Sunucudan geçersiz kayıt durumu alındı.');
  }
  const status = result as RegistrationStatusResponse;
  if (typeof status.registration_complete !== 'boolean') {
    throw new Error('Sunucudan geçersiz kayıt durumu alındı.');
  }
  if (status.registration_complete && !isRegistrationProfile(status.user)) {
    throw new Error('Kullanıcı profili yüklenemedi. Ana ekrana geçiş engellendi.');
  }
  if (!status.registration_complete && status.user !== null) {
    throw new Error('Sunucudan geçersiz kayıt durumu alındı.');
  }
  return status;
}

export async function checkUsernameAvailability(username: string, getToken: GetSessionToken): Promise<boolean> {
  const result = await requestUsernameCheck(username, getToken);
  if (typeof result?.available !== 'boolean') throw new Error('Kullanıcı adı kontrol sonucu okunamadı.');
  return result.available;
}

/** A fresh session can briefly be rejected while Clerk finishes activating it, so 401s are retried with backoff. */
async function requestUsernameCheck(username: string, getToken: GetSessionToken): Promise<{ available: boolean }> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request<{ available: boolean }>('/onboarding/username/check', getToken, { username });
    } catch (error) {
      const isUnauthorized = error instanceof ApiRequestError && error.status === 401;
      const retryDelay = usernameCheckRetryDelays[attempt];
      if (!isUnauthorized) throw error;
      if (retryDelay === undefined) {
        throw new ApiRequestError(
          'Kullanıcı adı şu an kontrol edilemedi. Lütfen tekrar deneyin.',
          error.status,
          error.code,
          error.field,
          error.details,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

export async function validateBiography(bio: string | null, getToken: GetSessionToken): Promise<void> {
  const result = await request<{ valid: boolean; normalized_bio: string | null }>('/onboarding/bio/validate', getToken, { bio });
  if (result?.valid !== true || result.normalized_bio !== bio) {
    throw new Error('Biyografi doğrulaması sunucudan onaylanmadı.');
  }
}

export async function validatePhoto(photo: PhotoMetadata | null, getToken: GetSessionToken): Promise<void> {
  const result = await request<{ valid: boolean }>('/onboarding/photo/validate', getToken, { photo });
  if (result?.valid !== true) throw new Error('Fotoğraf doğrulaması sunucudan onaylanmadı.');
}

/** Uploads the photo bytes directly to storage; registration completion must follow a successful upload. */
export async function uploadProfilePhoto(photo: SelectedPhoto, getToken: GetSessionToken): Promise<void> {
  const authorization = await authorizeProfilePhotoUpload(photo, getToken);
  await putPhotoToSignedUrl(photo.uri, authorization);
}

async function authorizeProfilePhotoUpload(
  photo: PhotoMetadata,
  getToken: GetSessionToken,
): Promise<ProfilePhotoUploadAuthorization> {
  const { file_name, mime_type, size_bytes } = photo;
  const result = await request<unknown>('/me/profile-photo', getToken, { photo: { file_name, mime_type, size_bytes } }, 'PUT');
  if (!isProfilePhotoUploadAuthorization(result)) {
    throw new Error('Fotoğraf yükleme izni sunucudan alınamadı.');
  }
  return result;
}

async function putPhotoToSignedUrl(photoUri: string, authorization: ProfilePhotoUploadAuthorization): Promise<void> {
  const abortController = new AbortController();
  const uploadTimeout = setTimeout(() => abortController.abort(), photoUploadTimeoutMilliseconds);
  let result: UploadResult;
  try {
    // The signed URL is a bearer credential: never log it and never attach the Clerk token here.
    result = await new File(photoUri).upload(authorization.upload_url, {
      httpMethod: authorization.method,
      uploadType: UploadType.BINARY_CONTENT,
      headers: authorization.headers,
      sessionType: 'foreground',
      signal: abortController.signal,
    });
  } catch {
    throw new ApiRequestError(
      photoUploadFailedMessage,
      0,
      abortController.signal.aborted ? 'request_timeout' : 'photo_upload_failed',
    );
  } finally {
    clearTimeout(uploadTimeout);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new ApiRequestError(photoUploadFailedMessage, 0, 'photo_upload_failed');
  }
}

function isProfilePhotoUploadAuthorization(value: unknown): value is ProfilePhotoUploadAuthorization {
  if (!value || typeof value !== 'object') return false;
  const authorization = value as Record<string, unknown>;
  const headers = authorization.headers as Record<string, unknown> | null | undefined;
  return typeof authorization.upload_url === 'string'
    && /^https?:\/\//i.test(authorization.upload_url)
    && authorization.method === 'PUT'
    && !!headers
    && typeof headers === 'object'
    && Object.values(headers).every((headerValue) => typeof headerValue === 'string');
}

export async function completeRegistration(
  profile: { username: string; gender: Gender; bio: string | null; photo: PhotoMetadata | null },
  getToken: GetSessionToken,
): Promise<RegistrationStatusResponse> {
  const result = await request<unknown>('/onboarding/complete', getToken, profile);
  if (!result || typeof result !== 'object' || !('registration_complete' in result) || !('user' in result)) {
    throw new Error('Sunucudan geçersiz kayıt yanıtı alındı.');
  }
  const status = result as RegistrationStatusResponse;
  if (status.registration_complete !== true || !isRegistrationProfile(status.user)) {
    throw new Error('Kullanıcı profili oluşturulamadı. Ana ekrana geçiş engellendi.');
  }
  return status;
}

function isRegistrationProfile(value: unknown): value is RegistrationProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return typeof profile.username === 'string'
    && (profile.gender === 'male' || profile.gender === 'female' || profile.gender === 'other')
    && (profile.bio === null || typeof profile.bio === 'string');
}
