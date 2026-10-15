// Direct browser -> storage uploads with a short-lived signed link from our server.
// One PUT per file; progress is reported as it goes and a stalled upload is cut off.

const STALL_MS = 60000; // abort if no bytes move for a minute

export class UploadError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // network | expired | storage | aborted
  }
}

export function putFile({ url, blob, contentType, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastMove = Date.now();
    const stallTimer = setInterval(() => {
      if (Date.now() - lastMove > STALL_MS) xhr.abort();
    }, 5000);
    const done = () => clearInterval(stallTimer);

    xhr.open('PUT', url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      lastMove = Date.now();
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 403) reject(new UploadError('expired', 'Upload link expired'));
      else reject(new UploadError('storage', `Storage ${xhr.status}`));
    };
    xhr.onerror = () => {
      done();
      reject(new UploadError('network', 'Network error'));
    };
    xhr.onabort = () => {
      done();
      reject(new UploadError(signal && signal.aborted ? 'aborted' : 'network', 'Upload interrupted'));
    };
    if (signal) {
      if (signal.aborted) return xhr.abort();
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(blob);
  });
}
