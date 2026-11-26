const LEVEL_ORDER: Record<string, number> = {
  d1: 1,
  d2: 2,
  d: 1,
  c3: 3,
  c2: 4,
  c1: 5,
  c: 4,
  b3: 6,
  b2: 7,
  b1: 8,
  b: 7,
  as: 9,
  a: 10,
  a2: 10,
  a1: 11,
  q: 12,
  quadro: 12,
  quadri: 12,
  dirigente: 13,
  dir: 13,
  manager: 13,
};

const LEVEL_NUMERIC: Record<number, number> = {
  8: 1,
  7: 2,
  6: 3,
  5: 4,
  4: 5,
  3: 7,
  2: 10,
  1: 12,
};

const LEVEL_FUZZY: Array<[RegExp, number]> = [
  [/\bdirig|manager/i, 13],
  [/\bq\b|quadr/i, 12],
  [/\ba1\b/i, 11],
  [/\ba2?\b/i, 10],
  [/\bas\b/i, 9],
  [/\bb1\b/i, 8],
  [/\bb2?\b/i, 7],
  [/\bb3\b/i, 6],
  [/\bc1\b/i, 5],
  [/\bc2?\b/i, 4],
  [/\bc3\b/i, 3],
  [/\bd2\b/i, 2],
  [/\bd1?\b/i, 1],
];

export class LevelTaxonomy {
  static normalize(levelRaw: unknown): string | null {
    if (levelRaw == null || levelRaw === "") return null;
    const raw = String(levelRaw).trim();
    const cleaned = raw
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/^livello/i, "")
      .replace(/^liv\.?/i, "")
      .trim();

    if (LEVEL_ORDER[cleaned] != null) return cleaned.toUpperCase();

    const asNum = Number(cleaned);
    if (Number.isInteger(asNum) && LEVEL_NUMERIC[asNum] != null) {
      return `Livello ${asNum}`;
    }

    for (const [regex] of LEVEL_FUZZY) {
      if (regex.test(raw)) return raw.trim();
    }

    return raw.trim() || null;
  }

  static sortOrder(levelRaw: unknown): number {
    if (levelRaw == null || levelRaw === "") return 0;
    const raw = String(levelRaw).trim();
    const cleaned = raw
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/^livello/i, "")
      .replace(/^liv\.?/i, "")
      .trim();

    if (LEVEL_ORDER[cleaned] != null) return LEVEL_ORDER[cleaned];

    const asNum = Number(cleaned);
    if (Number.isInteger(asNum) && LEVEL_NUMERIC[asNum] != null) {
      return LEVEL_NUMERIC[asNum];
    }

    for (const [regex, order] of LEVEL_FUZZY) {
      if (regex.test(raw)) return order;
    }

    return 0;
  }

  static displayLabel(levelRaw: unknown): string {
    const raw = String(levelRaw ?? "").trim().replace(/\s+/g, " ");
    if (!raw || raw === "N/D") return "N/D";
    if (/livello/i.test(raw)) return raw;
    const key = LevelTaxonomy.normalize(raw) || raw;
    if (!key || key === "N/D") return "N/D";
    if (/^livello\s/i.test(key)) return key;
    return `Livello ${key}`;
  }
}
