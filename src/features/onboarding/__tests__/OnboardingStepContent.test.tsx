import { fireEvent, render, screen } from '@testing-library/react-native';
import { BioStep, GenderStep, ReviewStep, UsernameStep, genderLabels } from '../OnboardingStepContent';

jest.mock('react-native-zoom-toolkit');

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
    await render(<UsernameStep username="maviay" availability={createAvailability(status)} onChange={jest.fn()} />);

    expect(screen.getByText(text)).toBeOnTheScreen();
  });

  it('prefers the field error over the availability text', async () => {
    await render(
      <UsernameStep username="ab" availability={createAvailability('idle')} errorMessage="Kullanıcı adı en az 3 karakter olmalı." onChange={jest.fn()} />,
    );

    expect(screen.getByText('Kullanıcı adı en az 3 karakter olmalı.')).toBeOnTheScreen();
  });

  it('shows the API error and lets the user retry', async () => {
    const availability = createAvailability('error', 'Sunucuya ulaşılamadı.');
    await render(<UsernameStep username="maviay" availability={availability} onChange={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar kontrol et' }));

    expect(screen.getByText('Sunucuya ulaşılamadı.')).toBeOnTheScreen();
    expect(availability.retry).toHaveBeenCalled();
  });

  it('reports typed usernames and limits their length', async () => {
    const onChange = jest.fn();
    await render(<UsernameStep username="" availability={createAvailability('idle')} onChange={onChange} />);

    const input = screen.getByLabelText('Kullanıcı adı');
    await fireEvent.changeText(input, 'maviay');

    expect(onChange).toHaveBeenCalledWith('maviay');
    expect(input.props.maxLength).toBe(15);
  });
});

describe('GenderStep', () => {
  it('marks the selected option and reports a new choice', async () => {
    const onChange = jest.fn();
    await render(<GenderStep value="female" onChange={onChange} />);

    expect(screen.getByRole('radio', { name: /Kadın/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Erkek/ })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: /Diğer/ }));

    expect(onChange).toHaveBeenCalledWith('other');
  });

  it('shows a field error', async () => {
    await render(<GenderStep value={null} errorMessage="Bir seçenek belirle." onChange={jest.fn()} />);

    expect(screen.getByText('Bir seçenek belirle.')).toBeOnTheScreen();
  });

  it('labels every gender in Turkish', () => {
    expect(genderLabels).toEqual({ female: 'Kadın', male: 'Erkek', other: 'Diğer' });
  });
});

describe('BioStep', () => {
  it('shows the optional hint and the code point counter', async () => {
    await render(<BioStep bio="Merhaba 😀" onChange={jest.fn()} />);

    expect(screen.getByText('İstersen boş bırakabilirsin.')).toBeOnTheScreen();
    expect(screen.getByText('9/300')).toBeOnTheScreen();
  });

  it('truncates typed text to 300 code points', async () => {
    const onChange = jest.fn();
    await render(<BioStep bio="" onChange={onChange} />);

    await fireEvent.changeText(screen.getByLabelText('Biyografi'), '😀'.repeat(305));

    expect(onChange).toHaveBeenCalledWith('😀'.repeat(300));
  });

  it('shows local validation errors', async () => {
    await render(<BioStep bio={'zil\u0007'} onChange={jest.fn()} />);

    expect(screen.getByText('Biyografide desteklenmeyen kontrol karakterleri var.')).toBeOnTheScreen();
  });

  it('prefers the server field error', async () => {
    await render(<BioStep bio="Merhaba" errorMessage="Biyografi biçimini kontrol et." onChange={jest.fn()} />);

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
    await render(<ReviewStep username="maviay" genderLabel="Kadın" bio="" photo={null} onEdit={jest.fn()} />);

    expect(screen.getByText('@maviay')).toBeOnTheScreen();
    expect(screen.getByText('Kadın')).toBeOnTheScreen();
    expect(screen.getAllByText('Eklenmedi')).toHaveLength(2);
  });

  it('shows an added bio and the photo thumbnail', async () => {
    await render(<ReviewStep username="maviay" genderLabel="Kadın" bio="Merhaba" photo={photo} onEdit={jest.fn()} />);

    expect(screen.getByText('Eklendi')).toBeOnTheScreen();
    expect(screen.queryByText('Eklenmedi')).toBeNull();
  });

  it.each([
    ['Kullanıcı adı bilgisini düzenle', 0],
    ['Cinsiyet bilgisini düzenle', 1],
    ['Biyografi bilgisini düzenle', 2],
    ['Profil fotoğrafı bilgisini düzenle', 3],
  ])('edits the matching step from %p', async (name, step) => {
    const onEdit = jest.fn();
    await render(<ReviewStep username="maviay" genderLabel="Kadın" bio="" photo={null} onEdit={onEdit} />);

    await fireEvent.press(screen.getByRole('button', { name }));

    expect(onEdit).toHaveBeenCalledWith(step);
  });
});
