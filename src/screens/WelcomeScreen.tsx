import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText } from '../components/AppText';
import { AppPressable } from '../components/AppPressable';
import { BrandMark } from '../components/BrandMark';
import { ButtonLabel } from '../components/ButtonLabel';
import { ChatIllustration } from '../components/ChatIllustration';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors } from '../theme/colors';

type WelcomeScreenProps = {
  isBusy?: boolean;
  errorMessage?: string | null;
  onSignUp: () => void;
  onSignIn: () => void;
};

export function WelcomeScreen({ isBusy = false, errorMessage, onSignUp, onSignIn }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const usableHeight = height - insets.top - insets.bottom;
  const compact = usableHeight < 680;
  const artSize = Math.min(width - 80, usableHeight * (compact ? 0.31 : 0.34), 254);

  return (
    <ScreenContainer contentStyle={styles.page} topPadding={8} bottomPadding={16}>
        <BrandMark />

        <View style={styles.main}>
          <ChatIllustration size={artSize} />
          <View style={[styles.message, compact && styles.messageCompact]}>
            <AppText style={styles.kicker}>Chattered’a hoş geldin</AppText>
            <AppText style={[styles.title, compact && styles.titleCompact]}>Anonim sohbet, gerçek bağlar.</AppText>
            <AppText style={[styles.description, compact && styles.descriptionCompact]}>
              Kimliğini paylaşmadan yeni insanlarla konuş, aklından geçenleri özgürce anlat.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          {errorMessage ? <AppText accessibilityRole="alert" style={styles.error}>{errorMessage}</AppText> : null}
          <AppPressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onSignUp}
            style={[styles.primaryButton, isBusy && styles.buttonBusy]}
          >
            {isBusy ? <ActivityIndicator color={colors.surface} /> : <ButtonLabel style={styles.primaryButtonText}>Sohbete katıl</ButtonLabel>}
          </AppPressable>
          <AppText style={styles.authHint}>Google hesabınla veya e-postanla devam et.</AppText>
          <AppPressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onSignIn}
            hitSlop={10}
            style={styles.signInButton}
          >
            <AppText style={styles.signInText}>Zaten Chattered’da mısın? <ButtonLabel style={styles.signInLink}>Giriş yap</ButtonLabel></AppText>
          </AppPressable>
        </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center' },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { width: '100%', alignItems: 'center', marginTop: 30 },
  messageCompact: { marginTop: 17 },
  kicker: { color: colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  title: { maxWidth: 340, color: colors.ink, textAlign: 'center', fontSize: 32, lineHeight: 38, letterSpacing: -0.9, fontWeight: '600' },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  description: { maxWidth: 320, marginTop: 11, color: colors.muted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  descriptionCompact: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  actions: { width: '100%', paddingTop: 12 },
  primaryButton: { height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonBusy: { opacity: 0.8 },
  primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: '600' },
  authHint: { color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: 8 },
  error: { color: colors.error, backgroundColor: colors.errorSurface, borderRadius: 12, fontSize: 13, padding: 12, marginBottom: 12 },
  signInButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  signInText: { color: colors.muted, fontSize: 14 },
  signInLink: { color: colors.primary, fontWeight: '600' },
});
