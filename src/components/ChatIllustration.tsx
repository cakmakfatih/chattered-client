import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors } from '../theme/colors';

type ChatIllustrationProps = { size: number };

export function ChatIllustration({ size }: ChatIllustrationProps) {
  const dotSize = Math.max(size * 0.035, 5);

  return (
    <View
      style={[styles.art, { width: size, height: size }]}
      accessible
      accessibilityLabel="Anonim sohbet balonları çizimi"
    >
      <View style={styles.artCircle} />
      <View style={[styles.orbit, { width: size * 0.78, height: size * 0.78 }]} />
      <View style={[styles.backBubble, { width: size * 0.48, height: size * 0.31 }]}>
        <View style={styles.bubbleLineWide} />
        <View style={styles.bubbleLineShort} />
        <View style={styles.bubbleTail} />
      </View>
      <View style={[styles.frontBubble, { width: size * 0.53, height: size * 0.34 }]}>
        <View style={styles.dots}>
          <View style={[styles.dot, { width: dotSize, height: dotSize }]} />
          <View style={[styles.dot, { width: dotSize, height: dotSize }]} />
          <View style={[styles.dot, { width: dotSize, height: dotSize }]} />
        </View>
        <View style={styles.frontBubbleTail} />
      </View>
      <View style={styles.anonymousBadge}>
        <AppText style={styles.anonymousMark}>?</AppText>
      </View>
      <View style={styles.sparkle}><AppText style={styles.sparkleText}>✦</AppText></View>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  artCircle: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, backgroundColor: colors.surfaceBlue },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: '#D2E3FC', borderRadius: 999 },
  backBubble: { position: 'absolute', left: '11%', top: '25%', borderRadius: 20, backgroundColor: colors.surface, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: '8%', gap: 8, shadowColor: '#174EA6', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  bubbleLineWide: { width: '65%', height: 7, borderRadius: 4, backgroundColor: '#D2E3FC' },
  bubbleLineShort: { width: '43%', height: 7, borderRadius: 4, backgroundColor: '#E8F0FE' },
  bubbleTail: { position: 'absolute', bottom: -6, left: 19, width: 15, height: 15, borderBottomLeftRadius: 4, backgroundColor: colors.surface, transform: [{ rotate: '-25deg' }] },
  frontBubble: { position: 'absolute', right: '9%', bottom: '24%', borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#174EA6', shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { borderRadius: 99, backgroundColor: colors.surface },
  frontBubbleTail: { position: 'absolute', bottom: -5, right: 20, width: 14, height: 14, borderBottomRightRadius: 4, backgroundColor: colors.primary, transform: [{ rotate: '25deg' }] },
  anonymousBadge: { position: 'absolute', right: '13%', top: '15%', width: '22%', aspectRatio: 1, borderRadius: 999, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.greenSurface, alignItems: 'center', justifyContent: 'center', shadowColor: '#202124', shadowOpacity: 0.1, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  anonymousMark: { color: colors.green, fontSize: 24, fontWeight: '600' },
  sparkle: { position: 'absolute', left: '14%', bottom: '18%', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sparkleText: { color: colors.primary, fontSize: 15 },
});
