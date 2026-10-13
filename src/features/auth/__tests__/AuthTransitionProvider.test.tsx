import { useAuth, useClerk } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { AuthTransitionProvider, useAuthTransition } from '../AuthTransitionProvider';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn(), useClerk: jest.fn() }));
jest.mock('@clerk/expo/hosted-auth', () => ({ useHostedAuth: jest.fn() }));

const signOut = jest.fn();
const startHostedAuth = jest.fn();
const presetCurrentState = AppState.currentState;

function mockAuth(isSignedIn: boolean) {
  jest.mocked(useAuth).mockReturnValue({ isLoaded: true, isSignedIn } as never);
}

/** The React Native Jest preset mocks `currentState` as a function, so tests assign the value directly. */
function setAppState(state: unknown) {
  (AppState as { currentState: unknown }).currentState = state;
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthTransitionProvider>{children}</AuthTransitionProvider>;
}

function deferred<T = void>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockAuth(false);
  jest.mocked(useClerk).mockReturnValue({ signOut } as never);
  jest.mocked(useHostedAuth).mockReturnValue({ startHostedAuth } as never);
  setAppState('active');
  signOut.mockResolvedValue(undefined);
});

afterEach(() => {
  setAppState(presetCurrentState);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function renderAuthTransition() {
  return renderHook(() => useAuthTransition(), { wrapper });
}

async function captureRejection(run: () => Promise<void>) {
  let error: unknown;
  await act(async () => { error = await run().then(() => undefined, (reason: unknown) => reason); });
  return error;
}

function mockAppStateListener() {
  const appState = { emit: (_state: string) => undefined as void, remove: jest.fn() };
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appState.emit = listener as (state: string) => void;
    return { remove: appState.remove } as never;
  });
  return appState;
}

/** Starts a transition inside act and hands back its pending promise without awaiting it. */
async function startPendingTransition(start: () => Promise<void>) {
  let transition: Promise<void> = Promise.resolve();
  await act(async () => { transition = start(); });
  return { transition };
}

describe('authenticate', () => {
  it('opens hosted auth in the requested mode and reports the transition', async () => {
    // Arrange
    startHostedAuth.mockReturnValue(deferred<{ createdSessionId: string | null }>().promise);
    const { result } = await renderAuthTransition();

    // Act
    await startPendingTransition(() => result.current.authenticate('sign-up'));

    // Assert
    expect(result.current.isAuthenticating).toBe(true);
    expect(startHostedAuth).toHaveBeenCalledWith({ mode: 'sign-up', authSessionOptions: undefined });
  });

  it('finishes the transition when no session was created', async () => {
    // Arrange
    const hostedAuth = deferred<{ createdSessionId: string | null }>();
    startHostedAuth.mockReturnValue(hostedAuth.promise);
    const { result } = await renderAuthTransition();
    const { transition: authentication } = await startPendingTransition(() => result.current.authenticate('sign-up'));

    // Act
    await act(async () => {
      hostedAuth.resolve({ createdSessionId: null });
      await authentication;
    });

    // Assert
    expect(result.current.isAuthenticating).toBe(false);
  });

  it('keeps the transition after hosted auth creates a session', async () => {
    // Arrange
    startHostedAuth.mockResolvedValue({ createdSessionId: 'sess_1' });
    const { result } = await renderAuthTransition();

    // Act
    await act(() => result.current.authenticate('sign-in'));

    // Assert
    expect(result.current.isAuthenticating).toBe(true);
  });

  it('finishes the transition once Clerk reports the new session', async () => {
    // Arrange
    startHostedAuth.mockResolvedValue({ createdSessionId: 'sess_1' });
    const { result, rerender } = await renderAuthTransition();
    await act(() => result.current.authenticate('sign-in'));
    mockAuth(true);

    // Act
    await rerender({});

    // Assert
    expect(result.current.isAuthenticating).toBe(false);
  });

  it('keeps the Android custom tab inside the app task', async () => {
    // Arrange
    jest.replaceProperty(Platform, 'OS', 'android');
    startHostedAuth.mockResolvedValue({ createdSessionId: null });
    const { result } = await renderAuthTransition();

    // Act
    await act(() => result.current.authenticate('sign-in'));

    // Assert
    expect(startHostedAuth).toHaveBeenCalledWith({
      mode: 'sign-in',
      authSessionOptions: { createTask: false, showInRecents: false },
    });
  });

  it('does not open hosted auth while the app is not active yet', async () => {
    // Arrange
    setAppState('background');
    const appState = mockAppStateListener();
    startHostedAuth.mockResolvedValue({ createdSessionId: null });
    const { result } = await renderAuthTransition();
    await startPendingTransition(() => result.current.authenticate('sign-in'));

    // Act
    await act(async () => appState.emit('inactive'));

    // Assert
    expect(startHostedAuth).not.toHaveBeenCalled();
  });

  it('opens hosted auth once the app becomes active and removes the listener', async () => {
    // Arrange
    setAppState('background');
    const appState = mockAppStateListener();
    startHostedAuth.mockResolvedValue({ createdSessionId: null });
    const { result } = await renderAuthTransition();
    const { transition: authentication } = await startPendingTransition(() => result.current.authenticate('sign-in'));

    // Act
    await act(async () => {
      appState.emit('active');
      await authentication;
    });

    // Assert
    expect(startHostedAuth).toHaveBeenCalled();
    expect(appState.remove).toHaveBeenCalled();
  });

  it('finishes the transition and rethrows when hosted auth fails', async () => {
    // Arrange
    startHostedAuth.mockRejectedValue(new Error('browser unavailable'));
    const { result } = await renderAuthTransition();

    // Act
    const error = await captureRejection(() => result.current.authenticate('sign-in'));

    // Assert
    expect(error).toEqual(new Error('browser unavailable'));
    expect(result.current.isAuthenticating).toBe(false);
  });

  it('ignores a second request while a transition is running', async () => {
    // Arrange
    startHostedAuth.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderAuthTransition();
    await startPendingTransition(() => result.current.authenticate('sign-in'));

    // Act
    await act(async () => {
      void result.current.authenticate('sign-up');
      void result.current.endSession();
    });

    // Assert
    expect(startHostedAuth).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('endSession', () => {
  it('reports the transition while signing out', async () => {
    // Arrange
    signOut.mockReturnValue(deferred().promise);
    const { result } = await renderAuthTransition();

    // Act
    await startPendingTransition(() => result.current.endSession());

    // Assert
    expect(signOut).toHaveBeenCalled();
    expect(result.current.isSigningOut).toBe(true);
  });

  it('finishes the transition once sign-out completes', async () => {
    // Arrange
    const signOutRequest = deferred();
    signOut.mockReturnValue(signOutRequest.promise);
    const { result } = await renderAuthTransition();
    const { transition: session } = await startPendingTransition(() => result.current.endSession());

    // Act
    await act(async () => {
      signOutRequest.resolve();
      await session;
    });

    // Assert
    expect(result.current.isSigningOut).toBe(false);
  });

  it('keeps the Android transition until the task settles', async () => {
    // Arrange
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderAuthTransition();

    // Act
    await startPendingTransition(() => result.current.endSession());

    // Assert
    expect(result.current.isSigningOut).toBe(true);
  });

  it('finishes the Android transition after the task settles', async () => {
    // Arrange
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderAuthTransition();
    const { transition: session } = await startPendingTransition(() => result.current.endSession());

    // Act
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
      await session;
    });

    // Assert
    expect(result.current.isSigningOut).toBe(false);
  });

  it('finishes the transition and rethrows when sign-out fails', async () => {
    // Arrange
    signOut.mockRejectedValue(new Error('offline'));
    const { result } = await renderAuthTransition();

    // Act
    const error = await captureRejection(() => result.current.endSession());

    // Assert
    expect(error).toEqual(new Error('offline'));
    expect(result.current.isSigningOut).toBe(false);
  });
});

describe('useAuthTransition', () => {
  it('throws when used outside the provider', async () => {
    // Arrange
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const rendering = renderHook(() => useAuthTransition());

    // Assert
    await expect(rendering).rejects.toThrow('useAuthTransition must be used inside AuthTransitionProvider.');
  });
});
