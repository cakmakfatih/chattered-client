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

async function renderFailedCheck() {
  checkAvailability.mockRejectedValueOnce(new ApiRequestError('Sunucuya ulaşılamadı.', 0, 'network_error'));
  const hook = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });
  await act(() => jest.advanceTimersByTimeAsync(500));
  return hook;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useUsernameAvailability', () => {
  it('stays idle while disabled', async () => {
    // Arrange
    const props = { username: 'maviay', enabled: false, revision: 0 };

    // Act
    const { result } = await renderAvailability(props);

    // Assert
    expect(result.current.status).toBe('idle');
  });

  it('stays idle and skips the check when the username is malformed', async () => {
    // Arrange
    const { result, rerender } = await renderAvailability({ username: 'maviay', enabled: false, revision: 0 });
    await rerender({ username: 'Ab', enabled: true, revision: 1 });

    // Act
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Assert
    expect(result.current.status).toBe('idle');
    expect(checkAvailability).not.toHaveBeenCalled();
  });

  it('waits before checking a new username', async () => {
    // Arrange
    checkAvailability.mockResolvedValue(true);
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });

    // Act
    await act(() => jest.advanceTimersByTimeAsync(499));

    // Assert
    expect(result.current.status).toBe('waiting');
    expect(checkAvailability).not.toHaveBeenCalled();
  });

  it('reports an available username after the debounce', async () => {
    // Arrange
    checkAvailability.mockResolvedValue(true);
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });

    // Act
    await act(() => jest.advanceTimersByTimeAsync(500));

    // Assert
    expect(checkAvailability).toHaveBeenCalledWith('maviay', getToken);
    expect(result.current.status).toBe('available');
  });

  it('reports a taken username', async () => {
    // Arrange
    checkAvailability.mockResolvedValue(false);
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });

    // Act
    await act(() => jest.advanceTimersByTimeAsync(500));

    // Assert
    expect(result.current.status).toBe('taken');
  });

  it('only checks the latest username while typing', async () => {
    // Arrange
    checkAvailability.mockResolvedValue(true);
    const { result, rerender } = await renderAvailability({ username: 'mavi', enabled: true, revision: 1 });
    await act(() => jest.advanceTimersByTimeAsync(300));
    await rerender({ username: 'maviay', enabled: true, revision: 2 });

    // Act
    await act(() => jest.advanceTimersByTimeAsync(500));

    // Assert
    expect(checkAvailability).toHaveBeenCalledTimes(1);
    expect(checkAvailability).toHaveBeenCalledWith('maviay', getToken);
    expect(result.current.status).toBe('available');
  });

  it('ignores a result that arrives after the username changed', async () => {
    // Arrange
    const firstCheck = { resolve: (_available: boolean) => undefined as void };
    checkAvailability.mockReturnValueOnce(new Promise((resolve) => { firstCheck.resolve = resolve; }));
    const { result, rerender } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });
    await act(() => jest.advanceTimersByTimeAsync(500));
    await rerender({ username: 'maviay_', enabled: true, revision: 2 });

    // Act
    await act(async () => firstCheck.resolve(true));

    // Assert
    expect(result.current.status).toBe('waiting');
  });

  it('exposes API error messages', async () => {
    // Arrange
    checkAvailability.mockRejectedValueOnce(new ApiRequestError('Sunucuya ulaşılamadı.', 0, 'network_error'));
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });

    // Act
    await act(() => jest.advanceTimersByTimeAsync(500));

    // Assert
    expect(result.current).toMatchObject({ status: 'error', message: 'Sunucuya ulaşılamadı.' });
  });

  it('checks again when retry is requested after an error', async () => {
    // Arrange
    const { result } = await renderFailedCheck();
    checkAvailability.mockResolvedValueOnce(true);
    await act(async () => result.current.retry());

    // Act
    await act(() => jest.advanceTimersByTimeAsync(500));

    // Assert
    expect(checkAvailability).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('available');
  });

  it('uses a generic message for unexpected errors', async () => {
    // Arrange
    checkAvailability.mockRejectedValue(new Error('boom'));
    const { result } = await renderAvailability({ username: 'maviay', enabled: true, revision: 1 });

    // Act
    await act(() => jest.advanceTimersByTimeAsync(500));

    // Assert
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
  ] as const)('describes the %p status', (status, expectedMessage) => {
    // Arrange
    const input = status;

    // Act
    const message = getUsernameAvailabilityMessage(input);

    // Assert
    expect(message).toBe(expectedMessage);
  });

  it.each([
    ['waiting', 'pending', true],
    ['checking', 'pending', true],
    ['available', 'not pending', false],
  ] as const)('treats the %p status as %s', (status, _verdict, expected) => {
    // Arrange
    const input = status;

    // Act
    const isPending = isUsernameCheckPending(input);

    // Assert
    expect(isPending).toBe(expected);
  });

  it.each([
    ['available', 'available', true],
    ['taken', 'unavailable', false],
  ] as const)('treats the %p status as %s', (status, _verdict, expected) => {
    // Arrange
    const input = status;

    // Act
    const isAvailable = isUsernameAvailable(input);

    // Assert
    expect(isAvailable).toBe(expected);
  });
});
