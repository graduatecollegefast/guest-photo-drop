// Small preview images made in the browser before upload, so the host's gallery loads fast
// without any image service. Failing here never blocks an upload; it just skips the preview.

const THUMB_MAX = 640;

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

function drawScaled(source, srcW, srcH, max) {
  const scale = Math.min(1, max / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to an <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// Resized JPEG of a photo. Returns { blob, width, height } of the ORIGINAL size, or null.
export async function scaleImage(file, max = THUMB_MAX, quality = 0.8) {
  try {
    const img = await loadImage(file);
    const width = img.width || img.naturalWidth;
    const height = img.height || img.naturalHeight;
    if (!width || !height) return null;
    const blob = await canvasToJpeg(drawScaled(img, width, height, max), quality);
    if (img.close) img.close();
    return blob ? { blob, width, height } : null;
  } catch {
    return null;
  }
}

// A frame from early in a video. Returns { blob, width, height, duration } or null.
export function videoPoster(file, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      const t = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 2) : 0;
      try {
        video.currentTime = t;
      } catch {
        finish(null);
      }
    };
    video.onseeked = async () => {
      try {
        const { videoWidth: w, videoHeight: h } = video;
        if (!w || !h) return finish(null);
        const blob = await canvasToJpeg(drawScaled(video, w, h, THUMB_MAX), 0.8);
        finish(blob ? { blob, width: w, height: h, duration: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null } : null);
      } catch {
        finish(null);
      }
    };
    video.src = url;
  });
}

export function makeThumbnail(file, kind) {
  return kind === 'video' ? videoPoster(file) : scaleImage(file);
}
