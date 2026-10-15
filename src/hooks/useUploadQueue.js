// The guest upload queue.
// Each file has its own state (queued -> uploading -> saving -> success | failed).
// A limited number upload at once. Failures never affect other files, and retrying
// a failure never re-uploads files that already succeeded.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../services/api.js';
import { putFile, UploadError } from '../services/storage.js';
import { makeThumbnail } from '../utils/thumbnail.js';
import { uploadErrorMessage } from '../utils/errors.js';
import { newId } from '../utils/format.js';

const DEFAULT_CONCURRENCY = Number(import.meta.env.VITE_UPLOAD_CONCURRENCY) || 3;
const UPLOAD_AUTO_RETRIES = 2;
const REGISTER_RETRIES = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getSessionId() {
  try {
    let id = sessionStorage.getItem('wp-session-id');
    if (!id) {
      id = newId();
      sessionStorage.setItem('wp-session-id', id);
    }
    return id;
  } catch {
    return newId();
  }
}

// Uploads that reached storage but are not yet recorded in Airtable are kept in
// sessionStorage, so a refresh or a later visit can finish saving them.
function pendingKey(slug) {
  return `wp-pending:${slug}`;
}
function readPending(slug) {
  try {
    return JSON.parse(sessionStorage.getItem(pendingKey(slug)) || '{}');
  } catch {
    return {};
  }
}
function writePending(slug, map) {
  try {
    if (Object.keys(map).length) sessionStorage.setItem(pendingKey(slug), JSON.stringify(map));
    else sessionStorage.removeItem(pendingKey(slug));
  } catch {
    /* storage unavailable: retries still work within this page */
  }
}

export function useUploadQueue({ slug, concurrency = DEFAULT_CONCURRENCY }) {
  const itemsRef = useRef([]);
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);
  const running = useRef(0);
  const guestName = useRef('');
  const sessionId = useMemo(getSessionId, []);
  const mounted = useRef(true);

  const update = useCallback(
    (id, patch) => {
      itemsRef.current = itemsRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it));
      rerender();
    },
    [rerender]
  );

  // Uploads one file (and its preview) straight to storage. Returns what record-upload needs.
  const uploadOne = useCallback(
    async (item) => {
      const meta = { slug, sessionId, uploadId: item.id, name: item.name, type: item.file.type, size: item.file.size, kind: item.kind };
      let { ticket } = await api.uploadTicket(meta);
      const thumbPromise = makeThumbnail(item.file, item.kind);
      let attempt = 0;
      for (;;) {
        try {
          if (Date.now() > ticket.expiresAt) ({ ticket } = await api.uploadTicket(meta));
          await putFile({
            url: ticket.putUrl,
            blob: item.file,
            contentType: ticket.contentType,
            onProgress: (p) => update(item.id, { progress: Math.min(p, 0.99) }),
          });
          break;
        } catch (err) {
          attempt += 1;
          if (err instanceof UploadError && err.kind === 'expired' && attempt <= 1) {
            ({ ticket } = await api.uploadTicket(meta));
            continue;
          }
          const retryable = err instanceof UploadError && (err.kind === 'network' || err.kind === 'storage');
          if (!retryable || attempt > UPLOAD_AUTO_RETRIES || !navigator.onLine) throw err;
          await sleep(1500 * attempt);
        }
      }
      const thumb = await thumbPromise;
      let thumbKey;
      if (thumb) {
        try {
          await putFile({ url: ticket.thumbPutUrl, blob: thumb.blob, contentType: 'image/jpeg' });
          thumbKey = ticket.thumbKey;
        } catch {
          /* the gallery falls back to the full file */
        }
      }
      return {
        key: ticket.key,
        thumbKey,
        kind: item.kind,
        width: thumb ? thumb.width : undefined,
        height: thumb ? thumb.height : undefined,
        duration: thumb ? thumb.duration : undefined,
      };
    },
    [slug, sessionId, update]
  );

  const register = useCallback(
    async (item, result) => {
      let lastErr;
      for (let attempt = 0; attempt < REGISTER_RETRIES; attempt++) {
        try {
          await api.recordUpload({
            slug,
            sessionId,
            uploadId: item.id,
            guestName: guestName.current,
            originalFilename: item.name,
            result,
          });
          return;
        } catch (err) {
          lastErr = err;
          // A rejected upload (bad signature / wrong event) will not get better by retrying.
          if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) break;
          await sleep(1000 * 2 ** attempt);
        }
      }
      throw lastErr;
    },
    [slug, sessionId]
  );

  const pumpRef = useRef(() => {});

  const runItem = useCallback(
    async (item) => {
      running.current += 1;
      update(item.id, { status: 'uploading', error: null, errorKind: null, progress: item.result ? 1 : 0 });
      try {
        let result = item.result;
        if (!result) {
          result = await uploadOne(item);
          update(item.id, { result, status: 'saving', progress: 1 });
          const pending = readPending(slug);
          pending[item.id] = { result, name: item.name, guestName: guestName.current };
          writePending(slug, pending);
        } else {
          update(item.id, { status: 'saving' });
        }

        try {
          await register(item, result);
        } catch (err) {
          update(item.id, { status: 'failed', errorKind: 'register', error: uploadErrorMessage('register', item.kind) });
          return;
        }
        const pending = readPending(slug);
        delete pending[item.id];
        writePending(slug, pending);
        update(item.id, { status: 'success', progress: 1, file: null });
      } catch (err) {
        let kind = 'network';
        let serverMessage;
        if (err instanceof UploadError) kind = err.kind === 'expired' || err.kind === 'storage' ? 'network' : err.kind;
        else if (err instanceof ApiError) {
          if (err.code === 'album_full') kind = 'album_full';
          else if (err.code === 'too_large') kind = 'too_large';
          else if (err.code === 'unsupported_file') kind = 'unsupported';
          else if (['event_closed', 'event_expired', 'event_not_open', 'event_not_found'].includes(err.code)) {
            kind = 'event';
            serverMessage = err.message;
          } else if (err.code === 'offline') kind = 'offline';
        }
        if (!navigator.onLine) kind = 'offline';
        update(item.id, { status: 'failed', errorKind: kind, error: uploadErrorMessage(kind, item.kind, serverMessage) });
      } finally {
        running.current -= 1;
        if (mounted.current) pumpRef.current();
      }
    },
    [uploadOne, register, slug, update]
  );

  const pump = useCallback(() => {
    while (running.current < concurrency) {
      const next = itemsRef.current.find((it) => it.status === 'queued');
      if (!next) break;
      // Mark immediately so the loop does not start it twice.
      itemsRef.current = itemsRef.current.map((it) => (it.id === next.id ? { ...it, status: 'uploading' } : it));
      runItem(next);
    }
    rerender();
  }, [concurrency, runItem, rerender]);
  pumpRef.current = pump;

  // Replace the selection (before upload starts).
  const setFiles = useCallback(
    (entries) => {
      itemsRef.current = entries.map((e) => ({
        id: newId(),
        file: e.file,
        name: e.file.name,
        size: e.file.size,
        kind: e.kind,
        status: e.ok === false ? 'rejected' : 'selected',
        error: e.ok === false ? e.reason : null,
        errorKind: null,
        progress: 0,
        result: null,
        attempts: 0,
      }));
      rerender();
    },
    [rerender]
  );

  const removeItem = useCallback(
    (id) => {
      itemsRef.current = itemsRef.current.filter((it) => it.id !== id);
      rerender();
    },
    [rerender]
  );

  const start = useCallback(
    (name) => {
      guestName.current = (name || '').trim().slice(0, 80);
      itemsRef.current = itemsRef.current
        .filter((it) => it.status !== 'rejected')
        .map((it) => (it.status === 'selected' ? { ...it, status: 'queued' } : it));
      pump();
    },
    [pump]
  );

  const retry = useCallback(
    (id) => {
      itemsRef.current = itemsRef.current.map((it) =>
        it.status === 'failed' && (!id || it.id === id) && it.errorKind !== 'too_large' && it.errorKind !== 'unsupported' && it.errorKind !== 'album_full'
          ? { ...it, status: 'queued', error: null, errorKind: null, attempts: it.attempts + 1 }
          : it
      );
      pump();
    },
    [pump]
  );

  const reset = useCallback(() => {
    itemsRef.current = [];
    rerender();
  }, [rerender]);

  // Finish saving uploads left over from an interrupted visit.
  useEffect(() => {
    mounted.current = true;
    const pending = readPending(slug);
    const ids = Object.keys(pending);
    if (ids.length) {
      (async () => {
        for (const id of ids) {
          const p = pending[id];
          try {
            await api.recordUpload({ slug, sessionId, uploadId: id, guestName: p.guestName, originalFilename: p.name, result: p.result });
            const now = readPending(slug);
            delete now[id];
            writePending(slug, now);
          } catch {
            /* try again on the next visit */
          }
        }
      })();
    }
    return () => {
      mounted.current = false;
    };
  }, [slug, sessionId]);

  // Coming back online: retry anything that failed because the connection dropped.
  useEffect(() => {
    const onOnline = () => {
      const offlineFailures = itemsRef.current.some((it) => it.status === 'failed' && (it.errorKind === 'offline' || it.errorKind === 'network'));
      if (offlineFailures) {
        itemsRef.current = itemsRef.current.map((it) =>
          it.status === 'failed' && (it.errorKind === 'offline' || it.errorKind === 'network')
            ? { ...it, status: 'queued', error: null, errorKind: null, attempts: it.attempts + 1 }
            : it
        );
        pump();
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [pump]);

  const items = itemsRef.current;
  const stats = useMemo(() => {
    const active = items.filter((i) => i.status !== 'rejected' && i.status !== 'selected');
    const totalBytes = active.reduce((s, i) => s + i.size, 0) || 1;
    const doneBytes = active.reduce((s, i) => s + i.size * (i.status === 'success' ? 1 : i.status === 'failed' ? (i.result ? 1 : 0) : i.progress || 0), 0);
    const count = (st) => active.filter((i) => i.status === st).length;
    const success = count('success');
    const failed = count('failed');
    const inFlight = count('uploading') + count('saving') + count('queued');
    return {
      total: active.length,
      success,
      failed,
      inFlight,
      busy: inFlight > 0,
      finished: active.length > 0 && inFlight === 0,
      overall: active.length ? doneBytes / totalBytes : 0,
      photos: active.filter((i) => i.status === 'success' && i.kind === 'image').length,
      videos: active.filter((i) => i.status === 'success' && i.kind === 'video').length,
    };
  }, [items]);

  // Keep the screen awake and warn before leaving while uploads are running.
  useEffect(() => {
    if (!stats.busy) return undefined;
    let lock = null;
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {});
    }
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      if (lock) lock.release().catch(() => {});
    };
  }, [stats.busy]);

  return { items, stats, setFiles, removeItem, start, retry, reset };
}
