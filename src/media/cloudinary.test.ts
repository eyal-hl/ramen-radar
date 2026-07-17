import { describe, expect, it, vi } from 'vitest';
import {
  CLOUDINARY_MAX_IMAGE_BYTES,
  type CloudinaryFetch,
  readCloudinaryConfig,
  uploadCloudinaryImage,
  validateCloudinaryImage,
} from './cloudinary';

const config = {
  cloudName: 'ramen-radar',
  uploadPreset: 'ramen-radar-images-v1',
};

function imageFile(name = 'ramen.jpg', type = 'image/jpeg', contents = 'ramen') {
  return new File([contents], name, { type });
}

describe('Cloudinary configuration', () => {
  it('reads the public cloud name and unsigned preset', () => {
    expect(readCloudinaryConfig({
      PUBLIC_CLOUDINARY_CLOUD_NAME: ' ramen-radar ',
      PUBLIC_CLOUDINARY_UPLOAD_PRESET: ' ramen-radar-images-v1 ',
    })).toEqual(config);
  });

  it('stays disabled until both public settings are supplied', () => {
    expect(readCloudinaryConfig({ PUBLIC_CLOUDINARY_CLOUD_NAME: 'ramen-radar' })).toBeNull();
  });
});

describe('Cloudinary image uploads', () => {
  it('rejects files that are not supported images before sending a request', () => {
    expect(validateCloudinaryImage(imageFile('ramen.gif', 'image/gif')))
      .toBe('Choose a JPEG, PNG, or WebP image.');
    expect(validateCloudinaryImage(imageFile('too-large.jpg', 'image/jpeg', 'x'.repeat(CLOUDINARY_MAX_IMAGE_BYTES + 1))))
      .toBe('Choose an image smaller than 5 MB.');
  });

  it('posts only the file and unsigned preset, then returns Cloudinary’s HTTPS URL', async () => {
    const file = imageFile();
    const fetchImage = vi.fn<CloudinaryFetch>(async () => new Response(JSON.stringify({
      secure_url: 'https://res.cloudinary.com/ramen-radar/image/upload/v1/ramen.jpg',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(uploadCloudinaryImage(file, config, fetchImage)).resolves.toBe(
      'https://res.cloudinary.com/ramen-radar/image/upload/v1/ramen.jpg',
    );

    expect(fetchImage).toHaveBeenCalledWith(
      'https://api.cloudinary.com/v1_1/ramen-radar/image/upload',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = fetchImage.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('upload_preset')).toBe('ramen-radar-images-v1');
    expect([...body.keys()]).toEqual(['file', 'upload_preset']);
  });

  it('does not expose Cloudinary response details when an upload fails', async () => {
    const fetchImage = vi.fn<CloudinaryFetch>(async () => new Response(JSON.stringify({
      error: { message: 'The preset does not exist.' },
    }), { status: 400, headers: { 'content-type': 'application/json' } }));

    await expect(uploadCloudinaryImage(imageFile(), config, fetchImage))
      .rejects.toThrow('Photo upload failed. Check the upload settings and try again.');
  });
});
