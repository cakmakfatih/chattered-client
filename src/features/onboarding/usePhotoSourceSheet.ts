import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

const hiddenSheetOffset = 280;

export type PhotoSourceSheetState = ReturnType<typeof usePhotoSourceSheet>;

/**
 * Drives the photo source bottom sheet. The sheet stays mounted while it slides out, and `close` can defer an
 * action, such as opening the camera, until the sheet is fully gone so two modals never overlap.
 */
export function usePhotoSourceSheet() {
  const [isMounted, setMounted] = useState(false);
  const [isVisible, setVisible] = useState(false);
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(hiddenSheetOffset));
  const onClosed = useRef<(() => void) | null>(null);

  const open = useCallback(() => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(hiddenSheetOffset);
    onClosed.current = null;
    setMounted(true);
    setVisible(true);
  }, [backdropOpacity, sheetTranslateY]);

  const close = useCallback((afterClose?: () => void) => {
    onClosed.current = afterClose ?? null;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!isMounted) return undefined;

    const animation = createSheetAnimation(isVisible, backdropOpacity, sheetTranslateY);
    animation.start(({ finished }) => {
      if (!finished || isVisible) return;
      setMounted(false);
      onClosed.current?.();
      onClosed.current = null;
    });

    return () => animation.stop();
  }, [backdropOpacity, isMounted, isVisible, sheetTranslateY]);

  return { isMounted, backdropOpacity, sheetTranslateY, open, close };
}

function createSheetAnimation(isVisible: boolean, backdropOpacity: Animated.Value, sheetTranslateY: Animated.Value) {
  return Animated.parallel(isVisible
    ? [
      Animated.timing(backdropOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]
    : [
      Animated.timing(backdropOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: hiddenSheetOffset, duration: 220, useNativeDriver: true }),
    ]);
}
