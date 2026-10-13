import { fireEvent, render, screen } from '@testing-library/react-native';
import { BioStep, GenderStep, ReviewStep, UsernameStep, genderLabels } from '../OnboardingStepContent';

function createAvailability(status: 'idle' | 'waiting' | 'checking' | 'available' | 'taken' | 'error', message?: string) {
  return { status, message, retry: jest.fn() };
}

describe('UsernameStep', () => {
  it.each([
    ['idle', '3–15 karakter; küçük harf, rakam ve alt çizgi kullan.'],
    ['waiting', 'Kullanıcı adı kontrol ediliyor…'],
    ['checking', 'Kullanıcı adı kontrol ediliyor…'],
    ['available', 'Bu kullanıcı adı uygun.'],
    ['taken', 'Bu kullanıcı adı kullanımda.'],
    ['error', 'Kullanıcı adı şu an kontrol edilemedi.'],
  ] as const)('describes the %p availability', async (status, text) => {
    // Arrange
    const availability = createAvailability(status);

    // Act
    await render(<UsernameStep username="maviay" availability={availability} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText(text)).toBeOnTheScreen();
  });

  it('prefers the field error over the availability text', async () => {
    // Arrange
    const errorMessage = 'Kullanıcı adı en az 3 karakter olmalı.';

    // Act
    await render(<UsernameStep username="ab" availability={createAvailability('idle')} errorMessage={errorMessage} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Kullanıcı adı en az 3 karakter olmalı.')).toBeOnTheScreen();
  });

  it('shows the API error message', async () => {
    // Arrange
    const availability = createAvailability('error', 'Sunucuya ulaşılamadı.');

    // Act
    await render(<UsernameStep username="maviay" availability={availability} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Sunucuya ulaşılamadı.')).toBeOnTheScreen();
  });

  it('retries the check from the retry link', async () => {
    // Arrange
    const availability = createAvailability('error', 'Sunucuya ulaşılamadı.');
    await render(<UsernameStep username="maviay" availability={availability} onChange={jest.fn()} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar kontrol et' }));

    // Assert
    expect(availability.retry).toHaveBeenCalled();
  });

  it('reports typed usernames and limits their length', async () => {
    // Arrange
    const onChange = jest.fn();
    await render(<UsernameStep username="" availability={createAvailability('idle')} onChange={onChange} />);
    const input = screen.getByLabelText('Kullanıcı adı');

    // Act
    await fireEvent.changeText(input, 'maviay');

    // Assert
    expect(onChange).toHaveBeenCalledWith('maviay');
    expect(input.props.maxLength).toBe(15);
  });
});

describe('GenderStep', () => {
  it('marks only the selected option', async () => {
    // Arrange
    const value = 'female';

    // Act
    await render(<GenderStep value={value} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByRole('radio', { name: /Kadın/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Erkek/ })).not.toBeChecked();
  });

  it('reports a new choice', async () => {
    // Arrange
    const onChange = jest.fn();
    await render(<GenderStep value="female" onChange={onChange} />);

    // Act
    await fireEvent.press(screen.getByRole('radio', { name: /Diğer/ }));

    // Assert
    expect(onChange).toHaveBeenCalledWith('other');
  });

  it('shows a field error', async () => {
    // Arrange
    const errorMessage = 'Bir seçenek belirle.';

    // Act
    await render(<GenderStep value={null} errorMessage={errorMessage} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Bir seçenek belirle.')).toBeOnTheScreen();
  });

  it('labels every gender in Turkish', () => {
    // Arrange
    const expectedLabels = { female: 'Kadın', male: 'Erkek', other: 'Diğer' };

    // Act
    const labels = genderLabels;

    // Assert
    expect(labels).toEqual(expectedLabels);
  });
});

describe('BioStep', () => {
  it('shows the optional hint and the code point counter', async () => {
    // Arrange
    const bio = 'Merhaba 😀';

    // Act
    await render(<BioStep bio={bio} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('İstersen boş bırakabilirsin.')).toBeOnTheScreen();
    expect(screen.getByText('9/300')).toBeOnTheScreen();
  });

  it('truncates typed text to 300 code points', async () => {
    // Arrange
    const onChange = jest.fn();
    await render(<BioStep bio="" onChange={onChange} />);

    // Act
    await fireEvent.changeText(screen.getByLabelText('Biyografi'), '😀'.repeat(305));

    // Assert
    expect(onChange).toHaveBeenCalledWith('😀'.repeat(300));
  });

  it('shows local validation errors', async () => {
    // Arrange
    const bio = 'zil\u0007';

    // Act
    await render(<BioStep bio={bio} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Biyografide desteklenmeyen kontrol karakterleri var.')).toBeOnTheScreen();
  });

  it('prefers the server field error', async () => {
    // Arrange
    const errorMessage = 'Biyografi biçimini kontrol et.';

    // Act
    await render(<BioStep bio="Merhaba" errorMessage={errorMessage} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Biyografi biçimini kontrol et.')).toBeOnTheScreen();
  });
});

describe('ReviewStep', () => {
  const photo = {
    uri: 'file:///photo.jpg',
    width: 600,
    height: 600,
    file_name: 'profile-photo.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 1,
  };

  it('summarises the draft', async () => {
    // Arrange
    const draft = { username: 'maviay', genderLabel: 'Kadın', bio: '', photo: null };

    // Act
    await render(<ReviewStep {...draft} onEdit={jest.fn()} />);

    // Assert
    expect(screen.getByText('@maviay')).toBeOnTheScreen();
    expect(screen.getByText('Kadın')).toBeOnTheScreen();
    expect(screen.getAllByText('Eklenmedi')).toHaveLength(2);
  });

  it('shows an added bio and the photo thumbnail', async () => {
    // Arrange
    const draft = { username: 'maviay', genderLabel: 'Kadın', bio: 'Merhaba', photo };

    // Act
    await render(<ReviewStep {...draft} onEdit={jest.fn()} />);

    // Assert
    expect(screen.getByText('Eklendi')).toBeOnTheScreen();
    expect(screen.queryByText('Eklenmedi')).toBeNull();
  });

  it.each([
    ['Kullanıcı adı bilgisini düzenle', 0],
    ['Cinsiyet bilgisini düzenle', 1],
    ['Biyografi bilgisini düzenle', 2],
    ['Profil fotoğrafı bilgisini düzenle', 3],
  ])('edits the matching step from %p', async (name, step) => {
    // Arrange
    const onEdit = jest.fn();
    await render(<ReviewStep username="maviay" genderLabel="Kadın" bio="" photo={null} onEdit={onEdit} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name }));

    // Assert
    expect(onEdit).toHaveBeenCalledWith(step);
  });
});
