// Minimal Stripe client using the REST API directly (no SDK, no extra dependency).
// The secret key never leaves the server.

import crypto from 'node:crypto';
import { HttpError } from './http.mjs';

const API = 'https://api.stripe.com/v1';

function secretKey() {
  return process.env.STRIPE_SECRET_KEY || '';
}

// Stripe expects form encoding with bracket notation for nested values.
export function formEncode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? formEncode(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripeRequest(path, { method = 'GET', body, idempotencyKey } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body ? formEncode(body).toString() : undefined,
    });
  } catch (err) {
    throw new HttpError(502, 'payment_unavailable', 'Payments are not available right now. Please try again.', String(err));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(502, 'payment_error', 'We could not start the payment. Please try again.', `Stripe ${res.status}: ${JSON.stringify(data.error || data).slice(0, 400)}`);
  }
  return data;
}

export function createCheckoutSession(params, idempotencyKey) {
  return stripeRequest('/checkout/sessions', { method: 'POST', body: params, idempotencyKey });
}

export function getCheckoutSession(id) {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(id)}`);
}

// Stripe-Signature: t=timestamp,v1=hex(hmac_sha256(secret, `${t}.${rawBody}`))
export function verifyWebhook(rawBody, header, secret = process.env.STRIPE_WEBHOOK_SECRET || '', toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );
  const t = Number(parts.t);
  const signatures = header
    .split(',')
    .filter((p) => p.trim().startsWith('v1='))
    .map((p) => p.trim().slice(3));
  if (!t || !signatures.length) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return signatures.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
