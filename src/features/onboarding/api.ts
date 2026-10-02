import type { Gender, PhotoMetadata } from './types';

type GetSessionToken = () => Promise<string | null>;

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
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

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

async function request<TResponse>(
  path: string,
  getToken: GetSessionToken,
  body?: unknown,
): Promise<TResponse> {
  if (!apiBaseUrl) {
    throw new Error('Lütfen bağlantınızı kontrol edin.');
  }

  let token: string | null;
  try {
    token = await getToken();
  } catch {
    throw new ApiRequestError('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.', 401, 'unauthorized');
  }
  if (!token) throw new ApiRequestError('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.', 401, 'unauthorized');

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiRequestError(
      'Lütfen bağlantınızı kontrol edin.',
      0,
      'network_error',
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const apiError = asApiErrorBody(payload);
    if (response.status === 401) {
      throw new ApiRequestError(
        'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.',
        response.status,
        'unauthorized',
      );
    }
    throw new ApiRequestError(
      apiError?.error?.message ?? 'İstek tamamlanamadı. Lütfen tekrar dene.',
      response.status,
      apiError?.error?.code,
      apiError?.error?.field,
      apiError?.error?.details,
    );
  }

  return payload as TResponse;
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
  const result = await request<{ available: boolean }>('/onboarding/username/check', getToken, { username });
  if (typeof result?.available !== 'boolean') throw new Error('Kullanıcı adı kontrol sonucu okunamadı.');
  return result.available;
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
