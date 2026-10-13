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
    // Arrange
    const notice = null;

    // Act
    const { toJSON } = await render(<Snackbar notice={notice} onDismiss={jest.fn()} />);

    // Assert
    expect(toJSON()).toBeNull();
  });

  it('shows the message and announces it to screen readers', async () => {
    // Arrange
    const notice = { id: 1, message: 'Fotoğraf çok küçük.' };

    // Act
    await render(<Snackbar notice={notice} onDismiss={jest.fn()} />);

    // Assert
    expect(screen.getByText('Fotoğraf çok küçük.')).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Fotoğraf çok küçük.');
  });

  it('stays visible until the duration has passed', async () => {
    // Arrange
    const onDismiss = jest.fn();
    await render(<Snackbar notice={{ id: 1, message: 'Mesaj' }} onDismiss={onDismiss} durationMilliseconds={2_000} />);

    // Act
    await act(() => jest.advanceTimersByTimeAsync(1_999));

    // Assert
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses itself after the duration', async () => {
    // Arrange
    const onDismiss = jest.fn();
    await render(<Snackbar notice={{ id: 1, message: 'Mesaj' }} onDismiss={onDismiss} durationMilliseconds={2_000} />);

    // Act
    await act(() => jest.advanceTimersByTimeAsync(2_000));

    // Assert
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when the action is pressed', async () => {
    // Arrange
    const onDismiss = jest.fn();
    await render(<Snackbar notice={{ id: 1, message: 'Mesaj' }} onDismiss={onDismiss} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Tamam' }));

    // Assert
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows a new notice without dismissing it on the previous timer', async () => {
    // Arrange
    const onDismiss = jest.fn();
    const { rerender } = await render(<Snackbar notice={{ id: 1, message: 'İlk' }} onDismiss={onDismiss} />);
    await act(() => jest.advanceTimersByTimeAsync(3_000));
    await rerender(<Snackbar notice={{ id: 2, message: 'İkinci' }} onDismiss={onDismiss} />);

    // Act
    await act(() => jest.advanceTimersByTimeAsync(3_000));

    // Assert
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText('İkinci')).toBeOnTheScreen();
  });

  it('dismisses a new notice after its own full duration', async () => {
    // Arrange
    const onDismiss = jest.fn();
    const { rerender } = await render(<Snackbar notice={{ id: 1, message: 'İlk' }} onDismiss={onDismiss} />);
    await act(() => jest.advanceTimersByTimeAsync(3_000));
    await rerender(<Snackbar notice={{ id: 2, message: 'İkinci' }} onDismiss={onDismiss} />);

    // Act
    await act(() => jest.advanceTimersByTimeAsync(4_000));

    // Assert
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('cancels the timer when the notice is cleared', async () => {
    // Arrange
    const onDismiss = jest.fn();
    const { rerender } = await render(<Snackbar notice={{ id: 1, message: 'Mesaj' }} onDismiss={onDismiss} />);
    await rerender(<Snackbar notice={null} onDismiss={onDismiss} />);

    // Act
    await act(() => jest.advanceTimersByTimeAsync(5_000));

    // Assert
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
