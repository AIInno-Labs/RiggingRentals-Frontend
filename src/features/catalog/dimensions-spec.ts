/**
 * Rigging equipment specifications: Weight & Length.
 * Specifications are stored in the catalog's `dimensions` column to maintain
 * backwards compatibility with existing database rows and schemas.
 */

export function isWeightSpec(str: string): boolean {
  return /\d+(\.\d+)?\s*(t|kg|ton|tonne|tonnes)\b|wll/i.test(str);
}

export function isLengthSpec(str: string): boolean {
  return /\d+(\.\d+)?\s*(m|mtr|meter|meters|mm|ft)\b|lift|modular/i.test(str);
}

export function parseDimensions(raw?: string | null): {
  weight: string;
  length: string;
} {
  if (!raw || typeof raw !== "string") return { weight: "", length: "" };
  const s = raw.trim();
  if (!s) return { weight: "", length: "" };

  // 1. JSON serialized
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const parsed = JSON.parse(s);
      return {
        weight: typeof parsed.weight === "string" ? parsed.weight.trim() : "",
        length: typeof parsed.length === "string" ? parsed.length.trim() : "",
      };
    } catch {
      // fallback
    }
  }

  // 2. Structured "Weight: ... | Length: ..." or "Weight: ..." or "Length: ..."
  if (/^(Weight:|Length:)/i.test(s)) {
    let weight = "";
    let length = "";
    const parts = s.split("|").map((p) => p.trim());
    for (const part of parts) {
      const wMatch = part.match(/^Weight:\s*(.*)$/i);
      if (wMatch) weight = wMatch[1].trim();
      const lMatch = part.match(/^Length:\s*(.*)$/i);
      if (lMatch) length = lMatch[1].trim();
    }
    return { weight, length };
  }

  // 3. Delimited legacy strings (e.g. "2m x 5t", "2t x 6m lift", "500kg x 12m", "12cm x 20mtr")
  if (s.includes(" x ") || s.includes(" X ")) {
    const [p1, p2] = s.split(/\s+[xX]\s+/).map((p) => p.trim());
    let weight = "";
    let length = "";

    if (isWeightSpec(p1) && isLengthSpec(p2)) {
      weight = p1;
      length = p2;
    } else if (isLengthSpec(p1) && isWeightSpec(p2)) {
      length = p1;
      weight = p2;
    } else if (isWeightSpec(p1)) {
      weight = p1;
      length = p2;
    } else if (isWeightSpec(p2)) {
      weight = p2;
      length = p1;
    } else {
      weight = p1;
      length = p2;
    }
    return { weight, length };
  }

  // 4. Single specification (e.g. "3.25t WLL", "3m modular")
  if (isWeightSpec(s)) {
    return { weight: s, length: "" };
  }
  if (isLengthSpec(s)) {
    return { weight: "", length: s };
  }

  return { weight: s, length: "" };
}

export function formatCatalogDimensions(
  weight?: string | null,
  length?: string | null,
): string {
  const w = weight?.trim() ?? "";
  const l = length?.trim() ?? "";
  if (w && l) return `Weight: ${w} | Length: ${l}`;
  if (w) return `Weight: ${w}`;
  if (l) return `Length: ${l}`;
  return "";
}

export function formatSpecDisplay(raw?: string | null): string {
  const { weight, length } = parseDimensions(raw);
  if (weight && length) return `${weight} · ${length}`;
  if (weight) return weight;
  if (length) return length;
  return "";
}
