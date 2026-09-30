import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors } from '../theme/colors';

export function BrandMark() {
  return (
    <View style={styles.brand}>
      <View style={styles.mark}>
        <View style={styles.bubble}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>
      <AppText style={styles.name}>
        Chatter<AppText style={styles.accent}>ed</AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 23, height: 17, borderRadius: 7, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.primary },
  name: { fontSize: 20, fontWeight: '600', letterSpacing: -0.5, color: colors.ink },
  accent: { color: colors.primary },
});
