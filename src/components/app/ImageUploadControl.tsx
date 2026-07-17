import { useRef, useState } from 'preact/hooks';
import {
  CLOUDINARY_MAX_IMAGE_BYTES,
  CloudinaryUploadError,
  type CloudinaryConfig,
  uploadCloudinaryImage,
} from '../../media/cloudinary';
import {
  prepareImageForUpload,
  type PreparedUploadImage,
} from '../../media/image-compression';

export type UploadedImage = {
  src: string;
  alt: string;
  caption?: string;
};

type UploadImage = (file: File, config: CloudinaryConfig) => Promise<string>;
type PrepareImage = (file: File) => Promise<PreparedUploadImage>;

function formatImageSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageUploadControl({
  label,
  config,
  onUploaded,
  onUploadingChange,
  prepare = prepareImageForUpload,
  upload = uploadCloudinaryImage,
}: {
  label: string;
  config: CloudinaryConfig;
  onUploaded: (image: UploadedImage) => void;
  onUploadingChange?: (uploading: boolean) => void;
  prepare?: PrepareImage;
  upload?: UploadImage;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const submit = async () => {
    if (!file) {
      setError('Choose a photo before uploading.');
      return;
    }
    const trimmedAlt = alt.trim();
    if (!trimmedAlt) {
      setError('Describe what is visible in the photo before uploading.');
      return;
    }

    setError('');
    setStatus(file.size > CLOUDINARY_MAX_IMAGE_BYTES ? 'Compressing photo…' : 'Uploading photo…');
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const prepared = await prepare(file);
      setStatus(prepared.wasCompressed ? 'Uploading compressed photo…' : 'Uploading photo…');
      const src = await upload(prepared.file, config);
      onUploaded({ src, alt: trimmedAlt, ...(caption.trim() ? { caption: caption.trim() } : {}) });
      setFile(undefined);
      setAlt('');
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatus(prepared.wasCompressed
        ? `Photo compressed from ${formatImageSize(prepared.originalBytes)} to ${formatImageSize(prepared.file.size)}. Save the place to publish it.`
        : 'Photo added to this draft. Save the place to publish it.');
    } catch (caught) {
      setStatus('');
      setError(caught instanceof CloudinaryUploadError
        ? caught.message
        : 'Photo upload failed. Please try again.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <section class="image-upload-control" aria-label={label}>
      <div>
        <p class="eyebrow">Cloudinary upload</p>
        <h4>{label}</h4>
      </div>
      <fieldset class="image-upload-control__fields" disabled={uploading}>
        <label class="manage-field">
          <span>Choose photo</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const selectedFile = event.currentTarget.files?.[0];
              setFile(selectedFile);
              setError('');
              setStatus(selectedFile && selectedFile.size > CLOUDINARY_MAX_IMAGE_BYTES
                ? 'Large photo detected — it will be compressed when uploaded.'
                : '');
            }}
          />
          <small>JPEG, PNG, or WebP. Photos over 5 MB are compressed automatically before upload.</small>
        </label>
        <label class="manage-field">
          <span>Alt text</span>
          <input name="image-alt" value={alt} placeholder="Describe what is visible in this photo" onInput={(event) => setAlt(event.currentTarget.value)} />
        </label>
        <label class="manage-field">
          <span>Caption (optional)</span>
          <input name="image-caption" value={caption} placeholder="A short public note" onInput={(event) => setCaption(event.currentTarget.value)} />
        </label>
        <button type="button" class="manage-secondary" disabled={uploading || !file} onClick={submit}>
          {uploading ? 'Preparing…' : 'Upload photo'}
        </button>
      </fieldset>
      {error && <p class="image-upload-control__error" role="alert">{error}</p>}
      {status && <p class="image-upload-control__status" aria-live="polite">{status}</p>}
    </section>
  );
}
