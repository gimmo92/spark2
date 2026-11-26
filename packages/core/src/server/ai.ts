import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude for modules' server routes (AI proposals, estimates). One model and one key
 * (ANTHROPIC_API_KEY) for every app; routes send no personal data unless their docs say so.
 */
export const AI_MODEL = "claude-opus-5-5";

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
export const claude = () => (client ??= new Anthropic());

/** Recent calls per key (best effort, per server instance): AI calls cost money. */
const recent = new Map<string, number[]>();

export function throttled(key: string, max: number, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) return true;
  recent.set(key, [...list, now]);
  return false;
}

export { Anthropic };
