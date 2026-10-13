import { act, renderHook } from '@testing-library/react-native';
import { ApiRequestError, checkUsernameAvailability } from '../api';
import {
  getUsernameAvailabilityMessage,
  isUsernameAvailable,
  isUsernameCheckPending,
  useUsernameAvailability,
} from '../useUsernameAvailability';

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  checkUsernameAvailability: jest.fn(),
}));

const getToken = jest.fn().mockResolvedValue('session-token');
const checkAvailability = jest.mocked(checkUsernameAvailability);

type HookProps = { username: string; enabled: boolean; revision: number };

function renderAvailability(initialProps: HookProps) {
  return renderHook(
    ({ username, enabled, revision }: HookProps) => useUsernameAvailability(username, getToken, enabled, revision),
    { initialProps },
  );
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useUsernameAvailability', () => {
  it('stays idle while disabled or when the username is malformed', async () => {
    const { result, rerender } = await renderAvailability({ username: 'maviay', enabled: false, revision: 0 });
    expect(result.current.status).toBe('idle');

    await rerender({ username: 'Ab', enabled: true, revision: 1 });
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    expect(result.current.status).toBe('idle');
    expect(checkAvailability).not.toHaveBeenCalled();
  });

  it('debounces the check and reports an available username', async () => {
    checkAvailability.mockResolvedValue(true);
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });

    expect(result.current.status).toBe('waiting');
    await act(() => jest.advanceTimersByTimeAsync(499));
    expect(checkAvailability).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTimeAsync(1));

    expect(checkAvailability).toHaveBeenCalledWith('maviay', getToken);
    expect(result.current.status).toBe('available');
  });

  it('reports a taken username', async () => {
    checkAvailability.mockResolvedValue(false);
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });

    await act(() => jest.advanceTimersByTimeAsync(500));

    expect(result.current.status).toBe('taken');
  });

  it('only checks the latest username while typing', async () => {
    checkAvailability.mockResolvedValue(true);
    const { result, rerender } = await renderAvailability({ username: 'mavi', enabled: true, revision: 1 });

    await act(() => jest.advanceTimersByTimeAsync(300));
    await rerender({ username: 'maviay', enabled: true, revision: 2 });
    await act(() => jest.advanceTimersByTimeAsync(500));

    expect(checkAvailability).toHaveBeenCalledTimes(1);
    expect(checkAvailability).toHaveBeenCalledWith('maviay', getToken);
    expect(result.current.status).toBe('available');
  });

  it('ignores a result that arrives after the username changed', async () => {
    let resolveFirstCheck: (available: boolean) => void = () => undefined;
    checkAvailability.mockReturnValueOnce(new Promise((resolve) => { resolveFirstCheck = resolve; }));
    const { result, rerender } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });
    await act(() => jest.advanceTimersByTimeAsync(500));

    await rerender({ username: 'maviay_', enabled: true, revision: 2 });
    await act(async () => resolveFirstCheck(true));

    expect(result.current.status).toBe('waiting');
  });

  it('exposes API error messages and retries on demand', async () => {
    checkAvailability.mockRejectedValueOnce(new ApiRequestError('Sunucuya ulaşılamadı.', 0, 'network_error'));
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });
    await act(() => jest.advanceTimersByTimeAsync(500));

    expect(result.current).toMatchObject({ status: 'error', message: 'Sunucuya ulaşılamadı.' });

    checkAvailability.mockResolvedValueOnce(true);
    await act(async () => result.current.retry());
    await act(() => jest.advanceTimersByTimeAsync(500));

    expect(checkAvailability).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('available');
  });

  it('uses a generic message for unexpected errors', async () => {
    checkAvailability.mockRejectedValue(new Error('boom'));
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });

    await act(() => jest.advanceTimersByTimeAsync(500));

    expect(result.current.message).toBe('Kullanıcı adı şu an kontrol edilemedi. Lütfen tekrar deneyin.');
  });
});

describe('availability status helpers', () => {
  it.each([
    ['idle', null],
    ['waiting', 'Kullanıcı adı kontrol ediliyor…'],
    ['checking', 'Kullanıcı adı kontrol ediliyor…'],
    ['available', 'Bu kullanıcı adı uygun.'],
    ['taken', 'Bu kullanıcı adı kullanımda.'],
    ['error', 'Kullanıcı adı şu an kontrol edilemedi.'],
  ] as const)('describes the %p status', (status, message) => {
    expect(getUsernameAvailabilityMessage(status)).toBe(message);
  });

  it('classifies pending and available statuses', () => {
    expect(isUsernameCheckPending('waiting')).toBe(true);
    expect(isUsernameCheckPending('checking')).toBe(true);
    expect(isUsernameCheckPending('available')).toBe(false);
    expect(isUsernameAvailable('available')).toBe(true);
    expect(isUsernameAvailable('taken')).toBe(false);
  });
});
