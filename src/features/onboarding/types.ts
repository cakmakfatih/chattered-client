export type Gender = 'male' | 'female' | 'other';

export type PhotoMetadata = {
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export type SelectedPhoto = PhotoMetadata & {
  uri: string;
  width: number;
  height: number;
};

export type OnboardingDraft = {
  username: string;
  gender: Gender | null;
  bio: string;
  photo: SelectedPhoto | null;
};

export type OnboardingField = 'username' | 'gender' | 'bio' | 'photo';

export type OnboardingFieldErrors = Partial<Record<OnboardingField, string>>;

export const emptyOnboardingDraft: OnboardingDraft = {
  username: '',
  gender: null,
  bio: '',
  photo: null,
};

export function toPhotoMetadata(photo: SelectedPhoto | null): PhotoMetadata | null {
  if (!photo) return null;
  const { file_name, mime_type, size_bytes } = photo;
  return { file_name, mime_type, size_bytes };
}

export function normalizeBio(bio: string): string | null {
  return bio === '' ? null : bio;
}
