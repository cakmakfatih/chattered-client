import { memo, useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '../../components/AppPressable';
import { AppText } from '../../components/AppText';
import { ButtonLabel } from '../../components/ButtonLabel';
import { colors } from '../../theme/colors';
import { PhotoCropModal } from './PhotoCropModal';
import { PhotoSourceSheet } from './PhotoSourceSheet';
import { createSquarePhoto, loadSourceImage, type CropRect, type SourceImage } from './photoProcessing';
import type { SelectedPhoto } from './types';
import { usePhotoSourceSheet } from './usePhotoSourceSheet';
import { getSelectedPhotoError, isPhotoLargeEnough, photoTooSmallMessage } from './validation';

type PhotoSource = 'camera' | 'library';

type PhotoStepProps = {
  photo: SelectedPhoto | null;
  errorMessage?: string;
  onChange: (photo: SelectedPhoto | null) => void;
  onPhotoRejected: (message: string) => void;
};

const pickerOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
const notAnImageMessage = 'Bir fotoğraf dosyası seçmelisin.';
const openFailedMessage = 'Fotoğraf açılamadı. Tekrar deneyebilir veya bu adımı atlayabilirsin.';
const cropFailedMessage = 'Fotoğraf kırpılamadı. Tekrar deneyebilir veya bu adımı atlayabilirsin.';

export const PhotoStep = memo(function PhotoStep({ photo, errorMessage, onChange, onPhotoRejected }: PhotoStepProps) {
  const sourceSheet = usePhotoSourceSheet();
  const [pickerSource, setPickerSource] = useState<PhotoSource | null>(null);
  const [cropSource, setCropSource] = useState<SourceImage | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isPreviewVisible, setPreviewVisible] = useState(false);
  const photoError = photo ? getSelectedPhotoError(photo) : null;

  const choosePhoto = useCallback(async (source: PhotoSource) => {
    if (pickerSource) return;
    setPickerSource(source);
    setSelectionError(null);

    try {
      const asset = await pickImageAsset(source);
      if (!asset) return;
      if (asset.type && asset.type !== 'image') {
        setSelectionError(notAnImageMessage);
        return;
      }

      const sourceImage = await loadSourceImage(asset.uri);
      if (!isPhotoLargeEnough(sourceImage)) {
        onPhotoRejected(photoTooSmallMessage);
        return;
      }
      setCropSource(sourceImage);
    } catch {
      setSelectionError(openFailedMessage);
    } finally {
      setPickerSource(null);
    }
  }, [onPhotoRejected, pickerSource]);

  const cancelCrop = useCallback(() => setCropSource(null), []);

  const applyCrop = useCallback(async (cropRect: CropRect) => {
    if (!cropSource) return;
    try {
      const croppedPhoto = await createSquarePhoto(cropSource, cropRect);
      setCropSource(null);
      if (!isPhotoLargeEnough(croppedPhoto)) {
        onPhotoRejected(photoTooSmallMessage);
        return;
      }
      const croppedPhotoError = getSelectedPhotoError(croppedPhoto);
      setSelectionError(croppedPhotoError);
      if (!croppedPhotoError) onChange(croppedPhoto);
    } catch {
      setCropSource(null);
      setSelectionError(cropFailedMessage);
    }
  }, [cropSource, onChange, onPhotoRejected]);

  const removePhoto = useCallback(() => {
    onChange(null);
    setSelectionError(null);
    setPreviewVisible(false);
  }, [onChange]);

  const { isMounted: isSourceSheetMounted, close: closeSourceSheet } = sourceSheet;
  const openSource = useCallback((source: PhotoSource) => {
    const startPicking = () => { void choosePhoto(source); };
    if (isSourceSheetMounted) {
      closeSourceSheet(startPicking);
      return;
    }
    startPicking();
  }, [choosePhoto, closeSourceSheet, isSourceSheetMounted]);
  const openCamera = useCallback(() => openSource('camera'), [openSource]);
  const openGallery = useCallback(() => openSource('library'), [openSource]);

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
          onPress={sourceSheet.open}
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
      {errorMessage || selectionError || photoError ? (
        <AppText style={[styles.helperText, styles.errorText]}>{errorMessage ?? selectionError ?? photoError}</AppText>
      ) : null}

      <PhotoCropModal source={cropSource} onCancel={cancelCrop} onConfirm={applyCrop} />
      <PhotoSourceSheet sheet={sourceSheet} onCamera={openCamera} onGallery={openGallery} />
      <FullscreenPhotoPreview uri={photo?.uri ?? null} visible={isPreviewVisible} onClose={() => setPreviewVisible(false)} />
    </View>
  );
});

/** Asks for the matching permission and opens the picker; resolves to null when the user denies or cancels. */
async function pickImageAsset(source: PhotoSource): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showPermissionDeniedAlert(permission, source === 'camera' ? 'Kamera' : 'Fotoğraf arşivi');
    return null;
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);
  return result.canceled ? null : result.assets[0] ?? null;
}

function showPermissionDeniedAlert(permission: ImagePicker.PermissionResponse, sourceName: string) {
  Alert.alert(
    'İzin gerekli',
    `${sourceName} erişim izni verilmedi. İzin vermeden de bu adımı atlayabilirsin.`,
    permission.canAskAgain
      ? [{ text: 'Tamam' }]
      : [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Ayarları aç', onPress: () => { void Linking.openSettings(); } },
      ],
  );
}

function FullscreenPhotoPreview({ uri, visible, onClose }: { uri: string | null; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fullscreenPreview}>
        {uri ? <Image source={{ uri }} resizeMode="contain" style={styles.fullscreenImage} /> : null}
        <AppPressable
          accessibilityRole="button"
          accessibilityLabel="Tam ekran önizlemeyi kapat"
          onPress={onClose}
          style={[styles.previewClose, { top: insets.top + 12 }]}
        >
          <X size={24} color={colors.surface} />
        </AppPressable>
      </View>
    </Modal>
  );
}

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

const styles = StyleSheet.create({
  stepContent: { paddingTop: 26 },
  helperText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  errorText: { color: colors.error },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F3F4', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  photoPreviewWrap: { alignSelf: 'center', position: 'relative', marginBottom: 12 },
  photoPreview: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F3F4' },
  removePhoto: { position: 'absolute', right: 0, top: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  photoOptional: { color: colors.ink, fontSize: 14, textAlign: 'center', marginBottom: 18 },
  photoActions: { flexDirection: 'row', gap: 12 },
  pickerButton: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.surfaceBlue, borderRadius: 23, paddingHorizontal: 12 },
  buttonDisabled: { opacity: 0.55 },
  pickerButtonText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  fullscreenPreview: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
  previewClose: { position: 'absolute', right: 18, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(32, 33, 36, 0.72)' },
});
