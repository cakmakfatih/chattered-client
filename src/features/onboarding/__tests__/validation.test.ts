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
    // Arrange
    const input = username;

    // Act
    const error = getUsernameFormatError(input);

    // Assert
    expect(error).toBeNull();
    expect(isValidUsername(input)).toBe(true);
  });

  it('rejects usernames shorter than three characters', () => {
    // Arrange
    const username = 'ab';

    // Act
    const error = getUsernameFormatError(username);

    // Assert
    expect(error).toBe('Kullanıcı adı en az 3 karakter olmalı.');
    expect(isValidUsername(username)).toBe(false);
  });

  it('rejects usernames longer than fifteen characters', () => {
    // Arrange
    const username = 'abcdefghijklmnop';

    // Act
    const error = getUsernameFormatError(username);

    // Assert
    expect(error).toBe('Kullanıcı adı en fazla 15 karakter olabilir.');
    expect(isValidUsername(username)).toBe(false);
  });

  it.each(['1abc', '_abc', 'Abc', 'ab-c', 'abç', 'ab c'])('rejects the malformed username %p', (username) => {
    // Arrange
    const input = username;

    // Act
    const error = getUsernameFormatError(input);

    // Assert
    expect(error).toMatch(/küçük harfle başlamalı/);
    expect(isValidUsername(input)).toBe(false);
  });
});

describe('gender validation', () => {
  it.each(['male', 'female', 'other'] as const)('accepts %p', (gender) => {
    // Arrange
    const input = gender;

    // Act
    const error = getGenderError(input);

    // Assert
    expect(error).toBeNull();
  });

  it('requires a selection', () => {
    // Arrange
    const gender = null;

    // Act
    const error = getGenderError(gender);

    // Assert
    expect(error).toBe('Bir seçenek belirle.');
  });
});

describe('bio validation', () => {
  it.each([
    ['an empty bio', ''],
    ['a bio at the code point limit', 'a'.repeat(maxBioCodePoints)],
    ['emoji up to the limit, counted as single code points', '😀'.repeat(maxBioCodePoints)],
    ['line breaks and tabs', 'satır\nsatır\tsekme'],
  ])('accepts %s', (_case, bio) => {
    // Arrange
    const input = bio;

    // Act
    const error = getBioError(input);

    // Assert
    expect(error).toBeNull();
  });

  it.each([
    ['emoji beyond the code point limit', '😀'.repeat(maxBioCodePoints + 1), 'Biyografi en fazla 300 karakter olabilir.'],
    ['other control characters', 'zil\u0007', 'Biyografide desteklenmeyen kontrol karakterleri var.'],
  ])('rejects %s', (_case, bio, message) => {
    // Arrange
    const input = bio;

    // Act
    const error = getBioError(input);

    // Assert
    expect(error).toBe(message);
  });
});

describe('photo metadata validation', () => {
  it.each([
    { file_name: 'a.jpg', mime_type: 'image/jpeg', size_bytes: 1 },
    { file_name: 'a.JPEG', mime_type: 'image/jpeg', size_bytes: 1 },
    { file_name: 'a.png', mime_type: 'image/png', size_bytes: 1 },
    { file_name: 'a.heic', mime_type: 'image/heic', size_bytes: 1 },
  ])('accepts %p with a matching MIME type', (photo) => {
    // Arrange
    const metadata = photo;

    // Act
    const error = getPhotoMetadataError(metadata);

    // Assert
    expect(error).toBeNull();
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
    // Arrange
    const metadata = photo;

    // Act
    const error = getPhotoMetadataError(metadata);

    // Assert
    expect(error).toBe(message);
  });
});

describe('photo dimension validation', () => {
  it.each([
    ['both sides at the minimum', { width: minPhotoDimension, height: minPhotoDimension }, true],
    ['a width below the minimum', { width: minPhotoDimension - 1, height: 2000 }, false],
    ['a height below the minimum', { width: 2000, height: minPhotoDimension - 1 }, false],
  ])('treats a photo with %s as large enough: %p', (_case, size, expected) => {
    // Arrange
    const photo = size;

    // Act
    const isLargeEnough = isPhotoLargeEnough(photo);

    // Assert
    expect(isLargeEnough).toBe(expected);
  });

  it.each([
    ['a 512 px square', { width: 512, height: 512 }, true],
    ['a non-square photo', { width: 800, height: 600 }, false],
    ['a square below the minimum', { width: 400, height: 400 }, false],
  ])('checks the required dimensions of %s', (_case, size, expected) => {
    // Arrange
    const photo = createPhoto(size);

    // Act
    const hasRequiredDimensions = hasRequiredPhotoDimensions(photo);

    // Assert
    expect(hasRequiredDimensions).toBe(expected);
  });

  it.each([
    ['size before shape and metadata', { width: 400, height: 400, size_bytes: 0 }, photoTooSmallMessage],
    ['shape before metadata', { width: 800, height: 600, size_bytes: 0 }, 'Fotoğraf kare olarak kırpılmalı.'],
    ['metadata last', { size_bytes: 0 }, 'Fotoğraf boş olamaz.'],
    ['no problem for a valid photo', {}, null],
  ])('reports %s', (_case, overrides, expected) => {
    // Arrange
    const photo = createPhoto(overrides);

    // Act
    const error = getSelectedPhotoError(photo);

    // Assert
    expect(error).toBe(expected);
  });
});
