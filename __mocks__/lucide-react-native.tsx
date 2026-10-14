import { View } from 'react-native';

/** Jest loads this manual mock as CommonJS; it is never part of the app bundle. */
declare const module: { exports: unknown };

type IconMockProps = { color?: string; size?: number };

const iconCache = new Map<string, (props: IconMockProps) => React.JSX.Element>();

function createIcon(name: string) {
  function IconMock({ color, size }: IconMockProps) {
    return <View testID={`icon-${name}`} accessibilityHint={`${color ?? ''}:${size ?? ''}`} />;
  }
  IconMock.displayName = name;
  return IconMock;
}

/** Lightweight stand-in for the full icon set: every named import resolves to a tagged empty view. */
module.exports = new Proxy({ __esModule: true }, {
  get(target, property) {
    if (property in target) return target[property as keyof typeof target];
    const name = String(property);
    if (!iconCache.has(name)) iconCache.set(name, createIcon(name));
    return iconCache.get(name);
  },
});
