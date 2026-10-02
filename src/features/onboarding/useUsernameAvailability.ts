import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiRequestError, checkUsernameAvailability } from './api';
import { isValidUsername } from './validation';

type AvailabilityStatus = 'idle' | 'waiting' | 'checking' | 'available' | 'taken' | 'error';

type AvailabilityResult = {
  username: string;
  revision: number;
  status: Exclude<AvailabilityStatus, 'idle' | 'waiting'>;
  message?: string;
};

export function useUsernameAvailability(
  username: string,
  getToken: () => Promise<string | null>,
  enabled: boolean,
  revision: number,
) {
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const isFormatValid = isValidUsername(username);
  const currentResult = result?.username === username && result.revision === revision ? result : null;
  const status: AvailabilityStatus = !enabled || !isFormatValid
    ? 'idle'
    : currentResult?.status ?? 'waiting';

  useEffect(() => {
    if (!enabled || !isFormatValid) return undefined;

    let isCurrent = true;
    const timer = setTimeout(() => {
      setResult({ username, revision, status: 'checking' });
      void checkUsernameAvailability(username, getToken)
        .then((available) => {
          if (isCurrent) setResult({ username, revision, status: available ? 'available' : 'taken' });
        })
        .catch((error: unknown) => {
          if (!isCurrent) return;
          const message = error instanceof ApiRequestError
            ? error.message
            : 'Kullanıcı adı şu an kontrol edilemedi. Lütfen tekrar deneyin.';
          setResult({ username, revision, status: 'error', message });
        });
    }, 500);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [enabled, getToken, isFormatValid, retryCount, revision, username]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  return useMemo(() => ({ status, message: currentResult?.message, retry }), [currentResult?.message, retry, status]);
}

export function getUsernameAvailabilityMessage(status: AvailabilityStatus): string | null {
  switch (status) {
    case 'waiting':
    case 'checking':
      return 'Kullanıcı adı kontrol ediliyor…';
    case 'available':
      return 'Bu kullanıcı adı uygun.';
    case 'taken':
      return 'Bu kullanıcı adı kullanımda.';
    case 'error':
      return 'Kullanıcı adı şu an kontrol edilemedi.';
    default:
      return null;
  }
}

export function isUsernameCheckPending(status: AvailabilityStatus): boolean {
  return status === 'waiting' || status === 'checking';
}

export function isUsernameAvailable(status: AvailabilityStatus): boolean {
  return status === 'available';
}
