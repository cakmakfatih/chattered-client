import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AlertCircle, ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { AppText } from '../../components/AppText';
import { AppPressable } from '../../components/AppPressable';
import { BrandMark } from '../../components/BrandMark';
import { ButtonLabel } from '../../components/ButtonLabel';
import { ScreenContainer } from '../../components/ScreenContainer';
import { colors } from '../../theme/colors';
import { useAuthTransition } from '../auth/AuthTransitionProvider';
import { ApiRequestError, completeRegistration, validateBiography, validatePhoto } from './api';
import { useRegistrationStatus } from './RegistrationStatusProvider';
import type { Gender, OnboardingDraft, OnboardingField, OnboardingFieldErrors, SelectedPhoto } from './types';
import { emptyOnboardingDraft, normalizeBio, toPhotoMetadata } from './types';
import { useUsernameAvailability } from './useUsernameAvailability';
import { getBioError, getGenderError, getPhotoMetadataError, getUsernameFormatError, maxBioCodePoints, maxUsernameCharacters } from './validation';
import { BioStep, genderLabels, GenderStep, PhotoStep, ReviewStep, UsernameStep } from './OnboardingStepContent';

const stepCopy = [
  { title: 'Bir kullanıcı adı seç', description: 'Anonim olarak sana yazanlar bu adı görecek.' },
  { title: 'Cinsiyetin', description: 'Görünürlük açık ise anonim eşleştirmelerde ve aramalarda kullanılır.' },
  { title: 'Biraz kendinden bahset', description: 'Kısaca kendini tanıt; bir biyografi, ortak ilgi alanların olan kişileri bulmanı kolaylaştırır.' },
  { title: 'Bir fotoğraf ekle', description: 'Profil fotoğrafı olan kullanıcılar daha çok mesaj alırlar.' },
  { title: 'Her şey hazır', description: 'Bilgilerini kontrol et ve Chattered’a katıl.' },
];

const stepOrder: Record<OnboardingField, number> = { username: 0, gender: 1, bio: 2, photo: 3 };

export function OnboardingWizard() {
  const { getToken } = useAuth();
  const { endSession, isSigningOut } = useAuthTransition();
  const { markComplete, refresh } = useRegistrationStatus();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const getSessionToken = useCallback(() => getTokenRef.current(), []);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyOnboardingDraft);
  const [usernameRevision, setUsernameRevision] = useState(0);
  const [step, setStep] = useState(0);
  const [slideProgress] = useState(() => new Animated.Value(1));
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [isStepAnimating, setIsStepAnimating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<OnboardingFieldErrors>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const availability = useUsernameAvailability(draft.username, getSessionToken, step === 0, usernameRevision);

  const updateDraft = useCallback(<TField extends keyof OnboardingDraft>(field: TField, value: OnboardingDraft[TField]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setActionError(null);
  }, []);

  const updateUsername = useCallback((username: string) => {
    setUsernameRevision((revision) => revision + 1);
    updateDraft('username', username);
  }, [updateDraft]);
  const updateGender = useCallback((gender: Gender) => updateDraft('gender', gender), [updateDraft]);
  const updateBio = useCallback((bio: string) => updateDraft('bio', bio), [updateDraft]);
  const updatePhoto = useCallback((photo: SelectedPhoto | null) => updateDraft('photo', photo), [updateDraft]);

  const goToStep = useCallback((nextStep: number) => {
    if (nextStep === step || isStepAnimating) return;

    setSlideDirection(nextStep > step ? 1 : -1);
    setIsStepAnimating(true);
    slideProgress.setValue(0);
    setStep(nextStep);
    Animated.timing(slideProgress, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsStepAnimating(false);
    });
  }, [isStepAnimating, slideProgress, step]);

  const editReviewStep = useCallback((reviewStep: number) => {
    setActionError(null);
    goToStep(reviewStep);
  }, [goToStep]);

  const canContinue = useMemo(() => {
    if (isBusy || isSigningOut || isStepAnimating) return false;
    if (step === 0) return availability.status === 'available' && !fieldErrors.username;
    if (step === 1) return draft.gender !== null && !fieldErrors.gender;
    if (step === 2) return getBioError(draft.bio) === null && !fieldErrors.bio;
    if (step === 3) return (!draft.photo || getPhotoMetadataError(draft.photo) === null) && !fieldErrors.photo;
    return true;
  }, [availability.status, draft.bio, draft.gender, draft.photo, fieldErrors, isBusy, isSigningOut, isStepAnimating, step]);

  const goBack = useCallback(() => {
    if (isBusy || isSigningOut || isStepAnimating) return;
    setActionError(null);
    if (step > 0) {
      goToStep(step - 1);
      return;
    }

    void endSession()
      .catch(() => {
        setActionError('Oturum kapatılamadı. Tekrar dene.');
      });
  }, [endSession, goToStep, isBusy, isSigningOut, isStepAnimating, step]);

  const applyApiFieldErrors = useCallback((error: ApiRequestError): boolean => {
    const fieldEntries = getApiFieldEntries(error);
    const mappedErrors = fieldEntries.flatMap((entry) => {
      const field = mapApiField(entry.field, entry.code);
      return field ? [{ field, message: getApiFieldMessage(error, field, entry.code) }] : [];
    });
    if (mappedErrors.length === 0) return false;

    setFieldErrors((current) => ({
      ...current,
      ...Object.fromEntries(mappedErrors.map(({ field, message }) => [field, message])),
    }));
    const firstField = mappedErrors.reduce((first, current) => (
      stepOrder[current.field] < stepOrder[first.field] ? current : first
    )).field;
    goToStep(stepOrder[firstField]);
    setActionError(null);
    return true;
  }, [goToStep]);

  const validateCurrentStep = useCallback(async () => {
    setIsBusy(true);
    setActionError(null);
    try {
      if (step === 2) {
        const bioError = getBioError(draft.bio);
        if (bioError) {
          setFieldErrors((current) => ({ ...current, bio: bioError }));
          return;
        }
        await validateBiography(normalizeBio(draft.bio), getSessionToken);
      }

      if (step === 3) {
        const photoError = draft.photo ? getPhotoMetadataError(draft.photo) : null;
        if (photoError) {
          setFieldErrors((current) => ({ ...current, photo: photoError }));
          return;
        }
        await validatePhoto(toPhotoMetadata(draft.photo), getSessionToken);
      }

      goToStep(Math.min(stepCopy.length - 1, step + 1));
    } catch (error) {
      if (error instanceof ApiRequestError && applyApiFieldErrors(error)) return;
      setActionError(getApiActionMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [applyApiFieldErrors, draft.bio, draft.photo, getSessionToken, goToStep, step]);

  const submitRegistration = useCallback(async () => {
    const localErrors: OnboardingFieldErrors = {};
    const usernameError = getUsernameFormatError(draft.username);
    const genderError = getGenderError(draft.gender);
    const bioError = getBioError(draft.bio);
    const photoError = draft.photo ? getPhotoMetadataError(draft.photo) : null;
    if (usernameError) localErrors.username = usernameError;
    if (genderError) localErrors.gender = genderError;
    if (bioError) localErrors.bio = bioError;
    if (photoError) localErrors.photo = photoError;
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors((current) => ({ ...current, ...localErrors }));
      const firstField = (Object.keys(localErrors) as OnboardingField[])
        .reduce((first, current) => stepOrder[current] < stepOrder[first] ? current : first);
      goToStep(stepOrder[firstField]);
      return;
    }

    setIsBusy(true);
    setActionError(null);
    try {
      const selectedGender = draft.gender;
      if (!selectedGender) throw new Error('Bir cinsiyet seçeneği belirle.');
      const result = await completeRegistration({
        username: draft.username,
        gender: selectedGender,
        bio: normalizeBio(draft.bio),
        photo: toPhotoMetadata(draft.photo),
      }, getSessionToken);

      if (!result.registration_complete || !result.user) {
        throw new Error('Kayıt tamamlandı yanıtı geçersiz. Ana ekrana geçiş engellendi.');
      }
      markComplete(result.user);
      router.replace('/');
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'profile_already_complete') {
        const registration = await refresh();
        if (registration.status === 'complete') {
          markComplete(registration.profile);
          router.replace('/');
          return;
        }
      }
      if (error instanceof ApiRequestError && applyApiFieldErrors(error)) return;
      setActionError(getApiActionMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [applyApiFieldErrors, draft, getSessionToken, goToStep, markComplete, refresh]);

  const continueToNextStep = useCallback(() => {
    if (!canContinue) return;
    if (step === 2 || step === 3) {
      void validateCurrentStep();
      return;
    }
    if (step === stepCopy.length - 1) {
      void submitRegistration();
      return;
    }
    setActionError(null);
    goToStep(step + 1);
  }, [canContinue, goToStep, step, submitRegistration, validateCurrentStep]);

  const copy = stepCopy[step];
  const usernameFormatError = draft.username ? getUsernameFormatError(draft.username) : null;
  const contentTranslateX = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [slideDirection * 28, 0],
  });
  const contentOpacity = slideProgress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <ScreenContainer contentStyle={styles.screen} topPadding={12} bottomPadding={12} horizontalPadding={24}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <BrandMark />
          <AppText style={styles.stepCounter}>Adım {step + 1} / {stepCopy.length}</AppText>
        </View>
        <View accessibilityLabel={`Kayıt adımı ${step + 1} / ${stepCopy.length}`} style={styles.progressTrack}>
          {stepCopy.map((item, index) => <View key={item.title} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]} />)}
        </View>
        <ScrollView
          style={styles.contentViewport}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={[styles.transitionContent, { opacity: contentOpacity, transform: [{ translateX: contentTranslateX }] }]}>
          <AppText style={styles.title}>{copy.title}</AppText>
          <AppText style={styles.description}>{copy.description}</AppText>

          {step === 0 ? (
            <UsernameStep
              username={draft.username}
              availability={availability}
              errorMessage={fieldErrors.username ?? usernameFormatError ?? undefined}
              onChange={updateUsername}
            />
          ) : null}
          {step === 1 ? (
            <GenderStep
              value={draft.gender}
              errorMessage={fieldErrors.gender}
              onChange={updateGender}
            />
          ) : null}
          {step === 2 ? (
            <BioStep
              bio={draft.bio}
              errorMessage={fieldErrors.bio}
              onChange={updateBio}
            />
          ) : null}
          {step === 3 ? (
            <PhotoStep
              photo={draft.photo}
              errorMessage={fieldErrors.photo}
              onChange={updatePhoto}
            />
          ) : null}
          {step === 4 ? (
            <ReviewStep
              username={draft.username}
              genderLabel={draft.gender ? genderLabels[draft.gender] : 'Seçilmedi'}
              bio={draft.bio}
              photo={draft.photo}
              onEdit={editReviewStep}
            />
          ) : null}

          {actionError ? (
            <View accessibilityRole="alert" style={styles.actionError}>
              <AlertCircle size={18} color={colors.error} />
              <AppText style={styles.actionErrorText}>{actionError}</AppText>
            </View>
          ) : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.actions}>
          <AppPressable accessibilityRole="button" disabled={isBusy || isSigningOut || isStepAnimating} onPress={goBack} style={[styles.backButton, (isBusy || isSigningOut || isStepAnimating) && styles.disabledButton]}>
            {isSigningOut ? <ActivityIndicator size="small" color={colors.muted} /> : <ArrowLeft size={18} color={colors.muted} />}
            <ButtonLabel style={styles.backLabel}>{isSigningOut ? 'Çıkılıyor…' : 'Geri'}</ButtonLabel>
          </AppPressable>
          <AppPressable
            accessibilityRole="button"
            disabled={!canContinue}
            onPress={continueToNextStep}
            style={[styles.primaryButton, !canContinue && styles.disabledButton]}
          >
            {isBusy ? <ActivityIndicator size="small" color={colors.surface} /> : step === 4 ? <Check size={18} color={colors.surface} /> : <ArrowRight size={18} color={colors.surface} />}
            <ButtonLabel style={styles.primaryButtonText}>{isBusy ? 'Kontrol ediliyor…' : step === 4 ? 'Hesabı oluştur' : 'Devam et'}</ButtonLabel>
          </AppPressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function getApiFieldEntries(error: ApiRequestError): { field?: string; code?: string }[] {
  const entries: { field?: string; code?: string }[] = [{ field: error.field, code: error.code }];
  if (!error.details || typeof error.details !== 'object') return entries;

  const details = error.details as {
    fields?: unknown;
    errors?: unknown;
    field_errors?: unknown;
  };
  if (Array.isArray(details.fields)) {
    for (const field of details.fields) {
      if (typeof field === 'string') entries.push({ field });
    }
  }
  if (Array.isArray(details.errors)) {
    for (const item of details.errors) {
      if (item && typeof item === 'object' && 'field' in item) {
        const issue = item as { field?: unknown; code?: unknown };
        entries.push({
          field: typeof issue.field === 'string' ? issue.field : undefined,
          code: typeof issue.code === 'string' ? issue.code : undefined,
        });
      }
    }
  }
  if (details.field_errors && typeof details.field_errors === 'object') {
    for (const field of Object.keys(details.field_errors)) entries.push({ field });
  }
  return entries;
}

function mapApiField(field?: string, code?: string): OnboardingField | null {
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

function getApiActionMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 409) return 'Kayıt bu sırada değişti. Bilgilerini kontrol edip tekrar dene.';
  if (error instanceof ApiRequestError && error.status === 401) return 'Oturum doğrulanamadı. Yeniden giriş yapıp tekrar dene.';
  return error instanceof Error ? error.message : 'İşlem tamamlanamadı. Tekrar dene.';
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardView: { flex: 1 },
  header: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepCounter: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  progressTrack: { flexDirection: 'row', gap: 6, marginTop: 18 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#E8EAED' },
  progressSegmentActive: { backgroundColor: colors.primary },
  contentViewport: { flex: 1, overflow: 'hidden' },
  scrollContent: { flexGrow: 1, paddingTop: 30, paddingBottom: 22 },
  transitionContent: { flexGrow: 1 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  actionError: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 12, backgroundColor: colors.errorSurface, padding: 12, marginTop: 18 },
  actionErrorText: { flex: 1, color: colors.error, fontSize: 13, lineHeight: 19 },
  actions: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12 },
  backButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  backLabel: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  primaryButton: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 26, backgroundColor: colors.primary, paddingHorizontal: 20 },
  primaryButtonText: { color: colors.surface, fontSize: 15, fontWeight: '600' },
  disabledButton: { opacity: 0.55 },
});
