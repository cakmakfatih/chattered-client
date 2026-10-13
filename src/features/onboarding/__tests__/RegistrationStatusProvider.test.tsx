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

describe('RegistrationStatusProvider', () => {
  it('reports loading until Clerk is loaded', async () => {
    mockAuth({ isLoaded: false, userId: null, sessionId: null });

    const { result } = await renderRegistrationStatus();

    expect(result.current.state).toEqual({ status: 'loading', userId: null });
    expect(loadStatus).not.toHaveBeenCalled();
  });

  it('reports a signed-out user without calling the API', async () => {
    mockAuth({ isSignedIn: false, userId: null, sessionId: null });

    const { result } = await renderRegistrationStatus();

    expect(result.current.state).toEqual({ status: 'signed-out', userId: null });
    expect(loadStatus).not.toHaveBeenCalled();
  });

  it('reports an incomplete registration', async () => {
    mockAuth();
    loadStatus.mockResolvedValue({ registration_complete: false, user: null });

    const { result } = await renderRegistrationStatus();

    await waitFor(() => expect(result.current.state).toEqual({ status: 'incomplete', userId: 'user_1', sessionId: 'sess_1' }));
  });

  it('reports a complete registration with the profile', async () => {
    mockAuth();
    loadStatus.mockResolvedValue({ registration_complete: true, user: profile });

    const { result } = await renderRegistrationStatus();

    await waitFor(() => expect(result.current.state).toEqual({ status: 'complete', userId: 'user_1', sessionId: 'sess_1', profile }));
  });

  it('exposes API failures with their status and code', async () => {
    mockAuth();
    loadStatus.mockRejectedValue(new ApiRequestError('Sunucu hatası.', 500, 'internal'));

    const { result } = await renderRegistrationStatus();

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
    mockAuth();
    loadStatus.mockRejectedValue(new Error('parse failed'));

    const { result } = await renderRegistrationStatus();

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
    jest.useFakeTimers();
    mockAuth();
    loadStatus
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({ registration_complete: false, user: null });

    const { result } = await renderRegistrationStatus();
    await act(() => jest.advanceTimersByTimeAsync(250 + 500));

    expect(loadStatus).toHaveBeenCalledTimes(3);
    expect(result.current.state.status).toBe('incomplete');
  });

  it('stops retrying after three attempts', async () => {
    jest.useFakeTimers();
    mockAuth();
    loadStatus.mockRejectedValue(new ApiRequestError('Oturum doğrulanamadı.', 401, 'unauthorized'));

    const { result } = await renderRegistrationStatus();
    await act(() => jest.advanceTimersByTimeAsync(250 + 500 + 1000));

    expect(loadStatus).toHaveBeenCalledTimes(4);
    expect(result.current.state).toMatchObject({ status: 'error', apiStatus: 401 });
  });

  it('shows loading for a different session until its status is loaded', async () => {
    mockAuth();
    loadStatus.mockResolvedValue({ registration_complete: false, user: null });
    const { result, rerender } = await renderRegistrationStatus();
    await waitFor(() => expect(result.current.state.status).toBe('incomplete'));

    let resolveNextStatus: (value: { registration_complete: boolean; user: null }) => void = () => undefined;
    loadStatus.mockReturnValueOnce(new Promise((resolve) => { resolveNextStatus = resolve; }));
    mockAuth({ userId: 'user_2', sessionId: 'sess_2' });
    await rerender({});

    expect(result.current.state).toEqual({ status: 'loading', userId: 'user_2' });

    await act(async () => resolveNextStatus({ registration_complete: false, user: null }));

    expect(result.current.state).toEqual({ status: 'incomplete', userId: 'user_2', sessionId: 'sess_2' });
  });

  it('refreshes on demand and returns the new state', async () => {
    mockAuth();
    loadStatus.mockResolvedValue({ registration_complete: false, user: null });
    const { result } = await renderRegistrationStatus();
    await waitFor(() => expect(result.current.state.status).toBe('incomplete'));

    loadStatus.mockResolvedValue({ registration_complete: true, user: profile });
    let refreshed: unknown;
    await act(async () => { refreshed = await result.current.refresh(); });

    expect(refreshed).toEqual({ status: 'complete', userId: 'user_1', sessionId: 'sess_1', profile });
    expect(result.current.state.status).toBe('complete');
  });

  it('marks the registration complete locally', async () => {
    mockAuth();
    loadStatus.mockResolvedValue({ registration_complete: false, user: null });
    const { result } = await renderRegistrationStatus();
    await waitFor(() => expect(result.current.state.status).toBe('incomplete'));

    await act(async () => result.current.markComplete(profile));

    expect(result.current.state).toEqual({ status: 'complete', userId: 'user_1', sessionId: 'sess_1', profile });
  });

  it('throws when used outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useRegistrationStatus())).rejects.toThrow(
      'useRegistrationStatus must be used inside RegistrationStatusProvider.',
    );
  });
});
