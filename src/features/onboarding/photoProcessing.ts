import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { SelectedPhoto } from './types';

export type SourceImage = {
  uri: string;
  width: number;
  height: number;
};

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

const maxCroppedPhotoDimension = 1024;
const croppedPhotoQuality = 0.9;
const croppedPhotoFileName = 'profile-photo.jpg';

/** Decodes the image the same way the cropper output is produced, so crop coordinates share one pixel space. */
export async function loadSourceImage(uri: string): Promise<SourceImage> {
  const context = ImageManipulator.manipulate(uri);
  try {
    const image = await context.renderAsync();
    const { width, height } = image;
    image.release();
    return { uri, width, height };
  } finally {
    context.release();
  }
}

export async function createSquarePhoto(source: SourceImage, cropRect: CropRect): Promise<SelectedPhoto> {
  const squareRect = toSquareRect(source, cropRect);
  const outputSide = Math.min(squareRect.width, maxCroppedPhotoDimension);
  const context = ImageManipulator.manipulate(source.uri).crop(squareRect);
  if (outputSide < squareRect.width) context.resize({ width: outputSide, height: outputSide });

  try {
    const image = await context.renderAsync();
    try {
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: croppedPhotoQuality });
      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        file_name: croppedPhotoFileName,
        mime_type: 'image/jpeg',
        size_bytes: new File(result.uri).size,
      };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

function toSquareRect(source: SourceImage, cropRect: CropRect): CropRect {
  const side = Math.max(1, Math.floor(Math.min(cropRect.width, cropRect.height, source.width, source.height)));
  return {
    originX: clampOrigin(cropRect.originX, side, source.width),
    originY: clampOrigin(cropRect.originY, side, source.height),
    width: side,
    height: side,
  };
}

function clampOrigin(origin: number, side: number, sourceLength: number): number {
  return Math.min(Math.max(0, Math.round(origin)), sourceLength - side);
}
