import { emptyOnboardingDraft, normalizeBio, toPhotoMetadata } from '../types';

describe('onboarding draft helpers', () => {
  it('starts with an empty draft', () => {
    expect(emptyOnboardingDraft).toEqual({ username: '', gender: null, bio: '', photo: null });
  });

  it('keeps only the server metadata of a selected photo', () => {
    const photo = {
      uri: 'file:///photo.jpg',
      width: 600,
      height: 600,
      file_name: 'photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 42,
    };

    expect(toPhotoMetadata(photo)).toEqual({ file_name: 'photo.jpg', mime_type: 'image/jpeg', size_bytes: 42 });
    expect(toPhotoMetadata(null)).toBeNull();
  });

  it('sends an empty bio as null', () => {
    expect(normalizeBio('')).toBeNull();
    expect(normalizeBio(' ')).toBe(' ');
    expect(normalizeBio('Merhaba')).toBe('Merhaba');
  });
});
