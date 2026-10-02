import { useAuth, useClerk } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import type { HostedAuthMode } from '@clerk/expo/hosted-auth';
import type { AuthSessionOpenOptions } from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

type AuthTransitionContextValue = {
  isAuthenticating: boolean;
  isSigningOut: boolean;
  authenticate: (mode: HostedAuthMode) => Promise<void>;
  endSession: () => Promise<void>;
};

const AuthTransitionContext = createContext<AuthTransitionContextValue | null>(null);
const androidAuthSessionOptions: AuthSessionOpenOptions = {
  createTask: false,
  showInRecents: false,
};

function waitForActiveApp(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();

  return new Promise((resolve) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      subscription.remove();
      resolve();
    });
  });
}

async function waitForAndroidTaskToSettle(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await waitForActiveApp();
  await new Promise((resolve) => setTimeout(resolve, 250));
}

export function AuthTransitionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { startHostedAuth } = useHostedAuth();
  const transitionRef = useRef<'authentication' | 'sign-out' | null>(null);
  const [activeTransition, setActiveTransition] = useState<'authentication' | 'sign-out' | null>(null);

  const finishTransition = useCallback((transition: 'authentication' | 'sign-out') => {
    if (transitionRef.current === transition) {
      transitionRef.current = null;
      setActiveTransition(null);
    }
  }, []);

  const authenticate = useCallback(async (mode: HostedAuthMode) => {
    if (transitionRef.current) return;

    transitionRef.current = 'authentication';
    setActiveTransition('authentication');
    try {
      await waitForActiveApp();
      const result = await startHostedAuth({
        mode,
        // Keeping the Custom Tab in the app task prevents Android from returning
        // to an unrelated task when hosted auth is opened again after sign-out.
        authSessionOptions: Platform.OS === 'android' ? androidAuthSessionOptions : undefined,
      });
      if (!result.createdSessionId) finishTransition('authentication');
    } catch (error) {
      finishTransition('authentication');
      throw error;
    }
  }, [finishTransition, startHostedAuth]);

  const endSession = useCallback(async () => {
    if (transitionRef.current) return;

    transitionRef.current = 'sign-out';
    setActiveTransition('sign-out');
    try {
      await signOut();
      await waitForAndroidTaskToSettle();
    } finally {
      finishTransition('sign-out');
    }
  }, [finishTransition, signOut]);

  useEffect(() => {
    if (activeTransition === 'authentication' && isLoaded && isSignedIn) {
      finishTransition('authentication');
    }
  }, [activeTransition, finishTransition, isLoaded, isSignedIn]);

  const value = useMemo(() => ({
    isAuthenticating: activeTransition === 'authentication',
    isSigningOut: activeTransition === 'sign-out',
    authenticate,
    endSession,
  }), [activeTransition, authenticate, endSession]);

  return <AuthTransitionContext.Provider value={value}>{children}</AuthTransitionContext.Provider>;
}

export function useAuthTransition(): AuthTransitionContextValue {
  const context = useContext(AuthTransitionContext);
  if (!context) throw new Error('useAuthTransition must be used inside AuthTransitionProvider.');
  return context;
}
