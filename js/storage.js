// js/storage.js
const CACHE_TTL = 30 * 60 * 1000;

export function loadTrades() {
  const raw = localStorage.getItem('tradesData');
  return raw ? JSON.parse(raw) : [];
}

export function saveTrades(trades) {
  localStorage.setItem('tradesData', JSON.stringify(trades));
}

export function readCachedPrice(symbol, allowStale = false) {
  try {
    const key = `price_${symbol}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { price, timestamp } = JSON.parse(raw);
    if (!Number.isFinite(price) || price <= 0) return null;
    if (allowStale || Date.now() - timestamp < CACHE_TTL) return { price, timestamp };
    return null;
  } catch (e) {
    console.error("Failed to read cached price", e);
    return null;
  }
}

export function writeCachedPrice(symbol, price) {
  try {
    const key = `price_${symbol}`;
    localStorage.setItem(key, JSON.stringify({ price, timestamp: Date.now() }));
  } catch (e) {
    console.error("Failed to write cached price", e);
  }
}
