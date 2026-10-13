import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, type AlertButton } from 'react-native';
import type * as ZoomToolkitMock from '../../../../__mocks__/react-native-zoom-toolkit';
import { PhotoStep } from '../OnboardingStepContent';
import { createSquarePhoto, loadSourceImage } from '../photoProcessing';
import type { SelectedPhoto } from '../types';
import { photoTooSmallMessage } from '../validation';

jest.mock('react-native-zoom-toolkit');

const { cropZoomMock } = jest.requireMock<typeof ZoomToolkitMock>('react-native-zoom-toolkit');
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../photoProcessing', () => ({
  loadSourceImage: jest.fn(),
  createSquarePhoto: jest.fn(),
}));

const grantedPermission = { granted: true, canAskAgain: true, status: 'granted', expires: 'never' };
const pickedImage = { canceled: false, assets: [{ uri: 'file:///picked.jpg', type: 'image', width: 2000, height: 1500 }] };
const sourceImage = { uri: 'file:///picked.jpg', width: 2000, height: 1500 };
const cropRect = { originX: 100, originY: 0, width: 1500, height: 1500 };
const croppedPhoto: SelectedPhoto = {
  uri: 'file:///cropped.jpg',
  width: 1024,
  height: 1024,
  file_name: 'profile-photo.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 200_000,
};

const cropTitle = 'Fotoğrafı kırp';
const sheetTitle = 'Fotoğraf seçeneklerini kapat';

async function renderPhotoStep(props: Partial<Parameters<typeof PhotoStep>[0]> = {}) {
  const callbacks = { onChange: jest.fn(), onPhotoRejected: jest.fn() };
  await render(<PhotoStep photo={null} {...callbacks} {...props} />);
  return callbacks;
}

async function pressPicker(label: 'Kamera' | 'Galeri') {
  await fireEvent.press(screen.getAllByRole('button', { name: label })[0]);
}

async function confirmCrop() {
  await fireEvent.press(await screen.findByText('Kırp ve kullan'));
}

function denyPermission(canAskAgain: boolean) {
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ ...grantedPermission, granted: false, canAskAgain } as never);
}

function getAlertButtons(alert: jest.SpyInstance): AlertButton[] {
  return alert.mock.calls[0][2] as AlertButton[];
}

beforeEach(() => {
  cropZoomMock.nextResult = { crop: cropRect };
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue(grantedPermission as never);
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(grantedPermission as never);
  jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue(pickedImage as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(pickedImage as never);
  jest.mocked(loadSourceImage).mockResolvedValue(sourceImage);
  jest.mocked(createSquarePhoto).mockResolvedValue(croppedPhoto);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PhotoStep picking', () => {
  it('takes a camera photo, crops it and selects the result', async () => {
    const { onChange } = await renderPhotoStep();

    await pressPicker('Kamera');
    expect(await screen.findByText(cropTitle)).toBeOnTheScreen();
    await confirmCrop();

    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    expect(loadSourceImage).toHaveBeenCalledWith('file:///picked.jpg');
    expect(createSquarePhoto).toHaveBeenCalledWith(sourceImage, cropRect);
    expect(onChange).toHaveBeenCalledWith(croppedPhoto);
    expect(screen.queryByText(cropTitle)).toBeNull();
  });

  it('picks from the gallery with the media library permission', async () => {
    await renderPhotoStep();

    await pressPicker('Galeri');

    expect(await screen.findByText(cropTitle)).toBeOnTheScreen();
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  });

  it('disables both picker buttons while a picker is open', async () => {
    let finishPicking: (value: unknown) => void = () => undefined;
    jest.mocked(ImagePicker.launchCameraAsync).mockReturnValue(new Promise((resolve) => { finishPicking = resolve; }) as never);
    await renderPhotoStep();

    await pressPicker('Kamera');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Galeri' })).toBeDisabled());
    await act(async () => finishPicking({ canceled: true, assets: null }));
    expect(screen.getByRole('button', { name: 'Galeri' })).toBeEnabled();
  });

  it('does nothing when picking is cancelled', async () => {
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: true, assets: null } as never);
    const { onChange } = await renderPhotoStep();

    await pressPicker('Kamera');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Kamera' })).toBeEnabled());
    expect(loadSourceImage).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects files that are not images', async () => {
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [{ ...pickedImage.assets[0], type: 'video' }] } as never);
    await renderPhotoStep();

    await pressPicker('Kamera');

    expect(await screen.findByText('Bir fotoğraf dosyası seçmelisin.')).toBeOnTheScreen();
  });

  it('rejects source images smaller than the minimum size', async () => {
    jest.mocked(loadSourceImage).mockResolvedValue({ uri: 'file:///small.jpg', width: 400, height: 900 });
    const { onPhotoRejected } = await renderPhotoStep();

    await pressPicker('Kamera');

    await waitFor(() => expect(onPhotoRejected).toHaveBeenCalledWith(photoTooSmallMessage));
    expect(screen.queryByText(cropTitle)).toBeNull();
  });

  it('reports a photo that cannot be opened', async () => {
    jest.mocked(loadSourceImage).mockRejectedValue(new Error('decode failed'));
    await renderPhotoStep();

    await pressPicker('Kamera');

    expect(await screen.findByText('Fotoğraf açılamadı. Tekrar deneyebilir veya bu adımı atlayabilirsin.')).toBeOnTheScreen();
  });
});

describe('PhotoStep permissions', () => {
  it('explains a denied permission that can be asked again', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    denyPermission(true);
    await renderPhotoStep();

    await pressPicker('Kamera');

    await waitFor(() => expect(alert).toHaveBeenCalledWith(
      'İzin gerekli',
      'Kamera erişim izni verilmedi. İzin vermeden de bu adımı atlayabilirsin.',
      [{ text: 'Tamam' }],
    ));
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('offers the settings when the permission is permanently denied', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    denyPermission(false);
    await renderPhotoStep();

    await pressPicker('Kamera');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    const settingsButton = getAlertButtons(alert).find((button) => button.text === 'Ayarları aç');
    settingsButton?.onPress?.();

    expect(getAlertButtons(alert).map((button) => button.text)).toEqual(['Vazgeç', 'Ayarları aç']);
    expect(openSettings).toHaveBeenCalled();
  });

  it('names the photo library in the gallery permission message', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ ...grantedPermission, granted: false } as never);
    await renderPhotoStep();

    await pressPicker('Galeri');

    await waitFor(() => expect(alert.mock.calls[0]?.[1]).toBe('Fotoğraf arşivi erişim izni verilmedi. İzin vermeden de bu adımı atlayabilirsin.'));
  });
});

describe('PhotoStep cropping', () => {
  it('closes the cropper when cropping is cancelled', async () => {
    const { onChange } = await renderPhotoStep();
    await pressPicker('Kamera');

    await fireEvent.press(await screen.findByRole('button', { name: 'Vazgeç' }));

    expect(screen.queryByText(cropTitle)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a crop that ends up below the minimum size', async () => {
    jest.mocked(createSquarePhoto).mockResolvedValue({ ...croppedPhoto, width: 500, height: 500 });
    const { onChange, onPhotoRejected } = await renderPhotoStep();
    await pressPicker('Kamera');

    await confirmCrop();

    expect(onPhotoRejected).toHaveBeenCalledWith(photoTooSmallMessage);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the metadata error of an invalid cropped file', async () => {
    jest.mocked(createSquarePhoto).mockResolvedValue({ ...croppedPhoto, size_bytes: 11 * 1024 * 1024 });
    const { onChange } = await renderPhotoStep();
    await pressPicker('Kamera');

    await confirmCrop();

    expect(screen.getByText('Fotoğraf en fazla 10 MiB olabilir.')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a crop that fails', async () => {
    jest.mocked(createSquarePhoto).mockRejectedValue(new Error('crop failed'));
    await renderPhotoStep();
    await pressPicker('Kamera');

    await confirmCrop();

    expect(screen.getByText('Fotoğraf kırpılamadı. Tekrar deneyebilir veya bu adımı atlayabilirsin.')).toBeOnTheScreen();
    expect(screen.queryByText(cropTitle)).toBeNull();
  });
});

describe('PhotoStep selected photo', () => {
  it('removes the selected photo', async () => {
    const { onChange } = await renderPhotoStep({ photo: croppedPhoto });

    await fireEvent.press(screen.getByRole('button', { name: 'Fotoğrafı kaldır' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('opens and closes the fullscreen preview', async () => {
    await renderPhotoStep({ photo: croppedPhoto });
    expect(screen.queryByRole('button', { name: 'Tam ekran önizlemeyi kapat' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Profil fotoğrafını tam ekran görüntüle' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tam ekran önizlemeyi kapat' }));

    expect(screen.queryByRole('button', { name: 'Tam ekran önizlemeyi kapat' })).toBeNull();
  });

  it('shows validation and parent errors', async () => {
    const { rerender } = await render(
      <PhotoStep photo={{ ...croppedPhoto, mime_type: 'image/gif' }} onChange={jest.fn()} onPhotoRejected={jest.fn()} />,
    );
    expect(screen.getByText('Fotoğrafın dosya türü desteklenmiyor.')).toBeOnTheScreen();

    await rerender(<PhotoStep photo={croppedPhoto} errorMessage="Fotoğraf yüklenemedi." onChange={jest.fn()} onPhotoRejected={jest.fn()} />);

    expect(screen.getByText('Fotoğraf yüklenemedi.')).toBeOnTheScreen();
  });
});

describe('PhotoStep source sheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function openSourceSheet() {
    await fireEvent.press(screen.getByRole('button', { name: 'Profil fotoğrafı ekle' }));
    await act(async () => { jest.runAllTimers(); });
  }

  async function finishSheetAnimation() {
    await act(async () => { jest.runAllTimers(); });
  }

  it('opens from the placeholder and closes from the backdrop', async () => {
    await renderPhotoStep();

    await openSourceSheet();
    expect(screen.getByRole('button', { name: sheetTitle })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: sheetTitle }));
    await finishSheetAnimation();

    expect(screen.queryByRole('button', { name: sheetTitle })).toBeNull();
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['Kamera', ImagePicker.launchCameraAsync],
    ['Galeri', ImagePicker.launchImageLibraryAsync],
  ] as const)('launches %p after the sheet has closed', async (label, launcher) => {
    await renderPhotoStep();
    await openSourceSheet();

    const sheetOptions = screen.getAllByRole('button', { name: label });
    await fireEvent.press(sheetOptions[sheetOptions.length - 1]);
    expect(launcher).not.toHaveBeenCalled();
    await finishSheetAnimation();

    expect(launcher).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: sheetTitle })).toBeNull();
  });
});
