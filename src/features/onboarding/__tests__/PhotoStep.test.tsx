import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, type AlertButton } from 'react-native';
import type * as ZoomToolkitMock from '../../../../__mocks__/react-native-zoom-toolkit';
import { PhotoStep } from '../PhotoStep';
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

async function openCropper() {
  await pressPicker('Kamera');
  await screen.findByText(cropTitle);
}

function mockPendingCamera() {
  const pending = { finish: (_result: unknown) => undefined as void };
  jest.mocked(ImagePicker.launchCameraAsync).mockReturnValue(new Promise((resolve) => { pending.finish = resolve; }) as never);
  return pending;
}

function mockAlert() {
  return jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
}

describe('PhotoStep picking', () => {
  it('opens the cropper for a camera photo', async () => {
    // Arrange
    await renderPhotoStep();

    // Act
    await pressPicker('Kamera');

    // Assert
    expect(await screen.findByText(cropTitle)).toBeOnTheScreen();
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    expect(loadSourceImage).toHaveBeenCalledWith('file:///picked.jpg');
  });

  it('crops the picked photo and selects the result', async () => {
    // Arrange
    const { onChange } = await renderPhotoStep();
    await openCropper();

    // Act
    await confirmCrop();

    // Assert
    expect(createSquarePhoto).toHaveBeenCalledWith(sourceImage, cropRect);
    expect(onChange).toHaveBeenCalledWith(croppedPhoto);
    expect(screen.queryByText(cropTitle)).toBeNull();
  });

  it('picks from the gallery with the media library permission', async () => {
    // Arrange
    await renderPhotoStep();

    // Act
    await pressPicker('Galeri');

    // Assert
    expect(await screen.findByText(cropTitle)).toBeOnTheScreen();
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  });

  it('disables both picker buttons while a picker is open', async () => {
    // Arrange
    mockPendingCamera();
    await renderPhotoStep();

    // Act
    await pressPicker('Kamera');

    // Assert
    await waitFor(() => expect(screen.getByRole('button', { name: 'Galeri' })).toBeDisabled());
  });

  it('enables the picker buttons again once the picker closes', async () => {
    // Arrange
    const pendingCamera = mockPendingCamera();
    await renderPhotoStep();
    await pressPicker('Kamera');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Galeri' })).toBeDisabled());

    // Act
    await act(async () => pendingCamera.finish({ canceled: true, assets: null }));

    // Assert
    expect(screen.getByRole('button', { name: 'Galeri' })).toBeEnabled();
  });

  it('does nothing when picking is cancelled', async () => {
    // Arrange
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: true, assets: null } as never);
    const { onChange } = await renderPhotoStep();

    // Act
    await pressPicker('Kamera');

    // Assert
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kamera' })).toBeEnabled());
    expect(loadSourceImage).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects files that are not images', async () => {
    // Arrange
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [{ ...pickedImage.assets[0], type: 'video' }] } as never);
    await renderPhotoStep();

    // Act
    await pressPicker('Kamera');

    // Assert
    expect(await screen.findByText('Bir fotoğraf dosyası seçmelisin.')).toBeOnTheScreen();
  });

  it('rejects source images smaller than the minimum size', async () => {
    // Arrange
    jest.mocked(loadSourceImage).mockResolvedValue({ uri: 'file:///small.jpg', width: 400, height: 900 });
    const { onPhotoRejected } = await renderPhotoStep();

    // Act
    await pressPicker('Kamera');

    // Assert
    await waitFor(() => expect(onPhotoRejected).toHaveBeenCalledWith(photoTooSmallMessage));
    expect(screen.queryByText(cropTitle)).toBeNull();
  });

  it('reports a photo that cannot be opened', async () => {
    // Arrange
    jest.mocked(loadSourceImage).mockRejectedValue(new Error('decode failed'));
    await renderPhotoStep();

    // Act
    await pressPicker('Kamera');

    // Assert
    expect(await screen.findByText('Fotoğraf açılamadı. Tekrar deneyebilir veya bu adımı atlayabilirsin.')).toBeOnTheScreen();
  });
});

describe('PhotoStep permissions', () => {
  it('explains a denied permission that can be asked again', async () => {
    // Arrange
    const alert = mockAlert();
    denyPermission(true);
    await renderPhotoStep();

    // Act
    await pressPicker('Kamera');

    // Assert
    await waitFor(() => expect(alert).toHaveBeenCalledWith(
      'İzin gerekli',
      'Kamera erişim izni verilmedi. İzin vermeden de bu adımı atlayabilirsin.',
      [{ text: 'Tamam' }],
    ));
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('offers the settings when the permission is permanently denied', async () => {
    // Arrange
    const alert = mockAlert();
    denyPermission(false);
    await renderPhotoStep();

    // Act
    await pressPicker('Kamera');

    // Assert
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(getAlertButtons(alert).map((button) => button.text)).toEqual(['Vazgeç', 'Ayarları aç']);
  });

  it('opens the settings from the permission alert', async () => {
    // Arrange
    const alert = mockAlert();
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    denyPermission(false);
    await renderPhotoStep();
    await pressPicker('Kamera');
    await waitFor(() => expect(alert).toHaveBeenCalled());
    const settingsButton = getAlertButtons(alert).find((button) => button.text === 'Ayarları aç');

    // Act
    settingsButton?.onPress?.();

    // Assert
    expect(openSettings).toHaveBeenCalled();
  });

  it('names the photo library in the gallery permission message', async () => {
    // Arrange
    const alert = mockAlert();
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ ...grantedPermission, granted: false } as never);
    await renderPhotoStep();

    // Act
    await pressPicker('Galeri');

    // Assert
    await waitFor(() => expect(alert.mock.calls[0]?.[1]).toBe('Fotoğraf arşivi erişim izni verilmedi. İzin vermeden de bu adımı atlayabilirsin.'));
  });
});

describe('PhotoStep cropping', () => {
  it('closes the cropper when cropping is cancelled', async () => {
    // Arrange
    const { onChange } = await renderPhotoStep();
    await openCropper();

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Vazgeç' }));

    // Assert
    expect(screen.queryByText(cropTitle)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a crop that ends up below the minimum size', async () => {
    // Arrange
    jest.mocked(createSquarePhoto).mockResolvedValue({ ...croppedPhoto, width: 500, height: 500 });
    const { onChange, onPhotoRejected } = await renderPhotoStep();
    await openCropper();

    // Act
    await confirmCrop();

    // Assert
    expect(onPhotoRejected).toHaveBeenCalledWith(photoTooSmallMessage);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the metadata error of an invalid cropped file', async () => {
    // Arrange
    jest.mocked(createSquarePhoto).mockResolvedValue({ ...croppedPhoto, size_bytes: 11 * 1024 * 1024 });
    const { onChange } = await renderPhotoStep();
    await openCropper();

    // Act
    await confirmCrop();

    // Assert
    expect(screen.getByText('Fotoğraf en fazla 10 MiB olabilir.')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a crop that fails', async () => {
    // Arrange
    jest.mocked(createSquarePhoto).mockRejectedValue(new Error('crop failed'));
    await renderPhotoStep();
    await openCropper();

    // Act
    await confirmCrop();

    // Assert
    expect(screen.getByText('Fotoğraf kırpılamadı. Tekrar deneyebilir veya bu adımı atlayabilirsin.')).toBeOnTheScreen();
    expect(screen.queryByText(cropTitle)).toBeNull();
  });
});

describe('PhotoStep selected photo', () => {
  const closePreviewName = 'Tam ekran önizlemeyi kapat';

  it('removes the selected photo', async () => {
    // Arrange
    const { onChange } = await renderPhotoStep({ photo: croppedPhoto });

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Fotoğrafı kaldır' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('keeps the fullscreen preview closed by default', async () => {
    // Arrange
    const props = { photo: croppedPhoto };

    // Act
    await renderPhotoStep(props);

    // Assert
    expect(screen.queryByRole('button', { name: closePreviewName })).toBeNull();
  });

  it('opens the fullscreen preview from the photo', async () => {
    // Arrange
    await renderPhotoStep({ photo: croppedPhoto });

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Profil fotoğrafını tam ekran görüntüle' }));

    // Assert
    expect(screen.getByRole('button', { name: closePreviewName })).toBeOnTheScreen();
  });

  it('closes the fullscreen preview', async () => {
    // Arrange
    await renderPhotoStep({ photo: croppedPhoto });
    await fireEvent.press(screen.getByRole('button', { name: 'Profil fotoğrafını tam ekran görüntüle' }));

    // Act
    await fireEvent.press(screen.getByRole('button', { name: closePreviewName }));

    // Assert
    expect(screen.queryByRole('button', { name: closePreviewName })).toBeNull();
  });

  it.each([
    ['the validation error of the selected photo', { photo: { ...croppedPhoto, mime_type: 'image/gif' } }, 'Fotoğrafın dosya türü desteklenmiyor.'],
    ['the error from the parent', { photo: croppedPhoto, errorMessage: 'Fotoğraf yüklenemedi.' }, 'Fotoğraf yüklenemedi.'],
  ])('shows %s', async (_case, props, message) => {
    // Arrange
    const stepProps = props;

    // Act
    await renderPhotoStep(stepProps);

    // Assert
    expect(screen.getByText(message)).toBeOnTheScreen();
  });
});

describe('PhotoStep source sheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function finishSheetAnimation() {
    await act(async () => { jest.runAllTimers(); });
  }

  async function openSourceSheet() {
    await fireEvent.press(screen.getByRole('button', { name: 'Profil fotoğrafı ekle' }));
    await finishSheetAnimation();
  }

  async function closeSourceSheetFromBackdrop() {
    await fireEvent.press(screen.getByRole('button', { name: sheetTitle }));
    await finishSheetAnimation();
  }

  async function pressSheetOption(label: 'Kamera' | 'Galeri') {
    const sheetOptions = screen.getAllByRole('button', { name: label });
    await fireEvent.press(sheetOptions[sheetOptions.length - 1]);
  }

  it('opens from the placeholder', async () => {
    // Arrange
    await renderPhotoStep();

    // Act
    await openSourceSheet();

    // Assert
    expect(screen.getByRole('button', { name: sheetTitle })).toBeOnTheScreen();
  });

  it('closes from the backdrop without picking a photo', async () => {
    // Arrange
    await renderPhotoStep();
    await openSourceSheet();

    // Act
    await closeSourceSheetFromBackdrop();

    // Assert
    expect(screen.queryByRole('button', { name: sheetTitle })).toBeNull();
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['Kamera', ImagePicker.launchCameraAsync],
    ['Galeri', ImagePicker.launchImageLibraryAsync],
  ] as const)('waits for the sheet to close before launching %p', async (label, launcher) => {
    // Arrange
    await renderPhotoStep();
    await openSourceSheet();

    // Act
    await pressSheetOption(label);

    // Assert
    expect(launcher).not.toHaveBeenCalled();
  });

  it.each([
    ['Kamera', ImagePicker.launchCameraAsync],
    ['Galeri', ImagePicker.launchImageLibraryAsync],
  ] as const)('launches %p after the sheet has closed', async (label, launcher) => {
    // Arrange
    await renderPhotoStep();
    await openSourceSheet();
    await pressSheetOption(label);

    // Act
    await finishSheetAnimation();

    // Assert
    expect(launcher).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: sheetTitle })).toBeNull();
  });
});
