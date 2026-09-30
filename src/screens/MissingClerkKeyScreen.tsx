import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { BrandMark } from '../components/BrandMark';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors } from '../theme/colors';

export function MissingClerkKeyScreen() {
  return (
    <ScreenContainer contentStyle={styles.content}>
        <BrandMark />
        <View style={styles.message}>
          <AppText style={styles.title}>Clerk yapılandırması eksik</AppText>
          <AppText style={styles.description}>
            mobile/.env.example dosyasını mobile/.env olarak kopyalayıp Clerk publishable key değerini ekleyin.
          </AppText>
        </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  message: { flex: 1, justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 24, fontWeight: '600', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
});
