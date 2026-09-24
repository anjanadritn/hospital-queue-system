/**
 * Client-Side Automatic Image Optimization for Smart Hospital Patient Profile.
 *
 * Requirements:
 * 1. Automatically resizes images to max 800px width/height while preserving aspect ratio.
 * 2. Compresses automatically to high-quality JPEG (0.82–0.85).
 * 3. Handles original camera photos of 3–20 MB smoothly without user manual intervention.
 * 4. Ensures final payload is safely <= 2 MB for MongoDB storage.
 * 5. Rejects unsupported/corrupted files with user-friendly error messages.
 */

export async function optimizeProfileImage(file, options = {}) {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.85,
    maxSizeBytes = 2 * 1024 * 1024 // 2 MB
  } = options;

  if (!file) {
    throw new Error('No image file selected.');
  }

  // Validate MIME / extension
  const rawType = (file.type || '').toLowerCase();
  const rawName = (file.name || '').toLowerCase();
  const ext = rawName.split('.').pop();

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

  const isTypeValid = allowedTypes.includes(rawType) || allowedExts.includes(ext);
  if (!isTypeValid) {
    throw new Error('Unsupported image format. Please select a JPEG, PNG, or WebP photo.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Unable to read selected image file.'));
    };

    reader.onload = (event) => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Unable to process this image. The file may be corrupted or an unsupported format.'));
      };

      img.onload = () => {
        try {
          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;

          if (!originalWidth || !originalHeight) {
            reject(new Error('Unable to determine image dimensions.'));
            return;
          }

          // Calculate aspect-ratio-preserved output dimensions
          let targetWidth = originalWidth;
          let targetHeight = originalHeight;

          if (targetWidth > maxWidth || targetHeight > maxHeight) {
            const widthRatio = maxWidth / targetWidth;
            const heightRatio = maxHeight / targetHeight;
            const bestRatio = Math.min(widthRatio, heightRatio);

            targetWidth = Math.max(1, Math.round(targetWidth * bestRatio));
            targetHeight = Math.max(1, Math.round(targetHeight * bestRatio));
          }

          // Render onto in-memory HTML5 Canvas
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas 2D context is not available.'));
            return;
          }

          // Enable high-quality smoothing for sharp downscaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // White background to handle any transparent PNGs cleanly when saving as JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Draw the image without stretching
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Primary compression at requested quality (0.85)
          let optimizedDataUri = canvas.toDataURL('image/jpeg', quality);
          let b64Part = optimizedDataUri.includes(',') ? optimizedDataUri.split(',')[1] : optimizedDataUri;
          let approxBytes = Math.round((b64Part.length * 3) / 4);

          // Defensive fallback step-down if output somehow exceeds 2 MB
          if (approxBytes > maxSizeBytes) {
            optimizedDataUri = canvas.toDataURL('image/jpeg', 0.70);
            b64Part = optimizedDataUri.includes(',') ? optimizedDataUri.split(',')[1] : optimizedDataUri;
            approxBytes = Math.round((b64Part.length * 3) / 4);
          }

          if (approxBytes > maxSizeBytes) {
            optimizedDataUri = canvas.toDataURL('image/jpeg', 0.50);
            b64Part = optimizedDataUri.includes(',') ? optimizedDataUri.split(',')[1] : optimizedDataUri;
            approxBytes = Math.round((b64Part.length * 3) / 4);
          }

          if (approxBytes > maxSizeBytes) {
            reject(new Error('Image could not be compressed under the 2 MB limit.'));
            return;
          }

          resolve({
            dataUri: optimizedDataUri,
            mimeType: 'image/jpeg',
            width: targetWidth,
            height: targetHeight,
            originalSize: file.size,
            optimizedSize: approxBytes
          });
        } catch (err) {
          reject(new Error(`Image optimization failed: ${err.message}`));
        }
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  });
}
