import { describe, expect, it, vi } from 'vitest';
import { CLOUDINARY_MAX_IMAGE_BYTES } from './cloudinary';
import {
  IMAGE_COMPRESSION_MAX_SOURCE_BYTES,
  IMAGE_COMPRESSION_TARGET_BYTES,
  prepareImageForUpload,
  type ImageCompressionRuntime,
} from './image-compression';

function imageFile(size = 1, name = 'ramen.jpg', type = 'image/jpeg') {
  return new File([new Uint8Array(size)], name, { type });
}

function blobWithReportedSize(size: number) {
  const blob = new Blob(['compressed'], { type: 'image/webp' });
  Object.defineProperty(blob, 'size', { value: size });
  return blob;
}

describe('prepareImageForUpload', () => {
  it('leaves an image already under the upload limit untouched', async () => {
    const file = imageFile();
    const runtime: ImageCompressionRuntime = {
      decode: vi.fn(),
      encode: vi.fn(),
    };

    await expect(prepareImageForUpload(file, runtime)).resolves.toEqual({
      file,
      originalBytes: file.size,
      wasCompressed: false,
    });
    expect(runtime.decode).not.toHaveBeenCalled();
  });

  it('compresses an oversized photo before it reaches the upload service', async () => {
    const source = imageFile(CLOUDINARY_MAX_IMAGE_BYTES + 1);
    const runtime: ImageCompressionRuntime = {
      decode: vi.fn().mockResolvedValue({ width: 4000, height: 3000 }),
      encode: vi.fn()
        .mockResolvedValueOnce(blobWithReportedSize(IMAGE_COMPRESSION_TARGET_BYTES + 1))
        .mockResolvedValueOnce(blobWithReportedSize(IMAGE_COMPRESSION_TARGET_BYTES - 1)),
    };

    const result = await prepareImageForUpload(source, runtime);

    expect(runtime.encode).toHaveBeenNthCalledWith(1, expect.anything(), 2560, 1920, 0.82);
    expect(runtime.encode).toHaveBeenNthCalledWith(2, expect.anything(), 2560, 1920, 0.72);
    expect(result.wasCompressed).toBe(true);
    expect(result.originalBytes).toBe(source.size);
    expect(result.file).not.toBe(source);
    expect(result.file.name).toBe('ramen.webp');
    expect(result.file.type).toBe('image/webp');
  });

  it('rejects unsupported or unsafe source images before decoding them', async () => {
    const runtime: ImageCompressionRuntime = {
      decode: vi.fn(),
      encode: vi.fn(),
    };
    const tooLarge = imageFile(1);
    Object.defineProperty(tooLarge, 'size', { value: IMAGE_COMPRESSION_MAX_SOURCE_BYTES + 1 });

    await expect(prepareImageForUpload(imageFile(1, 'ramen.gif', 'image/gif'), runtime))
      .rejects.toThrow('Choose a JPEG, PNG, or WebP image.');
    await expect(prepareImageForUpload(tooLarge, runtime))
      .rejects.toThrow('Choose an image smaller than 25 MB.');
    expect(runtime.decode).not.toHaveBeenCalled();
  });

  it('rejects images with unsafe decoded dimensions before encoding them', async () => {
    const runtime: ImageCompressionRuntime = {
      decode: vi.fn().mockResolvedValue({ width: 8000, height: 5000 }),
      encode: vi.fn(),
    };

    await expect(prepareImageForUpload(imageFile(CLOUDINARY_MAX_IMAGE_BYTES + 1), runtime))
      .rejects.toThrow('Choose an image no larger than 32 megapixels.');
    expect(runtime.encode).not.toHaveBeenCalled();
  });
});
