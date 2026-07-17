import {
  CLOUDINARY_MAX_IMAGE_BYTES,
  CloudinaryUploadError,
  validateCloudinaryImage,
  validateCloudinaryImageType,
} from './cloudinary';

export const IMAGE_COMPRESSION_MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const IMAGE_COMPRESSION_MAX_PIXELS = 32_000_000;
export const IMAGE_COMPRESSION_TARGET_BYTES = Math.floor(CLOUDINARY_MAX_IMAGE_BYTES * 0.9);

const maximumLongEdge = 2560;
const resizeFactor = 0.8;
const qualityLevels = [0.82, 0.72, 0.62, 0.52];
const maximumResizeAttempts = 4;

type DecodedImage = {
  width: number;
  height: number;
  source?: CanvasImageSource;
  close?: () => void;
};

export type ImageCompressionRuntime = {
  decode: (file: File) => Promise<DecodedImage>;
  encode: (image: DecodedImage, width: number, height: number, quality: number) => Promise<Blob>;
};

export type PreparedUploadImage = {
  file: File;
  originalBytes: number;
  wasCompressed: boolean;
};

function compressionFailure() {
  return new CloudinaryUploadError('This photo could not be compressed. Try a smaller JPEG, PNG, or WebP image.');
}

function compressedFileName(name: string) {
  const stem = name.replace(/\.[^.]+$/, '').trim() || 'photo';
  return `${stem}.webp`;
}

async function decodeBrowserImage(file: File): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Could not decode image.'));
      element.src = objectUrl;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function encodeBrowserImage(image: DecodedImage, width: number, height: number, quality: number): Promise<Blob> {
  if (!image.source) throw new Error('Image source is unavailable.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas is unavailable.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image.source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Image encoding failed.'));
    }, 'image/webp', quality);
  });
}

const browserImageCompressionRuntime: ImageCompressionRuntime = {
  decode: decodeBrowserImage,
  encode: encodeBrowserImage,
};

function hasSafeDimensions(image: DecodedImage) {
  return Number.isFinite(image.width)
    && Number.isFinite(image.height)
    && image.width > 0
    && image.height > 0
    && image.width * image.height <= IMAGE_COMPRESSION_MAX_PIXELS;
}

export async function prepareImageForUpload(
  file: File,
  runtime: ImageCompressionRuntime = browserImageCompressionRuntime,
): Promise<PreparedUploadImage> {
  const typeError = validateCloudinaryImageType(file);
  if (typeError) throw new CloudinaryUploadError(typeError);
  if (file.size <= CLOUDINARY_MAX_IMAGE_BYTES) {
    return { file, originalBytes: file.size, wasCompressed: false };
  }
  if (file.size > IMAGE_COMPRESSION_MAX_SOURCE_BYTES) {
    throw new CloudinaryUploadError('Choose an image smaller than 25 MB.');
  }

  let image: DecodedImage | undefined;
  try {
    image = await runtime.decode(file);
    if (!hasSafeDimensions(image)) {
      if (image.width * image.height > IMAGE_COMPRESSION_MAX_PIXELS) {
        throw new CloudinaryUploadError('Choose an image no larger than 32 megapixels.');
      }
      throw compressionFailure();
    }

    let scale = Math.min(1, maximumLongEdge / Math.max(image.width, image.height));
    for (let resizeAttempt = 0; resizeAttempt < maximumResizeAttempts; resizeAttempt += 1) {
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      for (const quality of qualityLevels) {
        const compressed = await runtime.encode(image, width, height, quality);
        if (compressed.type !== 'image/webp') throw compressionFailure();
        if (compressed.size > IMAGE_COMPRESSION_TARGET_BYTES) continue;

        const prepared = new File([compressed], compressedFileName(file.name), {
          type: 'image/webp',
          lastModified: file.lastModified,
        });
        if (!validateCloudinaryImage(prepared)) {
          return { file: prepared, originalBytes: file.size, wasCompressed: true };
        }
      }
      scale *= resizeFactor;
    }
  } catch (error) {
    if (error instanceof CloudinaryUploadError) throw error;
    throw compressionFailure();
  } finally {
    image?.close?.();
  }

  throw new CloudinaryUploadError('This photo could not be compressed below 5 MB. Try a smaller photo.');
}
