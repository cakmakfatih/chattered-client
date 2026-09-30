import { useMemo, type ComponentProps } from 'react';
import { StyleSheet, Text as NativeText, type TextStyle } from 'react-native';

type AppTextProps = ComponentProps<typeof NativeText>;

export function AppText({ style, ...props }: AppTextProps) {
  const fontFamily = useMemo(() => {
    const weight = (StyleSheet.flatten(style) as TextStyle | undefined)?.fontWeight;

    if (weight === '700' || weight === 'bold') return 'GoogleSansBold';
    if (weight === '600' || weight === 'semibold') return 'GoogleSansSemiBold';
    if (weight === '500' || weight === 'medium') return 'GoogleSansMedium';
    return 'GoogleSansRegular';
  }, [style]);

  return <NativeText {...props} style={[{ fontFamily }, style]} />;
}
