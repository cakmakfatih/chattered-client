import type { SelectedPhoto } from '../types';
import {
  getBioError,
  getGenderError,
  getPhotoMetadataError,
  getSelectedPhotoError,
  getUsernameFormatError,
  hasRequiredPhotoDimensions,
  isPhotoLargeEnough,
  isValidUsername,
  maxBioCodePoints,
  minPhotoDimension,
  photoTooSmallMessage,
} from '../validation';

function createPhoto(overrides: Partial<SelectedPhoto> = {}): SelectedPhoto {
  return {
    uri: 'file:///profile-photo.jpg',
    width: 800,
    height: 800,
    file_name: 'profile-photo.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 120_000,
    ...overrides,
  };
}

describe('username validation', () => {
  it.each(['abc', 'user_name', 'a1b2c3', 'abcdefghijklmno'])('accepts %p', (username) => {
    expect(getUsernameFormatError(username)).toBeNull();
    expect(isValidUsername(username)).toBe(true);
  });

  it('rejects usernames shorter than three characters', () => {
    expect(getUsernameFormatError('ab')).toBe('Kullanıcı adı en az 3 karakter olmalı.');
    expect(isValidUsername('ab')).toBe(false);
  });

  it('rejects usernames longer than fifteen characters', () => {
    expect(getUsernameFormatError('abcdefghijklmnop')).toBe('Kullanıcı adı en fazla 15 karakter olabilir.');
    expect(isValidUsername('abcdefghijklmnop')).toBe(false);
  });

  it.each(['1abc', '_abc', 'Abc', 'ab-c', 'abç', 'ab c'])('rejects the malformed username %p', (username) => {
    expect(getUsernameFormatError(username)).toMatch(/küçük harfle başlamalı/);
    expect(isValidUsername(username)).toBe(false);
  });
});

describe('gender validation', () => {
  it.each(['male', 'female', 'other'] as const)('accepts %p', (gender) => {
    expect(getGenderError(gender)).toBeNull();
  });

  it('requires a selection', () => {
    expect(getGenderError(null)).toBe('Bir seçenek belirle.');
  });
});

describe('bio validation', () => {
  it('accepts an empty bio and a bio at the code point limit', () => {
    expect(getBioError('')).toBeNull();
    expect(getBioError('a'.repeat(maxBioCodePoints))).toBeNull();
  });

  it('counts emoji as single code points', () => {
    expect(getBioError('😀'.repeat(maxBioCodePoints))).toBeNull();
    expect(getBioError('😀'.repeat(maxBioCodePoints + 1))).toBe('Biyografi en fazla 300 karakter olabilir.');
  });

  it('allows line breaks and tabs but rejects other control characters', () => {
    expect(getBioError('satır\nsatır\tsekme')).toBeNull();
    expect(getBioError('zil\u0007')).toBe('Biyografide desteklenmeyen kontrol karakterleri var.');
  });
});

describe('photo metadata validation', () => {
  it('accepts JPEG, PNG and HEIC files with matching MIME types', () => {
    expect(getPhotoMetadataError({ file_name: 'a.jpg', mime_type: 'image/jpeg', size_bytes: 1 })).toBeNull();
    expect(getPhotoMetadataError({ file_name: 'a.JPEG', mime_type: 'image/jpeg', size_bytes: 1 })).toBeNull();
    expect(getPhotoMetadataError({ file_name: 'a.png', mime_type: 'image/png', size_bytes: 1 })).toBeNull();
    expect(getPhotoMetadataError({ file_name: 'a.heic', mime_type: 'image/heic', size_bytes: 1 })).toBeNull();
  });

  it.each([
    [{ file_name: '', mime_type: 'image/jpeg', size_bytes: 1 }, 'Fotoğraf dosya adı okunamadı.'],
    [{ file_name: 'dir/a.jpg', mime_type: 'image/jpeg', size_bytes: 1 }, 'Fotoğraf dosya adı bir klasör yolu içeremez.'],
    [{ file_name: 'a.gif', mime_type: 'image/jpeg', size_bytes: 1 }, 'Fotoğraf JPG, PNG veya HEIC formatında olmalı.'],
    [{ file_name: 'a.jpg', mime_type: 'image/gif', size_bytes: 1 }, 'Fotoğrafın dosya türü desteklenmiyor.'],
    [{ file_name: 'a.jpg', mime_type: 'image/jpeg', size_bytes: 1.5 }, 'Fotoğraf boyutu okunamadı.'],
    [{ file_name: 'a.jpg', mime_type: 'image/jpeg', size_bytes: 0 }, 'Fotoğraf boş olamaz.'],
    [{ file_name: 'a.jpg', mime_type: 'image/jpeg', size_bytes: 10 * 1024 * 1024 + 1 }, 'Fotoğraf en fazla 10 MiB olabilir.'],
    [{ file_name: 'a.png', mime_type: 'image/jpeg', size_bytes: 1 }, 'Fotoğrafın MIME türü uzantısıyla eşleşmiyor.'],
  ])('rejects %p', (photo, message) => {
    expect(getPhotoMetadataError(photo)).toBe(message);
  });
});

describe('photo dimension validation', () => {
  it('requires both sides to reach the minimum dimension', () => {
    expect(isPhotoLargeEnough({ width: minPhotoDimension, height: minPhotoDimension })).toBe(true);
    expect(isPhotoLargeEnough({ width: minPhotoDimension - 1, height: 2000 })).toBe(false);
    expect(isPhotoLargeEnough({ width: 2000, height: minPhotoDimension - 1 })).toBe(false);
  });

  it('requires a square photo of at least the minimum dimension', () => {
    expect(hasRequiredPhotoDimensions(createPhoto({ width: 512, height: 512 }))).toBe(true);
    expect(hasRequiredPhotoDimensions(createPhoto({ width: 800, height: 600 }))).toBe(false);
    expect(hasRequiredPhotoDimensions(createPhoto({ width: 400, height: 400 }))).toBe(false);
  });

  it('reports size, shape and metadata problems in that order', () => {
    expect(getSelectedPhotoError(createPhoto({ width: 400, height: 400, size_bytes: 0 }))).toBe(photoTooSmallMessage);
    expect(getSelectedPhotoError(createPhoto({ width: 800, height: 600, size_bytes: 0 }))).toBe('Fotoğraf kare olarak kırpılmalı.');
    expect(getSelectedPhotoError(createPhoto({ size_bytes: 0 }))).toBe('Fotoğraf boş olamaz.');
    expect(getSelectedPhotoError(createPhoto())).toBeNull();
  });
});
