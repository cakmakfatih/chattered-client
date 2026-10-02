import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';

type AppPressableProps = Omit<TouchableOpacityProps, 'activeOpacity'>;

export function AppPressable(props: AppPressableProps) {
  return <TouchableOpacity activeOpacity={0.82} {...props} />;
}
