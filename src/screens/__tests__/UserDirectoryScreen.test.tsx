import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { UserDirectoryScreen } from '../UserDirectoryScreen';

function getUserRows() {
  return screen.getAllByRole('button').filter((button) => /^@/.test(String(button.props.accessibilityLabel)));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('UserDirectoryScreen', () => {
  it('lists online users before offline users', async () => {
    await render(<UserDirectoryScreen />);

    const presence = getUserRows().map((row) => String(row.props.accessibilityLabel).endsWith(', çevrimiçi'));
    const firstOffline = presence.indexOf(false);

    expect(screen.getAllByText('Keşfet').length).toBeGreaterThan(0);
    expect(firstOffline).toBeGreaterThan(0);
    expect(presence.slice(firstOffline)).not.toContain(true);
  });

  it('filters users by handle or description using Turkish casing', async () => {
    await render(<UserDirectoryScreen />);

    await fireEvent.changeText(screen.getByLabelText('Kullanıcı ara'), 'KAHVE');

    const handles = getUserRows().map((row) => within(row).getByText(/^@/).props.children.join(''));
    expect(handles).toEqual(expect.arrayContaining(['@kahvearasi', '@kahvekokusu']));
    expect(handles).not.toContain('@maviay');
  });

  it('shows an empty state and clears the search', async () => {
    await render(<UserDirectoryScreen />);

    await fireEvent.changeText(screen.getByLabelText('Kullanıcı ara'), 'zzzz');
    expect(screen.getByText('Kullanıcı bulunamadı')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Aramayı temizle' }));

    expect(screen.queryByText('Kullanıcı bulunamadı')).toBeNull();
    expect(screen.getByLabelText('Kullanıcı ara')).toHaveDisplayValue('');
  });

  it('announces the upcoming chat screen when a user is pressed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<UserDirectoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^@maviay,/ }));

    expect(alert).toHaveBeenCalledWith('Birazdan burada', '@maviay ile mesajlaşma ekranını sonraki adımda ekleyeceğiz.');
  });

  it('shuffles users while keeping online users first', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await render(<UserDirectoryScreen />);
    const before = getUserRows().map((row) => row.props.accessibilityLabel);

    await fireEvent.press(screen.getByRole('button', { name: 'Kişileri karıştır' }));

    const after = getUserRows().map((row) => row.props.accessibilityLabel);
    const presence = after.map((label) => String(label).endsWith(', çevrimiçi'));
    expect(after).not.toEqual(before);
    expect(presence.slice(presence.indexOf(false))).not.toContain(true);
  });
});
