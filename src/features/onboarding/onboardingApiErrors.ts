import { ApiRequestError } from './api';
import type { OnboardingField } from './types';
import { maxBioCodePoints, maxUsernameCharacters } from './validation';

export type OnboardingFieldError = { field: OnboardingField; message: string };

type ApiFieldEntry = { field?: string; code?: string };

type ApiErrorDetails = {
  fields?: unknown;
  errors?: unknown;
  field_errors?: unknown;
};

/** Maps every field the API reported, in its top-level error and its details, to a wizard field and message. */
export function getOnboardingFieldErrors(error: ApiRequestError): OnboardingFieldError[] {
  return getApiFieldEntries(error).flatMap((entry) => {
    const field = mapApiField(entry.field, entry.code);
    return field ? [{ field, message: getApiFieldMessage(error, field, entry.code) }] : [];
  });
}

/** Message for an error that is not tied to a single wizard field. */
export function getOnboardingActionMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.code === 'photo_upload_incomplete') {
    return 'Fotoğraf yüklemesi tamamlanmadı. Tekrar dene ya da fotoğrafı kaldır.';
  }
  if (error instanceof ApiRequestError && error.status === 409) return 'Kayıt bu sırada değişti. Bilgilerini kontrol edip tekrar dene.';
  if (error instanceof ApiRequestError && error.status === 401) return 'Oturum doğrulanamadı. Yeniden giriş yapıp tekrar dene.';
  return error instanceof Error ? error.message : 'İşlem tamamlanamadı. Tekrar dene.';
}

function getApiFieldEntries(error: ApiRequestError): ApiFieldEntry[] {
  const entries: ApiFieldEntry[] = [{ field: error.field, code: error.code }];
  if (!error.details || typeof error.details !== 'object') return entries;

  const details = error.details as ApiErrorDetails;
  return entries.concat(
    getDetailFieldNames(details.fields),
    getDetailErrorEntries(details.errors),
    getDetailFieldErrorKeys(details.field_errors),
  );
}

function getDetailFieldNames(fields: unknown): ApiFieldEntry[] {
  if (!Array.isArray(fields)) return [];
  return fields.filter((field): field is string => typeof field === 'string').map((field) => ({ field }));
}

function getDetailErrorEntries(errors: unknown): ApiFieldEntry[] {
  if (!Array.isArray(errors)) return [];
  return errors
    .filter((item): item is { field?: unknown; code?: unknown } => !!item && typeof item === 'object' && 'field' in item)
    .map((issue) => ({
      field: typeof issue.field === 'string' ? issue.field : undefined,
      code: typeof issue.code === 'string' ? issue.code : undefined,
    }));
}

function getDetailFieldErrorKeys(fieldErrors: unknown): ApiFieldEntry[] {
  if (!fieldErrors || typeof fieldErrors !== 'object') return [];
  return Object.keys(fieldErrors).map((field) => ({ field }));
}

function mapApiField(field?: string, code?: string): OnboardingField | null {
  // A missing upload is retryable from the review step, so it is not shown as a photo field error.
  if (code === 'photo_upload_incomplete') return null;
  if (code === 'username_taken' || field === 'username') return 'username';
  if (field === 'gender') return 'gender';
  if (field === 'bio') return 'bio';
  if (field?.startsWith('photo')) return 'photo';
  if (code === 'invalid_username') return 'username';
  if (code === 'invalid_gender') return 'gender';
  if (code === 'invalid_bio') return 'bio';
  if (code === 'invalid_photo') return 'photo';
  return null;
}

function getApiFieldMessage(error: ApiRequestError, field: OnboardingField, code?: string): string {
  const errorCode = code ?? error.code;
  if (errorCode === 'username_taken') return 'Bu kullanıcı adı az önce alınmış. Başka bir ad seç.';
  if (errorCode === 'invalid_username') return `Kullanıcı adı 3–${maxUsernameCharacters} karakter olmalı; küçük harfle başlamalı, yalnızca küçük harf, rakam ve alt çizgi kullanılmalı.`;
  if (errorCode === 'invalid_gender') return 'Bir cinsiyet seçeneği belirle.';
  if (errorCode === 'invalid_bio') return `Biyografi biçimini kontrol et. En fazla ${maxBioCodePoints} karakter kullanabilirsin.`;
  if (errorCode === 'invalid_photo' && error.field === 'photo.size_bytes') return 'Fotoğraf en fazla 10 MiB olabilir.';
  if (errorCode === 'invalid_photo') return 'Fotoğraf JPG, PNG veya HEIC olmalı ve dosya bilgileri eşleşmeli.';
  return field === 'photo' ? 'Fotoğraf bilgileri geçerli değil.' : 'Bu alanı kontrol edip tekrar dene.';
}
