import "server-only";

/** Recent calls per key (best effort, per server instance): AI and search calls cost money. */
const recent = new Map<string, number[]>();

export function throttled(key: string, max: number, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) return true;
  recent.set(key, [...list, now]);
  return false;
}

export const MODEL = "claude-opus-5-5";
