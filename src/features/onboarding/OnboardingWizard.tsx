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
import { Snackbar, type SnackbarNotice } from '../../components/Snackbar';
import { colors } from '../../theme/colors';
import { useAuthTransition } from '../auth/AuthTransitionProvider';
import {
  ApiRequestError,
  completeRegistration,
  uploadProfilePhoto,
  validateBiography,
  validatePhoto,
  type RegistrationProfile,
} from './api';
import { getOnboardingActionMessage, getOnboardingFieldErrors } from './onboardingApiErrors';
import { useRegistrationStatus } from './RegistrationStatusProvider';
import type { Gender, OnboardingDraft, OnboardingField, OnboardingFieldErrors, SelectedPhoto } from './types';
import { emptyOnboardingDraft, normalizeBio, toPhotoMetadata } from './types';
import { useUsernameAvailability } from './useUsernameAvailability';
import {
  getBioError,
  getGenderError,
  getPhotoMetadataError,
  getSelectedPhotoError,
  getUsernameFormatError,
  hasRequiredPhotoDimensions,
} from './validation';
import { BioStep, genderLabels, GenderStep, ReviewStep, UsernameStep } from './OnboardingStepContent';
import { PhotoStep } from './PhotoStep';

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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [snackbarNotice, setSnackbarNotice] = useState<SnackbarNotice | null>(null);
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
  const showSnackbar = useCallback((message: string) => {
    setSnackbarNotice((current) => ({ id: (current?.id ?? 0) + 1, message }));
  }, []);
  const dismissSnackbar = useCallback(() => setSnackbarNotice(null), []);

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

  const isInteractionLocked = isBusy || isSigningOut || isStepAnimating;

  const canContinue = useMemo(() => {
    if (isInteractionLocked) return false;
    if (step === 0) return availability.status === 'available' && !fieldErrors.username;
    if (step === 1) return draft.gender !== null && !fieldErrors.gender;
    if (step === 2) return getBioError(draft.bio) === null && !fieldErrors.bio;
    if (step === 3) return (!draft.photo || getSelectedPhotoError(draft.photo) === null) && !fieldErrors.photo;
    return true;
  }, [availability.status, draft.bio, draft.gender, draft.photo, fieldErrors, isInteractionLocked, step]);

  const goBack = useCallback(() => {
    if (isInteractionLocked) return;
    setActionError(null);
    if (step > 0) {
      goToStep(step - 1);
      return;
    }

    void endSession()
      .catch(() => {
        setActionError('Oturum kapatılamadı. Tekrar dene.');
      });
  }, [endSession, goToStep, isInteractionLocked, step]);

  const showFieldErrors = useCallback((errors: OnboardingFieldErrors) => {
    setFieldErrors((current) => ({ ...current, ...errors }));
    goToStep(getEarliestFieldStep(Object.keys(errors) as OnboardingField[]));
  }, [goToStep]);

  const applyApiFieldErrors = useCallback((error: ApiRequestError): boolean => {
    const apiFieldErrors = getOnboardingFieldErrors(error);
    if (apiFieldErrors.length === 0) return false;

    showFieldErrors(Object.fromEntries(apiFieldErrors.map(({ field, message }) => [field, message])));
    setActionError(null);
    return true;
  }, [showFieldErrors]);

  const handleActionError = useCallback((error: unknown) => {
    if (error instanceof ApiRequestError && applyApiFieldErrors(error)) return;
    setActionError(getOnboardingActionMessage(error));
  }, [applyApiFieldErrors]);

  const validateStepOnServer = useCallback(async () => {
    if (step === 2) await validateBiography(normalizeBio(draft.bio), getSessionToken);
    if (step === 3) await validatePhoto(toPhotoMetadata(draft.photo), getSessionToken);
  }, [draft.bio, draft.photo, getSessionToken, step]);

  const validateCurrentStep = useCallback(async () => {
    const localErrors = getStepFieldErrors(step, draft);
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors((current) => ({ ...current, ...localErrors }));
      return;
    }

    setIsBusy(true);
    setActionError(null);
    try {
      await validateStepOnServer();
      goToStep(Math.min(stepCopy.length - 1, step + 1));
    } catch (error) {
      handleActionError(error);
    } finally {
      setIsBusy(false);
    }
  }, [draft, goToStep, handleActionError, step, validateStepOnServer]);

  const finishOnboarding = useCallback((profile: RegistrationProfile) => {
    markComplete(profile);
    router.replace('/');
  }, [markComplete]);

  const createProfile = useCallback(async (gender: Gender, photo: SelectedPhoto | null) => {
    if (photo) {
      setIsUploadingPhoto(true);
      await uploadProfilePhoto(photo, getSessionToken);
      setIsUploadingPhoto(false);
    }
    const result = await completeRegistration({
      username: draft.username,
      gender,
      bio: normalizeBio(draft.bio),
      photo: toPhotoMetadata(photo),
    }, getSessionToken);

    if (!result.registration_complete || !result.user) {
      throw new Error('Kayıt tamamlandı yanıtı geçersiz. Ana ekrana geçiş engellendi.');
    }
    return result.user;
  }, [draft.bio, draft.username, getSessionToken]);

  /** Another attempt may already have finished the registration; if the server confirms it, the user moves on. */
  const recoverCompletedProfile = useCallback(async (error: unknown): Promise<boolean> => {
    if (!(error instanceof ApiRequestError) || error.code !== 'profile_already_complete') return false;
    const registration = await refresh();
    if (registration.status !== 'complete') return false;
    finishOnboarding(registration.profile);
    return true;
  }, [finishOnboarding, refresh]);

  const submitRegistration = useCallback(async () => {
    const photo = getSubmittablePhoto(draft.photo);
    const localErrors = getDraftFieldErrors(draft, photo);
    if (Object.keys(localErrors).length > 0 || !draft.gender) {
      showFieldErrors(localErrors);
      return;
    }

    setIsBusy(true);
    setActionError(null);
    try {
      finishOnboarding(await createProfile(draft.gender, photo));
    } catch (error) {
      if (await recoverCompletedProfile(error)) return;
      handleActionError(error);
    } finally {
      setIsUploadingPhoto(false);
      setIsBusy(false);
    }
  }, [createProfile, draft, finishOnboarding, handleActionError, recoverCompletedProfile, showFieldErrors]);

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
              onPhotoRejected={showSnackbar}
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
          <AppPressable accessibilityRole="button" disabled={isInteractionLocked} onPress={goBack} style={[styles.backButton, isInteractionLocked && styles.disabledButton]}>
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
            <ButtonLabel style={styles.primaryButtonText}>{getPrimaryActionLabel(step, isBusy, isUploadingPhoto)}</ButtonLabel>
          </AppPressable>
        </View>
        <Snackbar notice={snackbarNotice} onDismiss={dismissSnackbar} style={styles.snackbar} />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function getPrimaryActionLabel(step: number, isBusy: boolean, isUploadingPhoto: boolean): string {
  if (isUploadingPhoto) return 'Fotoğraf yükleniyor…';
  if (isBusy) return 'Kontrol ediliyor…';
  return step === stepCopy.length - 1 ? 'Hesabı oluştur' : 'Devam et';
}

function getEarliestFieldStep(fields: OnboardingField[]): number {
  return Math.min(...fields.map((field) => stepOrder[field]));
}

/** A photo that is not a square of at least the minimum size is never sent; the profile is created without it. */
function getSubmittablePhoto(photo: SelectedPhoto | null): SelectedPhoto | null {
  return photo && hasRequiredPhotoDimensions(photo) ? photo : null;
}

function getStepFieldErrors(step: number, draft: OnboardingDraft): OnboardingFieldErrors {
  const bioError = step === 2 ? getBioError(draft.bio) : null;
  if (bioError) return { bio: bioError };
  const photoError = step === 3 && draft.photo ? getSelectedPhotoError(draft.photo) : null;
  return photoError ? { photo: photoError } : {};
}

function getDraftFieldErrors(draft: OnboardingDraft, photo: SelectedPhoto | null): OnboardingFieldErrors {
  const errors: OnboardingFieldErrors = {
    username: getUsernameFormatError(draft.username) ?? undefined,
    gender: getGenderError(draft.gender) ?? undefined,
    bio: getBioError(draft.bio) ?? undefined,
    photo: (photo ? getPhotoMetadataError(photo) : null) ?? undefined,
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined));
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
  snackbar: { bottom: 70 },
});
