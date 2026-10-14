import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { AppPressable } from '../AppPressable';
import { AppText } from '../AppText';
import { BrandMark } from '../BrandMark';
import { ButtonLabel } from '../ButtonLabel';
import { ChatIllustration } from '../ChatIllustration';
import { LoadingView } from '../LoadingView';
import { ScreenContainer } from '../ScreenContainer';
import { TabPlaceholderScreen } from '../TabPlaceholderScreen';

const insetMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

describe('AppText', () => {
  it.each([
    [undefined, 'GoogleSansRegular'],
    ['400', 'GoogleSansRegular'],
    ['500', 'GoogleSansMedium'],
    ['medium', 'GoogleSansMedium'],
    ['600', 'GoogleSansSemiBold'],
    ['semibold', 'GoogleSansSemiBold'],
    ['700', 'GoogleSansBold'],
    ['bold', 'GoogleSansBold'],
  ] as const)('maps font weight %p to %p', async (fontWeight, fontFamily) => {
    // Arrange
    const style = fontWeight ? { fontWeight } : undefined;

    // Act
    await render(<AppText style={style}>Merhaba</AppText>);

    // Assert
    expect(screen.getByText('Merhaba')).toHaveStyle({ fontFamily });
  });

  it('reads the weight from nested style arrays and keeps the caller styles', async () => {
    // Arrange
    const style = [{ color: 'red' }, [{ fontWeight: '700' as const }]];

    // Act
    await render(<AppText style={style}>Kalın</AppText>);

    // Assert
    expect(screen.getByText('Kalın')).toHaveStyle({ fontFamily: 'GoogleSansBold', color: 'red' });
  });
});

describe('ButtonLabel', () => {
  it('renders text without transforming its case', async () => {
    // Arrange
    const style = { fontWeight: '600' as const };

    // Act
    await render(<ButtonLabel style={style}>Devam et</ButtonLabel>);

    // Assert
    expect(screen.getByText('Devam et')).toHaveStyle({ textTransform: 'none', fontFamily: 'GoogleSansSemiBold' });
  });
});

describe('AppPressable', () => {
  it('forwards presses', async () => {
    // Arrange
    const onPress = jest.fn();
    await render(<AppPressable accessibilityRole="button" onPress={onPress}><Text>Dokun</Text></AppPressable>);

    // Act
    await fireEvent.press(screen.getByRole('button'));

    // Assert
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', async () => {
    // Arrange
    const onPress = jest.fn();
    await render(<AppPressable accessibilityRole="button" disabled onPress={onPress}><Text>Dokun</Text></AppPressable>);

    // Act
    await fireEvent.press(screen.getByRole('button'));

    // Assert
    expect(screen.getByRole('button')).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('BrandMark', () => {
  it('renders the product name', async () => {
    // Arrange
    const brandMark = <BrandMark />;

    // Act
    await render(brandMark);

    // Assert
    expect(screen.getByText('Chattered')).toBeOnTheScreen();
  });
});

describe('ChatIllustration', () => {
  it('is announced as a single image-like element with the requested size', async () => {
    // Arrange
    const size = 200;

    // Act
    await render(<ChatIllustration size={size} />);

    // Assert
    expect(screen.getByLabelText('Anonim sohbet balonları çizimi')).toHaveStyle({ width: 200, height: 200 });
  });
});

describe('LoadingView', () => {
  it('shows a centred activity indicator on the surface colour', async () => {
    // Arrange
    const loadingView = <LoadingView />;

    // Act
    const { toJSON } = await render(loadingView);

    // Assert
    expect(toJSON()).toMatchObject({ props: { style: expect.objectContaining({ backgroundColor: colors.surface }) } });
  });
});

describe('ScreenContainer', () => {
  it('adds the safe area insets to the default padding', async () => {
    // Arrange
    const container = (
      <SafeAreaProvider initialMetrics={insetMetrics}>
        <ScreenContainer><Text>İçerik</Text></ScreenContainer>
      </SafeAreaProvider>
    );

    // Act
    await render(container);

    // Assert
    expect(screen.getByText('İçerik').parent).toHaveStyle({
      paddingTop: 47 + 16,
      paddingBottom: 34 + 16,
      paddingLeft: 24,
      paddingRight: 24,
    });
  });

  it('accepts custom padding and content styles', async () => {
    // Arrange
    const container = (
      <SafeAreaProvider initialMetrics={insetMetrics}>
        <ScreenContainer topPadding={0} bottomPadding={4} horizontalPadding={8} contentStyle={{ gap: 3 }}>
          <Text>İçerik</Text>
        </ScreenContainer>
      </SafeAreaProvider>
    );

    // Act
    await render(container);

    // Assert
    expect(screen.getByText('İçerik').parent).toHaveStyle({
      paddingTop: 47,
      paddingBottom: 38,
      paddingLeft: 8,
      paddingRight: 8,
      gap: 3,
    });
  });
});

describe('TabPlaceholderScreen', () => {
  it('renders the title and description without an action by default', async () => {
    // Arrange
    const placeholder = <TabPlaceholderScreen title="Sohbetler" description="Yakında burada." />;

    // Act
    await render(placeholder);

    // Assert
    expect(screen.getByText('Sohbetler')).toBeOnTheScreen();
    expect(screen.getByText('Yakında burada.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the action when both a label and a handler are given', async () => {
    // Arrange
    const onAction = jest.fn();
    await render(<TabPlaceholderScreen title="Profil" description="Yakında." actionLabel="Çıkış yap" onAction={onAction} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Çıkış yap' }));

    // Assert
    expect(onAction).toHaveBeenCalled();
  });
});

describe('colors', () => {
  it.each(Object.entries(colors))('defines %s as a six digit hex value', (_name, value) => {
    // Arrange
    const hexColorPattern = /^#[0-9A-F]{6}$/;

    // Act
    const isHexColor = hexColorPattern.test(value);

    // Assert
    expect(isHexColor).toBe(true);
  });
});
