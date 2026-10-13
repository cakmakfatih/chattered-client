import { fireEvent, render, screen, act } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { Snackbar } from '../Snackbar';

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Snackbar', () => {
  it('renders nothing without a notice', async () => {
    const { toJSON } = await render(<Snackbar notice={null} onDismiss={jest.fn()} />);

    expect(toJSON()).toBeNull();
  });

  it('shows the message and announces it to screen readers', async () => {
    await render(<Snackbar notice={{ id: 1, message: 'Fotoğraf çok küçük.' }} onDismiss={jest.fn()} />);

    expect(screen.getByText('Fotoğraf çok küçük.')).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Fotoğraf çok küçük.');
  });

  it('dismisses itself after the duration', async () => {
    const onDismiss = jest.fn();
    await render(<Snackbar notice={{ id: 1, message: 'Mesaj' }} onDismiss={onDismiss} durationMilliseconds={2_000} />);

    await act(() => jest.advanceTimersByTimeAsync(1_999));
    expect(onDismiss).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTimeAsync(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when the action is pressed', async () => {
    const onDismiss = jest.fn();
    await render(<Snackbar notice={{ id: 1, message: 'Mesaj' }} onDismiss={onDismiss} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tamam' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('restarts the timer for a new notice', async () => {
    const onDismiss = jest.fn();
    const { rerender } = await render(<Snackbar notice={{ id: 1, message: 'İlk' }} onDismiss={onDismiss} />);
    await act(() => jest.advanceTimersByTimeAsync(3_000));

    await rerender(<Snackbar notice={{ id: 2, message: 'İkinci' }} onDismiss={onDismiss} />);
    await act(() => jest.advanceTimersByTimeAsync(3_000));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText('İkinci')).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(1_000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('cancels the timer when the notice is cleared', async () => {
    const onDismiss = jest.fn();
    const { rerender } = await render(<Snackbar notice={{ id: 1, message: 'Mesaj' }} onDismiss={onDismiss} />);

    await rerender(<Snackbar notice={null} onDismiss={onDismiss} />);
    await act(() => jest.advanceTimersByTimeAsync(5_000));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
