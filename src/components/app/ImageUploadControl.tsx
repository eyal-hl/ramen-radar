import { useRef, useState } from 'preact/hooks';
import {
  CloudinaryUploadError,
  type CloudinaryConfig,
  uploadCloudinaryImage,
} from '../../media/cloudinary';

export type UploadedImage = {
  src: string;
  alt: string;
  caption?: string;
};

type UploadImage = (file: File, config: CloudinaryConfig) => Promise<string>;

export function ImageUploadControl({
  label,
  config,
  onUploaded,
  onUploadingChange,
  upload = uploadCloudinaryImage,
}: {
  label: string;
  config: CloudinaryConfig;
  onUploaded: (image: UploadedImage) => void;
  onUploadingChange?: (uploading: boolean) => void;
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
    setStatus('Uploading photo…');
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const src = await upload(file, config);
      onUploaded({ src, alt: trimmedAlt, ...(caption.trim() ? { caption: caption.trim() } : {}) });
      setFile(undefined);
      setAlt('');
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatus('Photo added to this draft. Save the place to publish it.');
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
              setFile(event.currentTarget.files?.[0]);
              setError('');
              setStatus('');
            }}
          />
          <small>JPEG, PNG, or WebP, up to 5 MB. Choose from your phone or computer.</small>
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
          {uploading ? 'Uploading…' : 'Upload photo'}
        </button>
      </fieldset>
      {error && <p class="image-upload-control__error" role="alert">{error}</p>}
      {status && <p class="image-upload-control__status" aria-live="polite">{status}</p>}
    </section>
  );
}
