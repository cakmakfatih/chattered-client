import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AlertCircle, LogIn, RefreshCw } from 'lucide-react-native';
import { AppText } from '../components/AppText';
import { AppPressable } from '../components/AppPressable';
import { BrandMark } from '../components/BrandMark';
import { ButtonLabel } from '../components/ButtonLabel';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors } from '../theme/colors';
import { useAuthTransition } from '../features/auth/AuthTransitionProvider';
import { useRegistrationStatus } from '../features/onboarding/RegistrationStatusProvider';

type RegistrationStatusScreenProps = {
  isUnauthorized: boolean;
  message: string;
};

export function RegistrationStatusScreen({ isUnauthorized, message }: RegistrationStatusScreenProps) {
  const { refresh } = useRegistrationStatus();
  const { endSession, isSigningOut } = useAuthTransition();
  const [isRetrying, setIsRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isBusy = isRetrying || isSigningOut;

  const retry = async () => {
    if (isBusy) return;
    setActionError(null);
    setIsRetrying(true);
    await refresh();
    setIsRetrying(false);
  };

  const signInAgain = async () => {
    if (isBusy) return;
    setActionError(null);
    try {
      await endSession();
    } catch {
      setActionError('Oturum kapatılamadı. Lütfen tekrar deneyin.');
    }
  };

  return (
    <ScreenContainer contentStyle={styles.screen} topPadding={12}>
      <BrandMark />
      <View style={styles.content}>
        <View style={styles.iconCircle}><AlertCircle size={30} color={colors.primary} /></View>
        <AppText style={styles.title}>Kayıt durumu alınamadı</AppText>
        <AppText style={styles.message}>{message}</AppText>
        {actionError ? <AppText accessibilityRole="alert" style={styles.error}>{actionError}</AppText> : null}
        <AppPressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => { void (isUnauthorized ? signInAgain() : retry()); }}
          style={[styles.retryButton, isBusy && styles.disabled]}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : isUnauthorized ? (
            <LogIn size={17} color={colors.surface} />
          ) : (
            <RefreshCw size={17} color={colors.surface} />
          )}
          <ButtonLabel style={styles.retryLabel}>{isUnauthorized ? 'Tekrar giriş yap' : 'Yeniden dene'}</ButtonLabel>
        </AppPressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 36 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceBlue, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: colors.ink, fontSize: 21, fontWeight: '600', textAlign: 'center' },
  message: { maxWidth: 300, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  error: { maxWidth: 300, color: colors.error, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12 },
  retryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 22, marginTop: 24 },
  disabled: { opacity: 0.7 },
  retryLabel: { color: colors.surface, fontSize: 14, fontWeight: '600' },
});
