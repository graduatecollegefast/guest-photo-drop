// Small key-value store on Netlify Blobs (part of Netlify, no extra service).
// Used for rate limits and one-time payment claims. Outside Netlify (tests, local dev)
// it falls back to memory so nothing breaks.

import { getStore } from '@netlify/blobs';

const memory = new Map();

function memoryStore(name) {
  const k = (key) => `${name}:${key}`;
  return {
    async get(key, opts = {}) {
      const v = memory.get(k(key));
      if (v === undefined) return null;
      return opts.type === 'json' ? JSON.parse(v) : v;
    },
    async setJSON(key, value, opts = {}) {
      if (opts.onlyIfNew && memory.has(k(key))) return { modified: false };
      memory.set(k(key), JSON.stringify(value));
      return { modified: true };
    },
    async delete(key) {
      memory.delete(k(key));
    },
  };
}

export function blobStore(name) {
  try {
    return getStore({ name, consistency: 'strong' });
  } catch {
    return memoryStore(name);
  }
}

export function resetMemoryStore() {
  memory.clear();
}
