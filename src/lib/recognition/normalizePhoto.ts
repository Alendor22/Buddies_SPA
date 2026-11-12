const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const MIN_DIMENSION = 640;
const JPEG_QUALITIES = [0.88, 0.82, 0.76, 0.7, 0.64, 0.58];

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The photo could not be prepared. Try a different image.'));
    }, 'image/jpeg', quality);
  });
}

async function decodePhoto(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url)
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Applies the same bounded JPEG upload format to enrollment references and search
 * photos. Vercel's function request limit is 4.5 MB, so leave room for multipart
 * framing by targeting 4 MB of image data.
 */
export async function normalizeRecognitionPhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP photo.');
  }

  const decoded = await decodePhoto(file);
  try {
    const longestSide = Math.max(decoded.width, decoded.height);
    if (!longestSide) throw new Error('The selected photo could not be read.');

    let scale = Math.min(1, MAX_DIMENSION / longestSide);
    while (true) {
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('This browser could not prepare the photo.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(decoded.image, 0, 0, width, height);

      for (const quality of JPEG_QUALITIES) {
        const blob = await canvasToJpeg(canvas, quality);
        if (blob.size <= MAX_UPLOAD_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'recognition-photo';
          return new File([blob], baseName + '.jpg', {
            type: 'image/jpeg',
            lastModified: file.lastModified
          });
        }
      }

      if (Math.max(width, height) <= MIN_DIMENSION) {
        throw new Error('This photo is too large to prepare for matching. Choose a smaller image.');
      }
      scale *= 0.8;
    }
  } finally {
    decoded.release();
  }
}
