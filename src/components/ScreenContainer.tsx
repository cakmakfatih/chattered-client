import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type ScreenContainerProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  topPadding?: number;
  bottomPadding?: number;
  horizontalPadding?: number;
};

export function ScreenContainer({
  children,
  contentStyle,
  topPadding = 16,
  bottomPadding = 16,
  horizontalPadding = 24,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + topPadding,
            paddingBottom: insets.bottom + bottomPadding,
            paddingLeft: insets.left + horizontalPadding,
            paddingRight: insets.right + horizontalPadding,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 440 },
});
