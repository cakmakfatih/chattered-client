import { emptyOnboardingDraft, normalizeBio, toPhotoMetadata } from '../types';

describe('onboarding draft helpers', () => {
  it('starts with an empty draft', () => {
    // Arrange
    const expectedDraft = { username: '', gender: null, bio: '', photo: null };

    // Act
    const draft = emptyOnboardingDraft;

    // Assert
    expect(draft).toEqual(expectedDraft);
  });

  it('keeps only the server metadata of a selected photo', () => {
    // Arrange
    const photo = {
      uri: 'file:///photo.jpg',
      width: 600,
      height: 600,
      file_name: 'photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 42,
    };

    // Act
    const metadata = toPhotoMetadata(photo);

    // Assert
    expect(metadata).toEqual({ file_name: 'photo.jpg', mime_type: 'image/jpeg', size_bytes: 42 });
  });

  it('returns no metadata when no photo is selected', () => {
    // Arrange
    const photo = null;

    // Act
    const metadata = toPhotoMetadata(photo);

    // Assert
    expect(metadata).toBeNull();
  });

  it.each([
    ['an empty bio as null', '', null],
    ['whitespace unchanged', ' ', ' '],
    ['text unchanged', 'Merhaba', 'Merhaba'],
  ])('normalizes %s', (_case, bio, expected) => {
    // Arrange
    const input = bio;

    // Act
    const normalized = normalizeBio(input);

    // Assert
    expect(normalized).toBe(expected);
  });
});
