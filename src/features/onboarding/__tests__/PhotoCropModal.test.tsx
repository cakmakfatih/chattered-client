import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type * as ZoomToolkitMock from '../../../../__mocks__/react-native-zoom-toolkit';
import { PhotoCropModal } from '../PhotoCropModal';

jest.mock('react-native-zoom-toolkit');

const { cropZoomMock } = jest.requireMock<typeof ZoomToolkitMock>('react-native-zoom-toolkit');

const largeSource = { uri: 'file:///large.jpg', width: 2048, height: 1536 };
const defaultCropResult = { crop: { originX: 10, originY: 20, width: 900, height: 900 } };

function getCropZoomProps() {
  return JSON.parse(screen.getByTestId('crop-zoom').props.accessibilityHint) as {
    cropSize: { width: number; height: number };
    resolution: { width: number; height: number };
    maxScale: number;
  };
}

beforeEach(() => {
  cropZoomMock.nextResult = defaultCropResult;
});

describe('PhotoCropModal', () => {
  it('stays hidden without a source image', async () => {
    await render(<PhotoCropModal source={null} onCancel={jest.fn()} onConfirm={jest.fn()} />);

    expect(screen.queryByText('Fotoğrafı kırp')).toBeNull();
  });

  it('configures a square cropper for the source resolution', async () => {
    await render(<PhotoCropModal source={largeSource} onCancel={jest.fn()} onConfirm={jest.fn()} />);

    const props = getCropZoomProps();
    expect(screen.getByText('Fotoğrafı kırp')).toBeOnTheScreen();
    expect(props.cropSize.width).toBe(props.cropSize.height);
    expect(props.cropSize.width).toBeLessThanOrEqual(360);
    expect(props.resolution).toEqual({ width: 2048, height: 1536 });
  });

  it.each([
    [{ width: 2048, height: 1536 }, 1536 / 513],
    [{ width: 600, height: 800 }, 600 / 513],
    [{ width: 512, height: 512 }, 1],
  ])('limits zoom for a %p image so the crop keeps 512 pixels', async (size, maxScale) => {
    await render(<PhotoCropModal source={{ uri: 'file:///photo.jpg', ...size }} onCancel={jest.fn()} onConfirm={jest.fn()} />);

    expect(getCropZoomProps().maxScale).toBeCloseTo(maxScale);
    expect(Math.floor(Math.min(size.width, size.height) / maxScale)).toBeGreaterThanOrEqual(512);
  });

  it('draws the crop overlay once the viewport is measured', async () => {
    const { toJSON } = await render(<PhotoCropModal source={largeSource} onCancel={jest.fn()} onConfirm={jest.fn()} />);
    const { cropSize } = getCropZoomProps();

    await fireEvent(screen.getByTestId('crop-zoom').parent!, 'layout', { nativeEvent: { layout: { width: 400, height: 600 } } });

    const left = (400 - cropSize.width) / 2;
    const top = (600 - cropSize.height) / 2;
    expect(JSON.stringify(toJSON())).toContain(`M0 0H400V600H0Z M${left} ${top}h${cropSize.width}`);
  });

  it('confirms the crop rectangle and shows progress until it is applied', async () => {
    let finishCrop: () => void = () => undefined;
    const onConfirm = jest.fn(() => new Promise<void>((resolve) => { finishCrop = resolve; }));
    await render(<PhotoCropModal source={largeSource} onCancel={jest.fn()} onConfirm={onConfirm} />);

    await fireEvent.press(screen.getByText('Kırp ve kullan'));

    expect(onConfirm).toHaveBeenCalledWith(defaultCropResult.crop);
    expect(screen.getByText('Kırpılıyor…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kırpmadan vazgeç' })).toBeDisabled();

    await act(async () => finishCrop());

    expect(screen.getByText('Kırp ve kullan')).toBeOnTheScreen();
  });

  it('does nothing when the cropper has no result yet', async () => {
    cropZoomMock.nextResult = undefined;
    const onConfirm = jest.fn();
    await render(<PhotoCropModal source={largeSource} onCancel={jest.fn()} onConfirm={onConfirm} />);

    await fireEvent.press(screen.getByText('Kırp ve kullan'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each(['Kırpmadan vazgeç', 'Vazgeç'])('cancels from the %p button', async (name) => {
    const onCancel = jest.fn();
    await render(<PhotoCropModal source={largeSource} onCancel={onCancel} onConfirm={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
