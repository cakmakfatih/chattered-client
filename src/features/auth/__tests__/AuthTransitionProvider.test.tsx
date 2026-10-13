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

describe('authenticate', () => {
  it('opens hosted auth and finishes when no session was created', async () => {
    const hostedAuth = deferred<{ createdSessionId: string | null }>();
    startHostedAuth.mockReturnValue(hostedAuth.promise);
    const { result } = await renderHook(() => useAuthTransition(), { wrapper });

    let authentication: Promise<void> = Promise.resolve();
    await act(async () => { authentication = result.current.authenticate('sign-up'); });

    expect(result.current.isAuthenticating).toBe(true);
    expect(startHostedAuth).toHaveBeenCalledWith({ mode: 'sign-up', authSessionOptions: undefined });

    await act(async () => {
      hostedAuth.resolve({ createdSessionId: null });
      await authentication;
    });

    expect(result.current.isAuthenticating).toBe(false);
  });

  it('keeps the transition until Clerk reports the new session', async () => {
    startHostedAuth.mockResolvedValue({ createdSessionId: 'sess_1' });
    const { result, rerender } = await renderHook(() => useAuthTransition(), { wrapper });

    await act(() => result.current.authenticate('sign-in'));
    expect(result.current.isAuthenticating).toBe(true);

    mockAuth(true);
    await rerender({});

    expect(result.current.isAuthenticating).toBe(false);
  });

  it('keeps the Android custom tab inside the app task', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    startHostedAuth.mockResolvedValue({ createdSessionId: null });
    const { result } = await renderHook(() => useAuthTransition(), { wrapper });

    await act(() => result.current.authenticate('sign-in'));

    expect(startHostedAuth).toHaveBeenCalledWith({
      mode: 'sign-in',
      authSessionOptions: { createTask: false, showInRecents: false },
    });
  });

  it('waits for the app to become active before opening hosted auth', async () => {
    setAppState('background');
    const removeSubscription = jest.fn();
    let emitAppState: (state: string) => void = () => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      emitAppState = listener as (state: string) => void;
      return { remove: removeSubscription } as never;
    });
    startHostedAuth.mockResolvedValue({ createdSessionId: null });
    const { result } = await renderHook(() => useAuthTransition(), { wrapper });

    let authentication: Promise<void> = Promise.resolve();
    await act(async () => { authentication = result.current.authenticate('sign-in'); });
    await act(async () => emitAppState('inactive'));
    expect(startHostedAuth).not.toHaveBeenCalled();

    await act(async () => {
      emitAppState('active');
      await authentication;
    });

    expect(startHostedAuth).toHaveBeenCalled();
    expect(removeSubscription).toHaveBeenCalled();
  });

  it('finishes the transition and rethrows when hosted auth fails', async () => {
    startHostedAuth.mockRejectedValue(new Error('browser unavailable'));
    const { result } = await renderHook(() => useAuthTransition(), { wrapper });

    await act(async () => {
      await expect(result.current.authenticate('sign-in')).rejects.toThrow('browser unavailable');
    });

    expect(result.current.isAuthenticating).toBe(false);
  });

  it('ignores a second request while a transition is running', async () => {
    startHostedAuth.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHook(() => useAuthTransition(), { wrapper });

    await act(async () => {
      void result.current.authenticate('sign-in');
      void result.current.authenticate('sign-up');
      void result.current.endSession();
    });

    expect(startHostedAuth).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('endSession', () => {
  it('signs out and reports the transition while it runs', async () => {
    const signOutRequest = deferred();
    signOut.mockReturnValue(signOutRequest.promise);
    const { result } = await renderHook(() => useAuthTransition(), { wrapper });

    let session: Promise<void> = Promise.resolve();
    await act(async () => { session = result.current.endSession(); });
    expect(result.current.isSigningOut).toBe(true);

    await act(async () => {
      signOutRequest.resolve();
      await session;
    });

    expect(signOut).toHaveBeenCalled();
    expect(result.current.isSigningOut).toBe(false);
  });

  it('lets the Android task settle after signing out', async () => {
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = await renderHook(() => useAuthTransition(), { wrapper });

    let session: Promise<void> = Promise.resolve();
    await act(async () => { session = result.current.endSession(); });
    expect(result.current.isSigningOut).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
      await session;
    });

    expect(result.current.isSigningOut).toBe(false);
  });

  it('finishes the transition when sign-out fails', async () => {
    signOut.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useAuthTransition(), { wrapper });

    await act(async () => {
      await expect(result.current.endSession()).rejects.toThrow('offline');
    });

    expect(result.current.isSigningOut).toBe(false);
  });
});

it('throws when used outside the provider', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);

  await expect(renderHook(() => useAuthTransition())).rejects.toThrow(
    'useAuthTransition must be used inside AuthTransitionProvider.',
  );
});
