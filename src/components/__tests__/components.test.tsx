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
    await render(<AppText style={fontWeight ? { fontWeight } : undefined}>Merhaba</AppText>);

    expect(screen.getByText('Merhaba')).toHaveStyle({ fontFamily });
  });

  it('reads the weight from nested style arrays and keeps the caller styles', async () => {
    await render(<AppText style={[{ color: 'red' }, [{ fontWeight: '700' }]]}>Kalın</AppText>);

    expect(screen.getByText('Kalın')).toHaveStyle({ fontFamily: 'GoogleSansBold', color: 'red' });
  });
});

describe('ButtonLabel', () => {
  it('renders text without transforming its case', async () => {
    await render(<ButtonLabel style={{ fontWeight: '600' }}>Devam et</ButtonLabel>);

    expect(screen.getByText('Devam et')).toHaveStyle({ textTransform: 'none', fontFamily: 'GoogleSansSemiBold' });
  });
});

describe('AppPressable', () => {
  it('forwards presses', async () => {
    const onPress = jest.fn();
    await render(<AppPressable accessibilityRole="button" onPress={onPress}><Text>Dokun</Text></AppPressable>);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', async () => {
    const onPress = jest.fn();
    await render(<AppPressable accessibilityRole="button" disabled onPress={onPress}><Text>Dokun</Text></AppPressable>);

    await fireEvent.press(screen.getByRole('button'));

    expect(screen.getByRole('button')).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('BrandMark', () => {
  it('renders the product name', async () => {
    await render(<BrandMark />);

    expect(screen.getByText('Chattered')).toBeOnTheScreen();
  });
});

describe('ChatIllustration', () => {
  it('is announced as a single image-like element with the requested size', async () => {
    await render(<ChatIllustration size={200} />);

    expect(screen.getByLabelText('Anonim sohbet balonları çizimi')).toHaveStyle({ width: 200, height: 200 });
  });
});

describe('LoadingView', () => {
  it('shows a centred activity indicator on the surface colour', async () => {
    const { toJSON } = await render(<LoadingView />);

    expect(toJSON()).toMatchObject({ props: { style: expect.objectContaining({ backgroundColor: colors.surface }) } });
  });
});

describe('ScreenContainer', () => {
  it('adds the safe area insets to the default padding', async () => {
    await render(
      <SafeAreaProvider initialMetrics={insetMetrics}>
        <ScreenContainer><Text>İçerik</Text></ScreenContainer>
      </SafeAreaProvider>,
    );

    expect(screen.getByText('İçerik').parent).toHaveStyle({
      paddingTop: 47 + 16,
      paddingBottom: 34 + 16,
      paddingLeft: 24,
      paddingRight: 24,
    });
  });

  it('accepts custom padding and content styles', async () => {
    await render(
      <SafeAreaProvider initialMetrics={insetMetrics}>
        <ScreenContainer topPadding={0} bottomPadding={4} horizontalPadding={8} contentStyle={{ gap: 3 }}>
          <Text>İçerik</Text>
        </ScreenContainer>
      </SafeAreaProvider>,
    );

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
    await render(<TabPlaceholderScreen title="Sohbetler" description="Yakında burada." />);

    expect(screen.getByText('Sohbetler')).toBeOnTheScreen();
    expect(screen.getByText('Yakında burada.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the action when both a label and a handler are given', async () => {
    const onAction = jest.fn();
    await render(<TabPlaceholderScreen title="Profil" description="Yakında." actionLabel="Çıkış yap" onAction={onAction} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Çıkış yap' }));

    expect(onAction).toHaveBeenCalled();
  });
});

describe('colors', () => {
  it('defines every theme colour as a six digit hex value', () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
