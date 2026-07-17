// @vitest-environment happy-dom

import { h, render as renderDom } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageUploadControl } from './ImageUploadControl';

const config = {
  cloudName: 'ramen-radar',
  uploadPreset: 'ramen-radar-images-v1',
};

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setValue(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ImageUploadControl', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('offers a native image picker and adds the uploaded URL to the draft', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const onUploaded = vi.fn();
    const upload = vi.fn().mockResolvedValue('https://res.cloudinary.com/ramen-radar/image/upload/v1/ramen.jpg');

    await act(() => {
      renderDom(h(ImageUploadControl, { label: 'Upload gallery photo', config, onUploaded, upload }), container);
    });

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput?.accept).toBe('image/jpeg,image/png,image/webp');
    expect(fileInput?.getAttribute('capture')).toBeNull();

    await act(() => {
      selectFile(fileInput!, new File(['ramen'], 'ramen.jpg', { type: 'image/jpeg' }));
      setValue(container.querySelector<HTMLInputElement>('input[name="image-alt"]')!, 'A bowl of shoyu ramen');
      setValue(container.querySelector<HTMLInputElement>('input[name="image-caption"]')!, 'Lunch special');
    });
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(({ textContent }) => textContent === 'Upload photo');
    await act(async () => { button?.click(); });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(onUploaded).toHaveBeenCalledWith({
      src: 'https://res.cloudinary.com/ramen-radar/image/upload/v1/ramen.jpg',
      alt: 'A bowl of shoyu ramen',
      caption: 'Lunch special',
    });
  });

  it('prepares an oversized image before passing it to the upload service', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const source = new File(['original'], 'ramen.png', { type: 'image/png' });
    const compressed = new File(['compressed'], 'ramen.jpg', { type: 'image/jpeg' });
    const prepare = vi.fn().mockResolvedValue({
      file: compressed,
      originalBytes: 8 * 1024 * 1024,
      wasCompressed: true,
    });
    const upload = vi.fn().mockResolvedValue('https://res.cloudinary.com/ramen-radar/image/upload/v1/ramen.jpg');

    await act(() => {
      renderDom(h(ImageUploadControl, { label: 'Upload gallery photo', config, onUploaded: vi.fn(), prepare, upload }), container);
    });
    await act(() => {
      selectFile(container.querySelector<HTMLInputElement>('input[type="file"]')!, source);
      setValue(container.querySelector<HTMLInputElement>('input[name="image-alt"]')!, 'A bowl of ramen');
    });
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(({ textContent }) => textContent === 'Upload photo');

    await act(async () => { button?.click(); });

    expect(prepare).toHaveBeenCalledWith(source);
    expect(upload).toHaveBeenCalledWith(compressed, config);
    expect(container.textContent).toContain('compressed');
  });

  it('does not block the enclosing place form before a photo is chosen', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    await act(() => {
      renderDom(h('form', null,
        h(ImageUploadControl, { label: 'Upload gallery photo', config, onUploaded: vi.fn() }),
        h('button', { type: 'submit' }, 'Save place'),
      ), container);
    });

    expect(container.querySelector('form')?.checkValidity()).toBe(true);
  });

  it('prevents duplicate submissions while an upload is in progress', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    let complete: (() => void) | undefined;
    const upload = vi.fn(() => new Promise<string>((resolve) => { complete = () => resolve('https://res.cloudinary.com/ramen-radar/image/upload/v1/ramen.jpg'); }));

    await act(() => {
      renderDom(h(ImageUploadControl, { label: 'Upload cover photo', config, onUploaded: vi.fn(), upload }), container);
    });
    await act(() => {
      selectFile(container.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['ramen'], 'ramen.jpg', { type: 'image/jpeg' }));
      setValue(container.querySelector<HTMLInputElement>('input[name="image-alt"]')!, 'A bowl of ramen');
    });
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(({ textContent }) => textContent === 'Upload photo');

    await act(() => { button?.click(); });
    expect(button?.disabled).toBe(true);
    button?.click();
    expect(upload).toHaveBeenCalledTimes(1);

    await act(async () => { complete?.(); });
  });

  it('shows a safe error when the upload cannot finish', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const upload = vi.fn().mockRejectedValue(new Error('Cloudinary internals'));

    await act(() => {
      renderDom(h(ImageUploadControl, { label: 'Upload visit photo', config, onUploaded: vi.fn(), upload }), container);
    });
    await act(() => {
      selectFile(container.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['ramen'], 'ramen.jpg', { type: 'image/jpeg' }));
      setValue(container.querySelector<HTMLInputElement>('input[name="image-alt"]')!, 'A bowl of ramen');
    });
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(({ textContent }) => textContent === 'Upload photo');
    await act(async () => { button?.click(); });

    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('Photo upload failed. Please try again.');
    expect(container.textContent).not.toContain('Cloudinary internals');
  });
});
