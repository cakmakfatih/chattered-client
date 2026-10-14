import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { UserDirectoryScreen } from '../UserDirectoryScreen';

function getUserRows() {
  return screen.getAllByRole('button').filter((button) => /^@/.test(String(button.props.accessibilityLabel)));
}

function getPresence(labels: unknown[]) {
  return labels.map((label) => String(label).endsWith(', çevrimiçi'));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('UserDirectoryScreen', () => {
  it('lists online users before offline users', async () => {
    // Arrange
    const screenElement = <UserDirectoryScreen />;

    // Act
    await render(screenElement);

    // Assert
    const presence = getPresence(getUserRows().map((row) => row.props.accessibilityLabel));
    const firstOffline = presence.indexOf(false);
    expect(screen.getAllByText('Keşfet').length).toBeGreaterThan(0);
    expect(firstOffline).toBeGreaterThan(0);
    expect(presence.slice(firstOffline)).not.toContain(true);
  });

  it('filters users by handle or description using Turkish casing', async () => {
    // Arrange
    await render(<UserDirectoryScreen />);

    // Act
    await fireEvent.changeText(screen.getByLabelText('Kullanıcı ara'), 'KAHVE');

    // Assert
    const handles = getUserRows().map((row) => within(row).getByText(/^@/).props.children.join(''));
    expect(handles).toEqual(expect.arrayContaining(['@kahvearasi', '@kahvekokusu']));
    expect(handles).not.toContain('@maviay');
  });

  it('shows an empty state when no user matches the search', async () => {
    // Arrange
    await render(<UserDirectoryScreen />);

    // Act
    await fireEvent.changeText(screen.getByLabelText('Kullanıcı ara'), 'zzzz');

    // Assert
    expect(screen.getByText('Kullanıcı bulunamadı')).toBeOnTheScreen();
  });

  it('clears the search and the empty state', async () => {
    // Arrange
    await render(<UserDirectoryScreen />);
    await fireEvent.changeText(screen.getByLabelText('Kullanıcı ara'), 'zzzz');

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Aramayı temizle' }));

    // Assert
    expect(screen.queryByText('Kullanıcı bulunamadı')).toBeNull();
    expect(screen.getByLabelText('Kullanıcı ara')).toHaveDisplayValue('');
  });

  it('announces the upcoming chat screen when a user is pressed', async () => {
    // Arrange
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<UserDirectoryScreen />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: /^@maviay,/ }));

    // Assert
    expect(alert).toHaveBeenCalledWith('Birazdan burada', '@maviay ile mesajlaşma ekranını sonraki adımda ekleyeceğiz.');
  });

  it('shuffles users while keeping online users first', async () => {
    // Arrange
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await render(<UserDirectoryScreen />);
    const before = getUserRows().map((row) => row.props.accessibilityLabel);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Kişileri karıştır' }));

    // Assert
    const after = getUserRows().map((row) => row.props.accessibilityLabel);
    const presence = getPresence(after);
    expect(after).not.toEqual(before);
    expect(presence.slice(presence.indexOf(false))).not.toContain(true);
  });
});
