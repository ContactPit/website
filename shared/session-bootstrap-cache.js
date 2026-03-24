const memoryCache = new Map();

function now() {
  return Date.now();
}

function storageKey(key) {
  return `contactpit.session-cache.${key}`;
}

function readStorage(key) {
  try {
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.expiresAt !== "number" || !("data" in parsed)) return null;
    if (parsed.expiresAt <= now()) {
      window.sessionStorage.removeItem(storageKey(key));
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch (_error) {
    // Ignore storage quota / availability failures and fall back to memory.
  }
}

export function getSessionCache(key) {
  const memoryValue = memoryCache.get(key);
  if (memoryValue && memoryValue.expiresAt > now()) {
    return memoryValue.data;
  }

  if (memoryValue) {
    memoryCache.delete(key);
  }

  const stored = readStorage(key);
  if (!stored) return null;

  memoryCache.set(key, stored);
  return stored.data;
}

export function setSessionCache(key, data, ttlMs) {
  const value = {
    data,
    expiresAt: now() + ttlMs,
  };

  memoryCache.set(key, value);
  writeStorage(key, value);
  return data;
}

export async function getOrFetchSessionCache(key, ttlMs, loader) {
  const cached = getSessionCache(key);
  if (cached) {
    return cached;
  }

  const data = await loader();
  return setSessionCache(key, data, ttlMs);
}
