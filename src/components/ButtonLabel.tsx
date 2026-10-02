import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { AppText } from './AppText';

type ButtonLabelProps = ComponentProps<typeof AppText>;

export function ButtonLabel({ style, ...props }: ButtonLabelProps) {
  return <AppText {...props} style={[styles.label, style]} />;
}

const styles = StyleSheet.create({
  label: { textTransform: 'none' },
});
