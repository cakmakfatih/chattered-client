import { useAuth } from '@clerk/expo';
import { useFonts } from '@expo-google-fonts/google-sans-flex';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import RootLayout from '../../app/_layout';
import TabsLayout from '../../app/(tabs)/_layout';
import { useRegistrationStatus } from '../../features/onboarding/RegistrationStatusProvider';
import { colors } from '../../theme/colors';

jest.mock('@clerk/expo', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: jest.fn(),
}));
jest.mock('@clerk/expo/token-cache', () => ({ tokenCache: {} }));
jest.mock('@expo-google-fonts/google-sans-flex', () => ({
  GoogleSansFlex_400Regular: 1,
  GoogleSansFlex_500Medium: 2,
  GoogleSansFlex_600SemiBold: 3,
  GoogleSansFlex_700Bold: 4,
  useFonts: jest.fn(),
}));
jest.mock('../../features/auth/AuthTransitionProvider', () => ({
  AuthTransitionProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../features/onboarding/RegistrationStatusProvider', () => ({
  RegistrationStatusProvider: ({ children }: { children: React.ReactNode }) => children,
  useRegistrationStatus: jest.fn(),
}));
jest.mock('../../components/LoadingView', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return { LoadingView: () => <MockText>loading</MockText> };
});
jest.mock('../../screens/MissingClerkKeyScreen', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return { MissingClerkKeyScreen: () => <MockText>missing-clerk-key</MockText> };
});

type RegistrationStatus = 'loading' | 'incomplete' | 'complete';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function createStubScreen(name: string) {
  return function StubScreen() {
    return <Text>{`screen:${name}`}</Text>;
  };
}

const appRoutes = {
  _layout: RootLayout,
  index: createStubScreen('index'),
  welcome: createStubScreen('welcome'),
  onboarding: createStubScreen('onboarding'),
  callback: createStubScreen('callback'),
  'hosted-auth-callback': createStubScreen('hosted-auth-callback'),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': createStubScreen('explore'),
  '(tabs)/chats': createStubScreen('chats'),
  '(tabs)/profile': createStubScreen('profile'),
};

/** The tab bar cross-fades an active and an inactive copy of each icon; the lucide mock exposes `color:size` as a hint. */
function getIconHints(name: string): string[] {
  return screen.getAllByTestId(`icon-${name}`).map((icon) => String(icon.props.accessibilityHint));
}

function mockSession(isSignedIn: boolean, status: RegistrationStatus = 'loading', isLoaded = true) {
  jest.mocked(useAuth).mockReturnValue({ isLoaded, isSignedIn } as never);
  jest.mocked(useRegistrationStatus).mockReturnValue({ state: { status }, refresh: jest.fn(), markComplete: jest.fn() } as never);
}

/**
 * RNTL 14 renders asynchronously, so the route helpers live on the promise `renderRouter` returns rather than
 * on `screen`. They are copied to a plain object because awaiting the promise itself would drop them.
 */
async function renderApp(initialUrl: string) {
  const app = renderRouter(appRoutes, { initialUrl });
  await app;
  return { getPathname: () => app.getPathname(), getSegments: () => app.getSegments() };
}

beforeEach(() => {
  jest.mocked(useFonts).mockReturnValue([true, null]);
});

afterEach(() => {
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = publishableKey;
  jest.useRealTimers();
});

describe('RootLayout', () => {
  it('waits for the fonts', async () => {
    // Arrange
    jest.mocked(useFonts).mockReturnValue([false, null]);
    mockSession(false);

    // Act
    await renderApp('/');

    // Assert
    expect(screen.getByText('loading')).toBeOnTheScreen();
  });

  it('explains a missing Clerk key', async () => {
    // Arrange
    delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
    mockSession(false);

    // Act
    await renderApp('/');

    // Assert
    expect(screen.getByText('missing-clerk-key')).toBeOnTheScreen();
  });

  it('waits for Clerk before building the navigator', async () => {
    // Arrange
    mockSession(false, 'loading', false);

    // Act
    await renderApp('/');

    // Assert
    expect(screen.getByText('loading')).toBeOnTheScreen();
  });

  it.each(['/', '/callback', '/hosted-auth-callback'])('keeps %s reachable in every state', async (url) => {
    // Arrange
    mockSession(false);

    // Act
    const app = await renderApp(url);

    // Assert
    expect(app.getPathname()).toBe(url);
  });
});

describe('RootLayout guards', () => {
  it.each([
    ['a signed-out user', false, 'loading', true],
    ['a user with a completed registration', true, 'complete', false],
  ] as const)('shows the welcome screen to %s: %p', async (_case, isSignedIn, status, isVisible) => {
    // Arrange
    mockSession(isSignedIn, status);

    // Act
    await renderApp('/welcome');

    // Assert
    expect(screen.queryByText('screen:welcome') !== null).toBe(isVisible);
  });

  it.each([
    ['an incomplete registration', 'incomplete', true],
    ['a completed registration', 'complete', false],
  ] as const)('shows onboarding for %s: %p', async (_case, status, isVisible) => {
    // Arrange
    mockSession(true, status);

    // Act
    await renderApp('/onboarding');

    // Assert
    expect(screen.queryByText('screen:onboarding') !== null).toBe(isVisible);
  });

  it.each([
    [false, 'loading'],
    [true, 'loading'],
    [true, 'incomplete'],
  ] as const)('hides the tabs when signed in is %p and the registration is %p', async (isSignedIn, status) => {
    // Arrange
    mockSession(isSignedIn, status);

    // Act
    await renderApp('/chats');

    // Assert
    expect(screen.queryByText('screen:chats')).toBeNull();
  });
});

describe('TabsLayout', () => {
  it('opens the tabs for a completed registration', async () => {
    // Arrange
    mockSession(true, 'complete');

    // Act
    const app = await renderApp('/chats');

    // Assert
    expect(screen.getByText('screen:chats')).toBeOnTheScreen();
    expect(app.getSegments()).toEqual(['(tabs)', 'chats']);
  });

  it.each(['Sohbetler', 'Keşfet', 'Profil'])('labels the %p tab', async (label) => {
    // Arrange
    mockSession(true, 'complete');

    // Act
    await renderApp('/chats');

    // Assert
    expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it.each(['MessageCircle', 'Compass', 'UserRound'])('draws the %s icon in the active and inactive colours', async (icon) => {
    // Arrange
    mockSession(true, 'complete');

    // Act
    await renderApp('/chats');

    // Assert
    expect(getIconHints(icon).sort()).toEqual([`${colors.primary}:24`, `${colors.muted}:24`].sort());
  });

  it('switches tabs from the tab bar', async () => {
    // Arrange
    mockSession(true, 'complete');
    const app = await renderApp('/chats');

    // Act
    await fireEvent.press(screen.getByLabelText('Profil sekmesi'));

    // Assert
    expect(app.getPathname()).toBe('/profile');
    expect(screen.getByText('screen:profile')).toBeOnTheScreen();
  });
});
