import { useAuth } from '@clerk/expo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiRequestError, getRegistrationStatus, type RegistrationProfile } from './api';

type RegistrationState =
  | { status: 'signed-out'; userId: null }
  | { status: 'loading'; userId: string | null }
  | {
    status: 'error';
    userId: string;
    sessionId: string;
    message: string;
    apiStatus: number | null;
    errorCode: string | null;
  }
  | { status: 'incomplete'; userId: string; sessionId: string }
  | { status: 'complete'; userId: string; sessionId: string; profile: RegistrationProfile };

type RegistrationContextValue = {
  state: RegistrationState;
  refresh: () => Promise<RegistrationState>;
  markComplete: (profile: RegistrationProfile) => void;
};

const RegistrationContext = createContext<RegistrationContextValue | null>(null);
const sessionValidationRetryDelays = [250, 500, 1000];

async function loadRegistrationStatus(getToken: () => Promise<string | null>) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await getRegistrationStatus(getToken);
    } catch (error) {
      const retryDelay = sessionValidationRetryDelays[attempt];
      const isSessionStillLoading = error instanceof ApiRequestError && error.status === 401;
      const isAppStillResuming = error instanceof ApiRequestError && error.code === 'network_error';
      if ((!isSessionStillLoading && !isAppStillResuming) || retryDelay === undefined) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

export function RegistrationStatusProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const [storedState, setStoredState] = useState<RegistrationState>({ status: 'loading', userId: null });
  const requestId = useRef(0);
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const refresh = useCallback(async (): Promise<RegistrationState> => {
    const currentRequestId = ++requestId.current;

    if (!isLoaded) {
      return { status: 'loading', userId: userId ?? null };
    }

    if (!isSignedIn || !userId || !sessionId) return { status: 'signed-out', userId: null };

    try {
      const profileStatus = await loadRegistrationStatus(() => getTokenRef.current());
      const nextState: RegistrationState = profileStatus.registration_complete && profileStatus.user
        ? { status: 'complete', userId, sessionId, profile: profileStatus.user }
        : { status: 'incomplete', userId, sessionId };
      if (currentRequestId === requestId.current) setStoredState(nextState);
      return nextState;
    } catch (error) {
      const apiError = error instanceof ApiRequestError ? error : null;
      const nextState: RegistrationState = {
        status: 'error',
        userId,
        sessionId,
        message: apiError
          ? apiError.message
          : 'Kayıt durumu alınamadı. Lütfen tekrar deneyin.',
        apiStatus: apiError?.status ?? null,
        errorCode: apiError?.code ?? null,
      };
      if (currentRequestId === requestId.current) setStoredState(nextState);
      return nextState;
    }
  }, [isLoaded, isSignedIn, sessionId, userId]);

  useEffect(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh]);

  const markComplete = useCallback((profile: RegistrationProfile) => {
    if (userId && sessionId) setStoredState({ status: 'complete', userId, sessionId, profile });
  }, [sessionId, userId]);

  const state = useMemo<RegistrationState>(() => {
    const storedSessionId = 'sessionId' in storedState ? storedState.sessionId : null;
    if (!isLoaded || (isSignedIn && (storedState.userId !== userId || storedSessionId !== sessionId))) {
      return { status: 'loading', userId: userId ?? null };
    }
    if (!isSignedIn) return { status: 'signed-out', userId: null };
    return storedState;
  }, [isLoaded, isSignedIn, sessionId, storedState, userId]);

  const value = useMemo(() => ({ state, refresh, markComplete }), [state, refresh, markComplete]);
  return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
}

export function useRegistrationStatus(): RegistrationContextValue {
  const context = useContext(RegistrationContext);
  if (!context) throw new Error('useRegistrationStatus must be used inside RegistrationStatusProvider.');
  return context;
}
