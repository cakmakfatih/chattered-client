import type { ReactNode } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '../../components/AppPressable';
import { AppText } from '../../components/AppText';
import { colors } from '../../theme/colors';
import type { PhotoSourceSheetState } from './usePhotoSourceSheet';

type PhotoSourceSheetProps = {
  sheet: PhotoSourceSheetState;
  onCamera: () => void;
  onGallery: () => void;
};

export function PhotoSourceSheet({ sheet, onCamera, onGallery }: PhotoSourceSheetProps) {
  const insets = useSafeAreaInsets();
  const dismiss = () => sheet.close();

  return (
    <Modal
      animationType="none"
      transparent
      visible={sheet.isMounted}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.sheetModal}>
        <Animated.View pointerEvents="none" style={[styles.sheetBackdrop, { opacity: sheet.backdropOpacity }]} />
        <AppPressable accessibilityRole="button" accessibilityLabel="Fotoğraf seçeneklerini kapat" onPress={dismiss} style={styles.sheetDismissArea} />
        <Animated.View style={[styles.sourceSheet, { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: sheet.sheetTranslateY }] }]}>
          <View style={styles.sheetHandle} />
          <AppText style={styles.sheetTitle}>Profil fotoğrafı ekle</AppText>
          <SheetOption icon={<Camera size={21} color={colors.primary} />} label="Kamera" onPress={onCamera} />
          <SheetOption icon={<ImagePlus size={21} color={colors.primary} />} label="Galeri" onPress={onGallery} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function SheetOption({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <AppPressable accessibilityRole="button" onPress={onPress} style={styles.sheetOption}>
      <View style={styles.sheetOptionIcon}>{icon}</View>
      <AppText style={styles.sheetOptionText}>{label}</AppText>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  sheetModal: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(32, 33, 36, 0.42)' },
  sheetDismissArea: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sourceSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, paddingTop: 10, paddingHorizontal: 20 },
  sheetHandle: { width: 36, height: 4, alignSelf: 'center', borderRadius: 2, backgroundColor: '#DADCE0', marginBottom: 18 },
  sheetTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', marginBottom: 10 },
  sheetOption: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, paddingHorizontal: 8 },
  sheetOptionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBlue },
  sheetOptionText: { color: colors.ink, fontSize: 16, fontWeight: '500' },
});
