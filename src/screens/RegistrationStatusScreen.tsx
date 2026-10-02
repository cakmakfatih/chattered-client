import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { AppText } from '../components/AppText';
import { AppPressable } from '../components/AppPressable';
import { BrandMark } from '../components/BrandMark';
import { ButtonLabel } from '../components/ButtonLabel';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors } from '../theme/colors';
import { useRegistrationStatus } from '../features/onboarding/RegistrationStatusProvider';

export function RegistrationStatusScreen({ message }: { message: string }) {
  const { refresh } = useRegistrationStatus();
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    await refresh();
    setIsRetrying(false);
  };

  return (
    <ScreenContainer contentStyle={styles.screen} topPadding={12}>
      <BrandMark />
      <View style={styles.content}>
        <View style={styles.iconCircle}><AlertCircle size={30} color={colors.primary} /></View>
        <AppText style={styles.title}>Kayıt durumu alınamadı</AppText>
        <AppText style={styles.message}>{message}</AppText>
        <AppPressable accessibilityRole="button" disabled={isRetrying} onPress={() => { void retry(); }} style={[styles.retryButton, isRetrying && styles.disabled]}>
          {isRetrying ? <ActivityIndicator size="small" color={colors.surface} /> : <RefreshCw size={17} color={colors.surface} />}
          <ButtonLabel style={styles.retryLabel}>Yeniden dene</ButtonLabel>
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
  retryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 22, marginTop: 24 },
  disabled: { opacity: 0.7 },
  retryLabel: { color: colors.surface, fontSize: 14, fontWeight: '600' },
});
