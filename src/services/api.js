// Browser -> Netlify Functions. The browser never talks to Airtable.

const BASE = '/.netlify/functions';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call(path, { method = 'GET', body, timeoutMs = 20000 } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('offline', 'You appear to be offline.', 0);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${BASE}/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError('network', 'The connection dropped. Please try again.', 0);
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !data || data.ok === false) {
    throw new ApiError(data?.error || 'server_error', data?.message || 'Something went wrong. Please try again.', res.status);
  }
  return data;
}

export const api = {
  getEvent: (slug) => call(`get-event?slug=${encodeURIComponent(slug)}`),
  uploadSignature: (slug, sessionId) => call('upload-signature', { method: 'POST', body: { slug, sessionId } }),
  recordUpload: (payload) => call('record-upload', { method: 'POST', body: payload }),
  login: (slug, password) => call('dashboard-login', { method: 'POST', body: { slug, password } }),
  logout: () => call('dashboard-logout', { method: 'POST' }),
  dashboardEvent: (slug) => call(`dashboard-event?slug=${encodeURIComponent(slug)}`),
  createCheckout: (form) => call('create-checkout', { method: 'POST', body: form, timeoutMs: 30000 }),
  checkoutStatus: (sessionId) => call(`checkout-status?session_id=${encodeURIComponent(sessionId)}`, { timeoutMs: 30000 }),
  dashboardMedia: ({ status = 'Active', type, cursor } = {}) => {
    const q = new URLSearchParams({ status });
    if (type) q.set('type', type);
    if (cursor) q.set('cursor', cursor);
    return call(`dashboard-media?${q}`);
  },
  hideMedia: (uploadId, hidden = true) => call('hide-media', { method: 'POST', body: { uploadId, hidden } }),
  coverSignature: () => call('cover-signature', { method: 'POST' }),
  setCover: (result) => call('set-cover', { method: 'POST', body: { result } }),
  removeCover: () => call('set-cover', { method: 'POST', body: { remove: true } }),
  prepareDownload: () => call('prepare-download', { method: 'POST', timeoutMs: 30000 }),
  forgotPassword: (slug, email) => call('forgot-password', { method: 'POST', body: { slug, email } }),
  resetPassword: (slug, token, password) => call('reset-password', { method: 'POST', body: { slug, token, password } }),
  updateEvent: (fields) => call('update-event', { method: 'POST', body: fields }),
  extendHosting: () => call('create-extension-checkout', { method: 'POST', timeoutMs: 30000 }),
  adminLogin: (password) => call('admin-login', { method: 'POST', body: { password } }),
  adminLogout: () => call('admin-logout', { method: 'POST' }),
  adminData: () => call('admin-data', { timeoutMs: 30000 }),
  adminAction: (slug, action) => call('admin-action', { method: 'POST', body: { slug, action } }),
};
