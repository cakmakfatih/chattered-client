import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { View } from 'react-native';

type CropZoomMockProps = {
  children?: ReactNode;
  OverlayComponent?: () => ReactNode;
  cropSize: { width: number; height: number };
  resolution: { width: number; height: number };
  maxScale?: number;
};

type CropResult = { crop: { originX: number; originY: number; width: number; height: number } };

/** Crop result returned by the next `crop()` call; tests replace it to simulate gestures. */
export const cropZoomMock: { nextResult: CropResult | undefined } = {
  nextResult: { crop: { originX: 0, originY: 0, width: 600, height: 600 } },
};

/** Gesture-free CropZoom stand-in: exposes the props for assertions and a scripted `crop()` result. */
export const CropZoom = forwardRef<{ crop: () => CropResult | undefined }, CropZoomMockProps>(
  function CropZoom({ children, OverlayComponent, cropSize, resolution, maxScale }, ref) {
    useImperativeHandle(ref, () => ({ crop: () => cropZoomMock.nextResult }));
    return (
      <View testID="crop-zoom" accessibilityHint={JSON.stringify({ cropSize, resolution, maxScale })}>
        {children}
        {OverlayComponent ? <OverlayComponent /> : null}
      </View>
    );
  },
);

export type CropZoomRefType = { crop: () => CropResult | undefined };
