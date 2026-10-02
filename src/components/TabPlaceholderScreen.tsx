import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { BrandMark } from './BrandMark';
import { ScreenContainer } from './ScreenContainer';
import { colors } from '../theme/colors';

type TabPlaceholderScreenProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function TabPlaceholderScreen({ title, description, actionLabel, onAction }: TabPlaceholderScreenProps) {
  return (
    <ScreenContainer contentStyle={styles.screen} topPadding={12}>
      <BrandMark />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <View style={styles.bubble}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>
        <AppText style={styles.title}>{title}</AppText>
        <AppText style={styles.description}>{description}</AppText>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
          >
            <AppText style={styles.actionLabel}>{actionLabel}</AppText>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 36 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceBlue, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  bubble: { width: 35, height: 25, borderRadius: 10, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.surface },
  title: { color: colors.ink, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  description: { maxWidth: 290, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9 },
  actionButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 22, borderRadius: 23, backgroundColor: colors.surfaceBlue, marginTop: 24 },
  actionPressed: { opacity: 0.7 },
  actionLabel: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
