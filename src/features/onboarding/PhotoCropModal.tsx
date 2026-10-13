import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { CropZoom, type CropZoomRefType } from 'react-native-zoom-toolkit';
import { Check, X } from 'lucide-react-native';
import { AppPressable } from '../../components/AppPressable';
import { AppText } from '../../components/AppText';
import { ButtonLabel } from '../../components/ButtonLabel';
import { colors } from '../../theme/colors';
import type { CropRect, SourceImage } from './photoProcessing';
import { minPhotoDimension } from './validation';

type PhotoCropModalProps = {
  source: SourceImage | null;
  onCancel: () => void;
  onConfirm: (cropRect: CropRect) => Promise<void>;
};

type ViewportSize = { width: number; height: number };

const maxCropSide = 360;
const cropSideMargin = 48;

/** Mandatory square crop step. Zoom stops before the crop area drops below the minimum photo size. */
export function PhotoCropModal({ source, onCancel, onConfirm }: PhotoCropModalProps) {
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  const cropRef = useRef<CropZoomRefType>(null);
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const cropSide = Math.min(windowSize.width - cropSideMargin, windowSize.height * 0.5, maxCropSide);

  const measureViewport = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  }, []);

  const cancel = useCallback(() => {
    if (!isCropping) onCancel();
  }, [isCropping, onCancel]);

  const confirm = useCallback(async () => {
    const cropResult = cropRef.current?.crop();
    if (!cropResult || isCropping) return;
    setIsCropping(true);
    try {
      await onConfirm(cropResult.crop);
    } finally {
      setIsCropping(false);
    }
  }, [isCropping, onConfirm]);

  return (
    <Modal
      animationType="fade"
      visible={source !== null}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cancel}
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <AppPressable accessibilityRole="button" accessibilityLabel="Kırpmadan vazgeç" disabled={isCropping} onPress={cancel} style={styles.iconButton}>
            <X size={24} color={colors.surface} />
          </AppPressable>
          <AppText style={styles.title}>Fotoğrafı kırp</AppText>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.cropViewport} onLayout={measureViewport}>
          {source ? (
            <CropZoom
              key={source.uri}
              ref={cropRef}
              cropSize={{ width: cropSide, height: cropSide }}
              resolution={{ width: source.width, height: source.height }}
              maxScale={getMaxCropScale(source)}
              scaleMode="clamp"
              panMode="clamp"
              OverlayComponent={() => <CropOverlay viewport={viewport} cropSide={cropSide} />}
            >
              <Image source={{ uri: source.uri }} resizeMode="cover" style={styles.cropImage} />
            </CropZoom>
          ) : null}
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <AppText style={styles.hint}>Sürükleyerek konumlandır, iki parmağınla yakınlaştır.</AppText>
          <View style={styles.actions}>
            <AppPressable accessibilityRole="button" disabled={isCropping} onPress={cancel} style={[styles.secondaryButton, isCropping && styles.disabledButton]}>
              <ButtonLabel style={styles.secondaryLabel}>Vazgeç</ButtonLabel>
            </AppPressable>
            <AppPressable accessibilityRole="button" disabled={isCropping} onPress={() => { void confirm(); }} style={[styles.primaryButton, isCropping && styles.disabledButton]}>
              {isCropping ? <ActivityIndicator size="small" color={colors.surface} /> : <Check size={18} color={colors.surface} />}
              <ButtonLabel style={styles.primaryLabel}>{isCropping ? 'Kırpılıyor…' : 'Kırp ve kullan'}</ButtonLabel>
            </AppPressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * At scale 1 the image's short side fills the crop square, so the cropped side in source pixels is
 * shortSide / scale. Capping the scale keeps that value at or above the minimum photo dimension;
 * the extra pixel absorbs the cropper's rounding down.
 */
function getMaxCropScale(source: SourceImage): number {
  const shortSide = Math.min(source.width, source.height);
  return Math.max(1, shortSide / (minPhotoDimension + 1));
}

function CropOverlay({ viewport, cropSide }: { viewport: ViewportSize | null; cropSide: number }) {
  if (!viewport) return null;

  const { width, height } = viewport;
  const left = (width - cropSide) / 2;
  const top = (height - cropSide) / 2;
  const maskPath = `M0 0H${width}V${height}H0Z M${left} ${top}h${cropSide}v${cropSide}h${-cropSide}Z`;

  return (
    <Svg width={width} height={height}>
      <Path d={maskPath} fill="rgba(0, 0, 0, 0.6)" fillRule="evenodd" />
      <Rect x={left} y={top} width={cropSide} height={cropSide} fill="none" stroke={colors.surface} strokeWidth={1.5} />
      <Circle cx={width / 2} cy={height / 2} r={cropSide / 2} fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth={1} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.surface, fontSize: 17, fontWeight: '600' },
  cropViewport: { flex: 1, overflow: 'hidden' },
  cropImage: { width: '100%', height: '100%' },
  footer: { paddingHorizontal: 24, paddingTop: 16, gap: 16 },
  hint: { color: 'rgba(255, 255, 255, 0.72)', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  secondaryButton: { minHeight: 50, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryLabel: { color: colors.surface, fontSize: 15, fontWeight: '600' },
  primaryButton: { minHeight: 50, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 25, backgroundColor: colors.primary, paddingHorizontal: 20 },
  primaryLabel: { color: colors.surface, fontSize: 15, fontWeight: '600' },
  disabledButton: { opacity: 0.55 },
});
