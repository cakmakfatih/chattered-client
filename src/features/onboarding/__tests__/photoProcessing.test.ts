import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createSquarePhoto, loadSourceImage } from '../photoProcessing';

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

jest.mock('expo-file-system', () => ({ File: jest.fn() }));

type ManipulatorContextMock = {
  crop: jest.Mock;
  resize: jest.Mock;
  renderAsync: jest.Mock;
  release: jest.Mock;
};

function mockManipulator(renderedImage: object): ManipulatorContextMock {
  const context: ManipulatorContextMock = {
    crop: jest.fn(),
    resize: jest.fn(),
    renderAsync: jest.fn().mockResolvedValue(renderedImage),
    release: jest.fn(),
  };
  context.crop.mockReturnValue(context);
  context.resize.mockReturnValue(context);
  jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
  return context;
}

function mockSavedImage(result: { uri: string; width: number; height: number }) {
  return {
    saveAsync: jest.fn().mockResolvedValue(result),
    release: jest.fn(),
  };
}

beforeEach(() => {
  jest.mocked(File).mockImplementation(() => ({ size: 98_765 }) as never);
});

describe('loadSourceImage', () => {
  it('returns the decoded dimensions and releases native objects', async () => {
    // Arrange
    const image = { width: 3024, height: 4032, release: jest.fn() };
    const context = mockManipulator(image);

    // Act
    const sourceImage = await loadSourceImage('file:///original.heic');

    // Assert
    expect(sourceImage).toEqual({ uri: 'file:///original.heic', width: 3024, height: 4032 });
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///original.heic');
    expect(image.release).toHaveBeenCalled();
    expect(context.release).toHaveBeenCalled();
  });

  it('releases the context when decoding fails', async () => {
    // Arrange
    const context = mockManipulator({});
    context.renderAsync.mockRejectedValue(new Error('decode failed'));

    // Act
    const loading = loadSourceImage('file:///broken.jpg');

    // Assert
    await expect(loading).rejects.toThrow('decode failed');
    expect(context.release).toHaveBeenCalled();
  });
});

describe('createSquarePhoto', () => {
  const source = { uri: 'file:///original.jpg', width: 2000, height: 1500 };

  it('crops a square, downsizes it to 1024 pixels and exports a JPEG', async () => {
    // Arrange
    const image = mockSavedImage({ uri: 'file:///cropped.jpg', width: 1024, height: 1024 });
    const context = mockManipulator(image);

    // Act
    const photo = await createSquarePhoto(source, { originX: 100.4, originY: 50.6, width: 1400.9, height: 1400.2 });

    // Assert
    expect(context.crop).toHaveBeenCalledWith({ originX: 100, originY: 51, width: 1400, height: 1400 });
    expect(context.resize).toHaveBeenCalledWith({ width: 1024, height: 1024 });
    expect(image.saveAsync).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: 0.9 });
    expect(File).toHaveBeenCalledWith('file:///cropped.jpg');
    expect(photo).toEqual({
      uri: 'file:///cropped.jpg',
      width: 1024,
      height: 1024,
      file_name: 'profile-photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 98_765,
    });
    expect(image.release).toHaveBeenCalled();
    expect(context.release).toHaveBeenCalled();
  });

  it('keeps the cropped size when it is already small enough', async () => {
    // Arrange
    const context = mockManipulator(mockSavedImage({ uri: 'file:///cropped.jpg', width: 700, height: 700 }));

    // Act
    await createSquarePhoto(source, { originX: 0, originY: 0, width: 700, height: 700 });

    // Assert
    expect(context.resize).not.toHaveBeenCalled();
  });

  it('squares a rectangular crop using its shorter side', async () => {
    // Arrange
    const context = mockManipulator(mockSavedImage({ uri: 'file:///cropped.jpg', width: 600, height: 600 }));

    // Act
    await createSquarePhoto(source, { originX: 10, originY: 20, width: 900, height: 600 });

    // Assert
    expect(context.crop).toHaveBeenCalledWith({ originX: 10, originY: 20, width: 600, height: 600 });
  });

  it('clamps the crop inside the source image', async () => {
    // Arrange
    const context = mockManipulator(mockSavedImage({ uri: 'file:///cropped.jpg', width: 1024, height: 1024 }));

    // Act
    await createSquarePhoto(source, { originX: 1900, originY: -40, width: 1600, height: 1600 });

    // Assert
    expect(context.crop).toHaveBeenCalledWith({ originX: 500, originY: 0, width: 1500, height: 1500 });
  });

  it('releases native objects when saving fails', async () => {
    // Arrange
    const image = mockSavedImage({ uri: '', width: 0, height: 0 });
    image.saveAsync.mockRejectedValue(new Error('disk full'));
    const context = mockManipulator(image);

    // Act
    const creating = createSquarePhoto(source, { originX: 0, originY: 0, width: 600, height: 600 });

    // Assert
    await expect(creating).rejects.toThrow('disk full');
    expect(image.release).toHaveBeenCalled();
    expect(context.release).toHaveBeenCalled();
  });
});
