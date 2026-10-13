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
  const { Text: MockText } = require('react-native');
  return { LoadingView: () => <MockText>loading</MockText> };
});
jest.mock('../../screens/MissingClerkKeyScreen', () => {
  const { Text: MockText } = require('react-native');
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
    jest.mocked(useFonts).mockReturnValue([false, null]);
    mockSession(false);

    await renderApp('/');

    expect(screen.getByText('loading')).toBeOnTheScreen();
  });

  it('explains a missing Clerk key', async () => {
    delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
    mockSession(false);

    await renderApp('/');

    expect(screen.getByText('missing-clerk-key')).toBeOnTheScreen();
  });

  it('waits for Clerk before building the navigator', async () => {
    mockSession(false, 'loading', false);

    await renderApp('/');

    expect(screen.getByText('loading')).toBeOnTheScreen();
  });

  it.each(['/', '/callback', '/hosted-auth-callback'])('keeps %s reachable in every state', async (url) => {
    mockSession(false);

    const app = await renderApp(url);

    expect(app.getPathname()).toBe(url);
  });
});

describe('RootLayout guards', () => {
  it('shows the welcome screen only to signed-out users', async () => {
    mockSession(false);
    await renderApp('/welcome');
    expect(screen.getByText('screen:welcome')).toBeOnTheScreen();

    mockSession(true, 'complete');
    await renderApp('/welcome');
    expect(screen.queryByText('screen:welcome')).toBeNull();
  });

  it('shows onboarding only while the registration is incomplete', async () => {
    mockSession(true, 'incomplete');
    await renderApp('/onboarding');
    expect(screen.getByText('screen:onboarding')).toBeOnTheScreen();

    mockSession(true, 'complete');
    await renderApp('/onboarding');
    expect(screen.queryByText('screen:onboarding')).toBeNull();
  });

  it.each([
    [false, 'loading'],
    [true, 'loading'],
    [true, 'incomplete'],
  ] as const)('hides the tabs when signed in is %p and the registration is %p', async (isSignedIn, status) => {
    mockSession(isSignedIn, status);

    await renderApp('/chats');

    expect(screen.queryByText('screen:chats')).toBeNull();
  });
});

describe('TabsLayout', () => {
  it('opens the tabs for a completed registration', async () => {
    mockSession(true, 'complete');

    const app = await renderApp('/chats');

    expect(screen.getByText('screen:chats')).toBeOnTheScreen();
    expect(app.getSegments()).toEqual(['(tabs)', 'chats']);
    expect(screen.getByText('Sohbetler')).toBeOnTheScreen();
    expect(screen.getByText('Keşfet')).toBeOnTheScreen();
    expect(screen.getByText('Profil')).toBeOnTheScreen();
    for (const icon of ['MessageCircle', 'Compass', 'UserRound']) {
      expect(getIconHints(icon).sort()).toEqual([`${colors.primary}:24`, `${colors.muted}:24`].sort());
    }
  });

  it('switches tabs from the tab bar', async () => {
    mockSession(true, 'complete');
    const app = await renderApp('/chats');

    await fireEvent.press(screen.getByLabelText('Profil sekmesi'));

    expect(app.getPathname()).toBe('/profile');
    expect(screen.getByText('screen:profile')).toBeOnTheScreen();
  });
});
