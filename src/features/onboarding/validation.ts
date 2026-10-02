import * as v from 'valibot';
import type { Gender, PhotoMetadata } from './types';

const maxBioCodePoints = 750;
const maxPhotoBytes = 10 * 1024 * 1024;

const usernameSchema = v.pipe(
  v.string(),
  v.check((username) => /^[a-z][a-z0-9_]{2,29}$/.test(username), '3–30 karakter; küçük harfle başlamalı, yalnızca küçük harf, rakam ve alt çizgi kullanılmalı.'),
);

const genderSchema = v.pipe(
  v.string(),
  v.check((gender): gender is Gender => gender === 'male' || gender === 'female' || gender === 'other', 'Bir seçenek belirle.'),
);

const bioSchema = v.pipe(
  v.string(),
  v.check((bio) => Array.from(bio).length <= maxBioCodePoints, 'Biyografi en fazla 750 karakter olabilir.'),
  v.check((bio) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(bio), 'Biyografide desteklenmeyen kontrol karakterleri var.'),
);

const photoMetadataSchema = v.object({
  file_name: v.pipe(
    v.string(),
    v.minLength(1, 'Fotoğraf dosya adı okunamadı.'),
    v.check((fileName) => !/[\\/]/.test(fileName), 'Fotoğraf dosya adı bir klasör yolu içeremez.'),
    v.check((fileName) => /\.(jpe?g|png|heic)$/i.test(fileName), 'Fotoğraf JPG, PNG veya HEIC formatında olmalı.'),
  ),
  mime_type: v.pipe(
    v.string(),
    v.check((mimeType) => ['image/jpeg', 'image/png', 'image/heic'].includes(mimeType), 'Fotoğrafın dosya türü desteklenmiyor.'),
  ),
  size_bytes: v.pipe(
    v.number(),
    v.integer('Fotoğraf boyutu okunamadı.'),
    v.minValue(1, 'Fotoğraf boş olamaz.'),
    v.maxValue(maxPhotoBytes, 'Fotoğraf en fazla 10 MiB olabilir.'),
  ),
});

const photoSchema = v.pipe(
  photoMetadataSchema,
  v.check((photo) => mimeMatchesExtension(photo), 'Fotoğrafın MIME türü uzantısıyla eşleşmiyor.'),
);

function mimeMatchesExtension(photo: PhotoMetadata): boolean {
  const extension = photo.file_name.split('.').pop()?.toLowerCase();
  const expectedMime = extension === 'jpg' || extension === 'jpeg'
    ? 'image/jpeg'
    : extension === 'png'
      ? 'image/png'
      : extension === 'heic'
        ? 'image/heic'
        : null;
  return expectedMime === photo.mime_type;
}

function firstIssue<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: TSchema, input: unknown): string | null {
  const result = v.safeParse(schema, input);
  return result.success ? null : result.issues[0]?.message ?? 'Bilgiyi kontrol edip tekrar dene.';
}

export function getUsernameFormatError(username: string): string | null {
  if (username.length < 3) return 'Kullanıcı adı en az 3 karakter olmalı.';
  if (username.length > 30) return 'Kullanıcı adı en fazla 30 karakter olabilir.';
  return firstIssue(usernameSchema, username);
}

export function isValidUsername(username: string): boolean {
  return v.safeParse(usernameSchema, username).success;
}

export function getGenderError(gender: Gender | null): string | null {
  return firstIssue(genderSchema, gender);
}

export function getBioError(bio: string): string | null {
  return firstIssue(bioSchema, bio);
}

export function getPhotoMetadataError(photo: PhotoMetadata): string | null {
  return firstIssue(photoSchema, photo);
}
