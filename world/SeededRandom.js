export function createSeededRng(seed = 0) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function hashSeed(...parts) {
  let hash = 2166136261 >>> 0;
  for (const part of parts) {
    const text = String(part ?? '');
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    hash ^= 0x9e3779b9;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function randomInt(rng, min, max) {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pickOne(rng, values = []) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values[Math.floor(rng() * values.length)] ?? null;
}
