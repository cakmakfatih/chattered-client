import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { BrandMark } from '../components/BrandMark';
import { ChatIllustration } from '../components/ChatIllustration';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors } from '../theme/colors';

type SignedInScreenProps = {
  onSignOut: () => void;
};

export function SignedInScreen({ onSignOut }: SignedInScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const usableHeight = height - insets.top - insets.bottom;
  const compact = usableHeight < 620;
  const artSize = Math.min(width - 120, usableHeight * (compact ? 0.28 : 0.31), 188);

  return (
    <ScreenContainer contentStyle={styles.content} topPadding={12} bottomPadding={20}>
      <View style={styles.header}>
        <BrandMark />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Çıkış yap"
          onPress={onSignOut}
          hitSlop={10}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        >
          <AppText style={styles.signOutText}>Çıkış</AppText>
        </Pressable>
      </View>

      <View style={[styles.sectionHeading, compact && styles.sectionHeadingCompact]}>
        <AppText style={styles.title}>Sohbetler</AppText>
        <AppText style={styles.subtitle}>Anonim konuşmaların burada.</AppText>
      </View>

      <View style={[styles.emptyState, compact && styles.emptyStateCompact]}>
        <ChatIllustration size={artSize} />
        <AppText style={styles.emptyTitle}>Henüz sohbetin yok</AppText>
        <AppText style={styles.emptyDescription}>
          Yeni bir sohbet başlattığında mesajların burada görünecek.
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signOutButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  signOutText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.6 },
  sectionHeading: { marginTop: 36 },
  sectionHeadingCompact: { marginTop: 24 },
  title: { color: colors.ink, fontSize: 29, lineHeight: 36, letterSpacing: -0.7, fontWeight: '600' },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  emptyStateCompact: { paddingBottom: 8 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '600', marginTop: 22, textAlign: 'center' },
  emptyDescription: { maxWidth: 280, color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 9, textAlign: 'center' },
});
