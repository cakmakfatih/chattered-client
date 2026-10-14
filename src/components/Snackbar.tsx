import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppPressable } from './AppPressable';
import { AppText } from './AppText';
import { ButtonLabel } from './ButtonLabel';
import { colors } from '../theme/colors';

export type SnackbarNotice = {
  id: number;
  message: string;
};

type SnackbarProps = {
  notice: SnackbarNotice | null;
  onDismiss: () => void;
  durationMilliseconds?: number;
  style?: StyleProp<ViewStyle>;
};

const defaultDurationMilliseconds = 4_000;

/** Material-style snackbar: a brief, non-blocking message with a dismiss action. */
export function Snackbar({ notice, onDismiss, durationMilliseconds = defaultDurationMilliseconds, style }: SnackbarProps) {
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!notice) return undefined;

    entrance.setValue(0);
    const animation = Animated.timing(entrance, { toValue: 1, duration: 180, useNativeDriver: true });
    animation.start();
    AccessibilityInfo.announceForAccessibility(notice.message);
    const dismissTimer = setTimeout(onDismiss, durationMilliseconds);
    return () => {
      animation.stop();
      clearTimeout(dismissTimer);
    };
  }, [durationMilliseconds, entrance, notice, onDismiss]);

  if (!notice) return null;

  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.snackbar, { opacity: entrance, transform: [{ translateY }] }, style]}
    >
      <AppText style={styles.message}>{notice.message}</AppText>
      <AppPressable accessibilityRole="button" hitSlop={8} onPress={onDismiss} style={styles.action}>
        <ButtonLabel style={styles.actionLabel}>Tamam</ButtonLabel>
      </AppPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 4,
    backgroundColor: '#313033',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  message: { flex: 1, color: '#F4EFF4', fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  actionLabel: { color: colors.window, fontSize: 14, fontWeight: '600' },
});
