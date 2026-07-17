const allowedImageTypes = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
]);

export const CLOUDINARY_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type CloudinaryConfig = {
  cloudName: string;
  uploadPreset: string;
};

export type CloudinaryFetch = (input: string, init: RequestInit) => Promise<Response>;

export class CloudinaryUploadError extends Error {}

export function readCloudinaryConfig(environment: Record<string, string | undefined>): CloudinaryConfig | null {
  const cloudName = environment.PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = environment.PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  return cloudName && uploadPreset ? { cloudName, uploadPreset } : null;
}

export function validateCloudinaryImageType(file: Pick<File, 'name' | 'type'>): string | null {
  const allowedExtensions = allowedImageTypes.get(file.type);
  const extension = file.name.toLocaleLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (!allowedExtensions || !extension || !allowedExtensions.includes(extension)) {
    return 'Choose a JPEG, PNG, or WebP image.';
  }
  return null;
}

export function validateCloudinaryImage(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const typeError = validateCloudinaryImageType(file);
  if (typeError) return typeError;
  if (file.size > CLOUDINARY_MAX_IMAGE_BYTES) return 'Choose an image smaller than 5 MB.';
  return null;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isUploadResponse(value: unknown): value is { secure_url: string } {
  return typeof value === 'object'
    && value !== null
    && 'secure_url' in value
    && isHttpsUrl(value.secure_url);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

const browserFetch: CloudinaryFetch = (input, init) => fetch(input, init);

export async function uploadCloudinaryImage(
  file: File,
  config: CloudinaryConfig,
  fetchImage: CloudinaryFetch = browserFetch,
): Promise<string> {
  const validationError = validateCloudinaryImage(file);
  if (validationError) throw new CloudinaryUploadError(validationError);

  const body = new FormData();
  body.set('file', file);
  body.set('upload_preset', config.uploadPreset);

  let response: Response;
  try {
    response = await fetchImage(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
      { method: 'POST', body },
    );
  } catch {
    throw new CloudinaryUploadError('Photo upload failed. Check your connection and try again.');
  }

  const result = await readJson(response);
  if (!response.ok || !isUploadResponse(result)) {
    throw new CloudinaryUploadError('Photo upload failed. Check the upload settings and try again.');
  }

  return result.secure_url;
}
