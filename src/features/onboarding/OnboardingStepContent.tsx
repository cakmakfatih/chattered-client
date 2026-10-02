import { memo, useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ChevronRight, ImagePlus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '../../components/AppPressable';
import { AppText } from '../../components/AppText';
import { ButtonLabel } from '../../components/ButtonLabel';
import { colors } from '../../theme/colors';
import type { Gender, SelectedPhoto } from './types';
import { getBioError, getPhotoMetadataError } from './validation';
import { isUsernameAvailable, isUsernameCheckPending, type useUsernameAvailability } from './useUsernameAvailability';

type Availability = ReturnType<typeof useUsernameAvailability>;

export const genderOptions: { value: Gender; label: string; description: string }[] = [
  { value: 'female', label: 'Kadın', description: 'Kadın olarak tanımlıyorum' },
  { value: 'male', label: 'Erkek', description: 'Erkek olarak tanımlıyorum' },
  { value: 'other', label: 'Diğer', description: 'Farklı bir şekilde tanımlıyorum' },
];

export const genderLabels: Record<Gender, string> = {
  female: 'Kadın',
  male: 'Erkek',
  other: 'Diğer',
};

export const UsernameStep = memo(function UsernameStep({
  username,
  availability,
  errorMessage,
  onChange,
}: {
  username: string;
  availability: Availability;
  errorMessage?: string;
  onChange: (value: string) => void;
}) {
  const available = isUsernameAvailable(availability.status);
  const checking = isUsernameCheckPending(availability.status);
  const availabilityText = availability.status === 'error'
    ? availability.message ?? 'Kullanıcı adı şu an kontrol edilemedi.'
    : availability.status === 'available'
      ? 'Bu kullanıcı adı uygun.'
      : availability.status === 'taken'
        ? 'Bu kullanıcı adı kullanımda.'
        : checking
          ? 'Kullanıcı adı kontrol ediliyor…'
          : '3–30 karakter; küçük harf, rakam ve alt çizgi kullan.';

  return (
    <View style={styles.stepContent}>
      <AppText style={styles.fieldLabel}>Kullanıcı adın</AppText>
      <View style={[styles.usernameField, (errorMessage || availability.status === 'taken') && styles.fieldInvalid, available && styles.fieldValid]}>
        <AppText style={styles.usernamePrefix}>@</AppText>
        <TextInput
          accessibilityLabel="Kullanıcı adı"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={30}
          onChangeText={onChange}
          placeholder="ornek_kullanici"
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          selectionColor={colors.primary}
          spellCheck={false}
          style={styles.usernameInput}
          value={username}
        />
        {checking ? <ActivityIndicator size="small" color={colors.muted} /> : available ? <Check size={20} color={colors.green} /> : null}
      </View>
      <AppText style={[styles.helperText, (errorMessage || availability.status === 'taken' || availability.status === 'error') && styles.errorText, available && styles.successText]}>
        {errorMessage ?? availabilityText}
      </AppText>
      {availability.status === 'error' ? (
        <AppPressable accessibilityRole="button" onPress={availability.retry} hitSlop={8} style={styles.retryLink}>
          <ButtonLabel style={styles.retryText}>Tekrar kontrol et</ButtonLabel>
        </AppPressable>
      ) : null}
    </View>
  );
});

export const GenderStep = memo(function GenderStep({
  value,
  errorMessage,
  onChange,
}: {
  value: Gender | null;
  errorMessage?: string;
  onChange: (value: Gender) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <AppText style={styles.fieldLabel}>Kendini nasıl tanımlıyorsun?</AppText>
      <View style={styles.options}>
        {genderOptions.map((option) => {
          const selected = value === option.value;
          return (
            <AppPressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={[styles.genderOption, selected && styles.genderOptionSelected]}
            >
              <View style={styles.optionCopy}>
                <AppText style={styles.optionTitle}>{option.label}</AppText>
                <AppText style={styles.optionDescription}>{option.description}</AppText>
              </View>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
            </AppPressable>
          );
        })}
      </View>
      {errorMessage ? <AppText style={[styles.helperText, styles.errorText]}>{errorMessage}</AppText> : null}
    </View>
  );
});

export const BioStep = memo(function BioStep({
  bio,
  errorMessage,
  onChange,
}: {
  bio: string;
  errorMessage?: string;
  onChange: (value: string) => void;
}) {
  const localError = errorMessage ?? getBioError(bio);
  const characterCount = Array.from(bio).length;

  return (
    <View style={styles.stepContent}>
      <AppText style={styles.fieldLabel}>Seni anlatan birkaç şey</AppText>
      <TextInput
        accessibilityLabel="Biyografi"
        multiline
        onChangeText={onChange}
        placeholder="İlgi alanların, sevdiğin şeyler veya seni anlatan birkaç kelime…"
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        style={[styles.bioInput, localError && styles.fieldInvalid]}
        textAlignVertical="top"
        value={bio}
      />
      <View style={styles.bioMeta}>
        <AppText style={[styles.helperText, localError && styles.errorText]}>
          {localError ?? 'İstersen boş bırakabilirsin.'}
        </AppText>
        <AppText style={[styles.characterCount, characterCount > 750 && styles.errorText]}>{characterCount}/750</AppText>
      </View>
    </View>
  );
});

export const PhotoStep = memo(function PhotoStep({
  photo,
  onChange,
}: {
  photo: SelectedPhoto | null;
  onChange: (photo: SelectedPhoto | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [pickerSource, setPickerSource] = useState<'camera' | 'library' | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isSourceSheetVisible, setSourceSheetVisible] = useState(false);
  const [isPreviewVisible, setPreviewVisible] = useState(false);
  const metadataError = photo ? getPhotoMetadataError(photo) : null;

  const handlePermissionDenied = useCallback((permission: ImagePicker.PermissionResponse, sourceName: string) => {
    const message = `${sourceName} erişim izni verilmedi. İzin vermeden de bu adımı atlayabilirsin.`;
    Alert.alert(
      'İzin gerekli',
      message,
      permission.canAskAgain
        ? [{ text: 'Tamam' }]
        : [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Ayarları aç', onPress: () => { void Linking.openSettings(); } },
        ],
    );
  }, []);

  const choosePhoto = useCallback(async (source: 'camera' | 'library') => {
    if (pickerSource) return;
    setPickerSource(source);
    setSelectionError(null);

    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        handlePermissionDenied(permission, source === 'camera' ? 'Kamera' : 'Fotoğraf arşivi');
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      if (asset.type && asset.type !== 'image') {
        setSelectionError('Bir fotoğraf dosyası seçmelisin.');
        return;
      }
      if (!asset.fileSize) {
        setSelectionError('Fotoğrafın boyutu okunamadı. Başka bir fotoğraf seçmeyi dene.');
        return;
      }

      const photoName = getPhotoFileName(asset.fileName, asset.uri, asset.mimeType);
      const mimeType = asset.mimeType ?? mimeTypeFromName(photoName) ?? '';
      onChange({ file_name: photoName, mime_type: mimeType, size_bytes: asset.fileSize, uri: asset.uri });
    } catch {
      setSelectionError('Fotoğraf açılamadı. Tekrar deneyebilir veya bu adımı atlayabilirsin.');
    } finally {
      setPickerSource(null);
    }
  }, [handlePermissionDenied, onChange, pickerSource]);

  const removePhoto = useCallback(() => {
    onChange(null);
    setSelectionError(null);
    setPreviewVisible(false);
  }, [onChange]);

  const openCamera = useCallback(() => {
    setSourceSheetVisible(false);
    void choosePhoto('camera');
  }, [choosePhoto]);

  const openGallery = useCallback(() => {
    setSourceSheetVisible(false);
    void choosePhoto('library');
  }, [choosePhoto]);

  return (
    <View style={styles.stepContent}>
      {photo ? (
        <View style={styles.photoPreviewWrap}>
          <AppPressable accessibilityRole="button" accessibilityLabel="Profil fotoğrafını tam ekran görüntüle" onPress={() => setPreviewVisible(true)}>
            <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
          </AppPressable>
          <AppPressable accessibilityRole="button" accessibilityLabel="Fotoğrafı kaldır" onPress={removePhoto} style={styles.removePhoto}>
            <X size={16} color={colors.surface} />
          </AppPressable>
        </View>
      ) : (
        <AppPressable
          accessibilityRole="button"
          accessibilityLabel="Profil fotoğrafı ekle"
          onPress={() => setSourceSheetVisible(true)}
          style={styles.photoPlaceholder}
        >
          <ImagePlus size={32} color={colors.muted} />
        </AppPressable>
      )}
      <AppText style={styles.photoOptional}>Profil fotoğrafı eklemek isteğe bağlı.</AppText>
      <View style={styles.photoActions}>
        <PickerButton
          icon={<Camera size={18} color={colors.primary} />}
          label="Kamera"
          loading={pickerSource === 'camera'}
          disabled={pickerSource !== null}
          onPress={openCamera}
        />
        <PickerButton
          icon={<ImagePlus size={18} color={colors.primary} />}
          label="Galeri"
          loading={pickerSource === 'library'}
          disabled={pickerSource !== null}
          onPress={openGallery}
        />
      </View>
      {selectionError || metadataError ? (
        <AppText style={[styles.helperText, styles.errorText]}>{selectionError ?? metadataError}</AppText>
      ) : null}

      <Modal
        animationType="slide"
        transparent
        visible={isSourceSheetVisible}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setSourceSheetVisible(false)}
      >
        <View style={styles.sheetModal}>
          <AppPressable accessibilityRole="button" accessibilityLabel="Fotoğraf seçeneklerini kapat" onPress={() => setSourceSheetVisible(false)} style={styles.sheetBackdrop} />
          <View style={[styles.sourceSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <AppText style={styles.sheetTitle}>Profil fotoğrafı ekle</AppText>
            <AppPressable accessibilityRole="button" onPress={openCamera} style={styles.sheetOption}>
              <View style={styles.sheetOptionIcon}><Camera size={21} color={colors.primary} /></View>
              <AppText style={styles.sheetOptionText}>Kamera</AppText>
            </AppPressable>
            <AppPressable accessibilityRole="button" onPress={openGallery} style={styles.sheetOption}>
              <View style={styles.sheetOptionIcon}><ImagePlus size={21} color={colors.primary} /></View>
              <AppText style={styles.sheetOptionText}>Galeri</AppText>
            </AppPressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        visible={isPreviewVisible}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.fullscreenPreview}>
          {photo ? <Image source={{ uri: photo.uri }} resizeMode="contain" style={styles.fullscreenImage} /> : null}
          <AppPressable
            accessibilityRole="button"
            accessibilityLabel="Tam ekran önizlemeyi kapat"
            onPress={() => setPreviewVisible(false)}
            style={[styles.previewClose, { top: insets.top + 12 }]}
          >
            <X size={24} color={colors.surface} />
          </AppPressable>
        </View>
      </Modal>
    </View>
  );
});

function PickerButton({
  icon,
  label,
  loading,
  disabled,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <AppPressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.pickerButton, disabled && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : icon}
      <ButtonLabel style={styles.pickerButtonText}>{label}</ButtonLabel>
    </AppPressable>
  );
}

function getPhotoFileName(fileName: string | null | undefined, uri: string, mimeType?: string): string {
  const uriPath = uri.split(/[?#]/, 1)[0] ?? uri;
  const uriName = uriPath.split(/[\\/]/).pop() ?? '';
  const candidate = (fileName || uriName).split(/[\\/]/).pop() ?? '';
  if (candidate.includes('.')) return candidate;
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/heic' ? 'heic' : mimeType === 'image/jpeg' ? 'jpg' : '';
  return extension ? `profile-photo.${extension}` : candidate;
}

function mimeTypeFromName(fileName: string): string | null {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'heic') return 'image/heic';
  return null;
}

export const ReviewStep = memo(function ReviewStep({
  username,
  genderLabel,
  bio,
  photo,
  onEdit,
}: {
  username: string;
  genderLabel: string;
  bio: string;
  photo: SelectedPhoto | null;
  onEdit: (step: number) => void;
}) {
  return (
    <View style={styles.reviewList}>
      <ReviewRow label="Kullanıcı adı" value={`@${username}`} onPress={() => onEdit(0)} />
      <ReviewRow label="Cinsiyet" value={genderLabel} onPress={() => onEdit(1)} />
      <ReviewRow label="Biyografi" value={bio || 'Eklenmedi'} onPress={() => onEdit(2)} />
      <AppPressable accessibilityRole="button" accessibilityLabel="Profil fotoğrafı bilgisini düzenle" onPress={() => onEdit(3)} style={styles.reviewRow}>
        <AppText style={styles.reviewLabel}>Profil fotoğrafı</AppText>
        <View style={styles.reviewValueGroup}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.reviewPhoto} /> : <AppText style={styles.reviewValue}>Eklenmedi</AppText>}
          <ChevronRight size={17} color={colors.muted} />
        </View>
      </AppPressable>
    </View>
  );
});

function ReviewRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <AppPressable accessibilityRole="button" accessibilityLabel={`${label} bilgisini düzenle`} onPress={onPress} style={styles.reviewRow}>
      <AppText style={styles.reviewLabel}>{label}</AppText>
      <View style={styles.reviewValueGroup}>
        <AppText style={styles.reviewValue}>{value}</AppText>
        <ChevronRight size={17} color={colors.muted} />
      </View>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  stepContent: { paddingTop: 26 },
  fieldLabel: { color: colors.ink, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  usernameField: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#DADCE0', borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 16 },
  fieldInvalid: { borderColor: colors.error },
  fieldValid: { borderColor: colors.green },
  usernamePrefix: { color: colors.muted, fontSize: 17 },
  usernameInput: { flex: 1, minWidth: 0, height: 54, color: colors.ink, fontSize: 16, fontFamily: 'GoogleSansRegular', paddingVertical: 0 },
  helperText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  errorText: { color: colors.error },
  successText: { color: colors.green },
  retryLink: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  options: { gap: 10 },
  genderOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#DADCE0', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  genderOptionSelected: { borderColor: colors.primary, backgroundColor: '#F7FAFF' },
  optionCopy: { flex: 1, paddingRight: 12 },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  optionDescription: { color: colors.muted, fontSize: 12, marginTop: 4 },
  radioOuter: { width: 20, height: 20, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  bioInput: { minHeight: 156, borderWidth: 1, borderColor: '#DADCE0', borderRadius: 16, color: colors.ink, fontSize: 15, lineHeight: 22, padding: 15, fontFamily: 'GoogleSansRegular' },
  bioMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  characterCount: { color: colors.muted, fontSize: 12, marginTop: 8 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F3F4', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  photoPreviewWrap: { alignSelf: 'center', position: 'relative', marginBottom: 12 },
  photoPreview: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F3F4' },
  removePhoto: { position: 'absolute', right: 0, top: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  photoOptional: { color: colors.ink, fontSize: 14, textAlign: 'center', marginBottom: 18 },
  photoActions: { flexDirection: 'row', gap: 12 },
  pickerButton: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.surfaceBlue, borderRadius: 23, paddingHorizontal: 12 },
  buttonDisabled: { opacity: 0.55 },
  pickerButtonText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  sheetModal: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(32, 33, 36, 0.42)' },
  sourceSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, paddingTop: 10, paddingHorizontal: 20 },
  sheetHandle: { width: 36, height: 4, alignSelf: 'center', borderRadius: 2, backgroundColor: '#DADCE0', marginBottom: 18 },
  sheetTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', marginBottom: 10 },
  sheetOption: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, paddingHorizontal: 8 },
  sheetOptionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBlue },
  sheetOptionText: { color: colors.ink, fontSize: 16, fontWeight: '500' },
  fullscreenPreview: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
  previewClose: { position: 'absolute', right: 18, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(32, 33, 36, 0.72)' },
  reviewList: { paddingTop: 22 },
  reviewRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceBlue },
  reviewValueGroup: { maxWidth: '70%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewLabel: { color: colors.muted, fontSize: 13 },
  reviewValue: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '500', textAlign: 'right' },
  reviewPhoto: { width: 42, height: 42, borderRadius: 21 },
});
