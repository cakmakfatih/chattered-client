import { useAuth } from '@clerk/expo';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ApiRequestError, getRegistrationStatus } from '../api';
import { RegistrationStatusProvider, useRegistrationStatus } from '../RegistrationStatusProvider';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  getRegistrationStatus: jest.fn(),
}));

const profile = { username: 'maviay', gender: 'female', bio: 'Merhaba' } as const;
const getToken = jest.fn().mockResolvedValue('session-token');
const loadStatus = jest.mocked(getRegistrationStatus);

type AuthState = { isLoaded: boolean; isSignedIn: boolean; userId: string | null; sessionId: string | null };

function mockAuth(auth: Partial<AuthState> = {}) {
  jest.mocked(useAuth).mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    userId: 'user_1',
    sessionId: 'sess_1',
    getToken,
    ...auth,
  } as never);
}

function wrapper({ children }: { children: ReactNode }) {
  return <RegistrationStatusProvider>{children}</RegistrationStatusProvider>;
}

function renderRegistrationStatus() {
  return renderHook(() => useRegistrationStatus(), { wrapper });
}

afterEach(() => {
  jest.useRealTimers();
});

async function renderIncompleteRegistration() {
  mockAuth();
  loadStatus.mockResolvedValue({ registration_complete: false, user: null });
  const hook = await renderRegistrationStatus();
  await waitFor(() => expect(hook.result.current.state.status).toBe('incomplete'));
  return hook;
}

async function switchToPendingSession(rerender: (props: object) => Promise<void> | void) {
  const pending = { resolve: (_value: { registration_complete: boolean; user: null }) => undefined as void };
  loadStatus.mockReturnValueOnce(new Promise((resolve) => { pending.resolve = resolve; }));
  mockAuth({ userId: 'user_2', sessionId: 'sess_2' });
  await rerender({});
  return pending;
}

describe('RegistrationStatusProvider', () => {
  it('reports loading until Clerk is loaded', async () => {
    // Arrange
    mockAuth({ isLoaded: false, userId: null, sessionId: null });

    // Act
    const { result } = await renderRegistrationStatus();

    // Assert
    expect(result.current.state).toEqual({ status: 'loading', userId: null });
    expect(loadStatus).not.toHaveBeenCalled();
  });

  it('reports a signed-out user without calling the API', async () => {
    // Arrange
    mockAuth({ isSignedIn: false, userId: null, sessionId: null });

    // Act
    const { result } = await renderRegistrationStatus();

    // Assert
    expect(result.current.state).toEqual({ status: 'signed-out', userId: null });
    expect(loadStatus).not.toHaveBeenCalled();
  });

  it('reports an incomplete registration', async () => {
    // Arrange
    mockAuth();
    loadStatus.mockResolvedValue({ registration_complete: false, user: null });

    // Act
    const { result } = await renderRegistrationStatus();

    // Assert
    await waitFor(() => expect(result.current.state).toEqual({ status: 'incomplete', userId: 'user_1', sessionId: 'sess_1' }));
  });

  it('reports a complete registration with the profile', async () => {
    // Arrange
    mockAuth();
    loadStatus.mockResolvedValue({ registration_complete: true, user: profile });

    // Act
    const { result } = await renderRegistrationStatus();

    // Assert
    await waitFor(() => expect(result.current.state).toEqual({ status: 'complete', userId: 'user_1', sessionId: 'sess_1', profile }));
  });

  it('exposes API failures with their status and code', async () => {
    // Arrange
    mockAuth();
    loadStatus.mockRejectedValue(new ApiRequestError('Sunucu hatası.', 500, 'internal'));

    // Act
    const { result } = await renderRegistrationStatus();

    // Assert
    await waitFor(() => expect(result.current.state).toEqual({
      status: 'error',
      userId: 'user_1',
      sessionId: 'sess_1',
      message: 'Sunucu hatası.',
      apiStatus: 500,
      errorCode: 'internal',
    }));
  });

  it('uses a generic message for unexpected failures', async () => {
    // Arrange
    mockAuth();
    loadStatus.mockRejectedValue(new Error('parse failed'));

    // Act
    const { result } = await renderRegistrationStatus();

    // Assert
    await waitFor(() => expect(result.current.state).toMatchObject({
      status: 'error',
      message: 'Kayıt durumu alınamadı. Lütfen tekrar deneyin.',
      apiStatus: null,
      errorCode: null,
    }));
  });

  it.each([
    ['the session is still loading', new ApiRequestError('Oturum doğrulanamadı.', 401, 'unauthorized')],
    ['the app is still resuming', new ApiRequestError('Bağlantı yok.', 0, 'network_error')],
  ])('retries while %s', async (_case, transientError) => {
    // Arrange
    jest.useFakeTimers();
    mockAuth();
    loadStatus
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({ registration_complete: false, user: null });
    const { result } = await renderRegistrationStatus();

    // Act
    await act(() => jest.advanceTimersByTimeAsync(250 + 500));

    // Assert
    expect(loadStatus).toHaveBeenCalledTimes(3);
    expect(result.current.state.status).toBe('incomplete');
  });

  it('stops retrying after three attempts', async () => {
    // Arrange
    jest.useFakeTimers();
    mockAuth();
    loadStatus.mockRejectedValue(new ApiRequestError('Oturum doğrulanamadı.', 401, 'unauthorized'));
    const { result } = await renderRegistrationStatus();

    // Act
    await act(() => jest.advanceTimersByTimeAsync(250 + 500 + 1000));

    // Assert
    expect(loadStatus).toHaveBeenCalledTimes(4);
    expect(result.current.state).toMatchObject({ status: 'error', apiStatus: 401 });
  });

  it('shows loading for a different session until its status is loaded', async () => {
    // Arrange
    const { result, rerender } = await renderIncompleteRegistration();

    // Act
    await switchToPendingSession(rerender);

    // Assert
    expect(result.current.state).toEqual({ status: 'loading', userId: 'user_2' });
  });

  it('reports the status of the new session once it is loaded', async () => {
    // Arrange
    const { result, rerender } = await renderIncompleteRegistration();
    const pendingStatus = await switchToPendingSession(rerender);

    // Act
    await act(async () => pendingStatus.resolve({ registration_complete: false, user: null }));

    // Assert
    expect(result.current.state).toEqual({ status: 'incomplete', userId: 'user_2', sessionId: 'sess_2' });
  });

  it('refreshes on demand and returns the new state', async () => {
    // Arrange
    const { result } = await renderIncompleteRegistration();
    loadStatus.mockResolvedValue({ registration_complete: true, user: profile });
    let refreshed: unknown;

    // Act
    await act(async () => { refreshed = await result.current.refresh(); });

    // Assert
    expect(refreshed).toEqual({ status: 'complete', userId: 'user_1', sessionId: 'sess_1', profile });
    expect(result.current.state.status).toBe('complete');
  });

  it('marks the registration complete locally', async () => {
    // Arrange
    const { result } = await renderIncompleteRegistration();

    // Act
    await act(async () => result.current.markComplete(profile));

    // Assert
    expect(result.current.state).toEqual({ status: 'complete', userId: 'user_1', sessionId: 'sess_1', profile });
  });

  it('throws when used outside the provider', async () => {
    // Arrange
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const rendering = renderHook(() => useRegistrationStatus());

    // Assert
    await expect(rendering).rejects.toThrow('useRegistrationStatus must be used inside RegistrationStatusProvider.');
  });
});
