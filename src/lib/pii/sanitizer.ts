import { detectPii } from "./detectors";
import {
  ALL_PII_CATEGORIES,
  CategoryCounts,
  DetectedEntity,
  DetectionCandidate,
  PII_CATEGORIES,
  PiiCategory,
  RedactionMode,
  SanitizationResult,
} from "./types";
import { stripNonDigits } from "./validators";

export interface PseudonymSession {
  mappings: Map<string, string>;
  counters: Record<PiiCategory, number>;
}

export function createPseudonymSession(): PseudonymSession {
  return {
    mappings: new Map<string, string>(),
    counters: {
      EMAIL: 0,
      PHONE: 0,
      IPV4: 0,
      PAN: 0,
      AADHAAR: 0,
      CREDIT_CARD: 0,
    },
  };
}

export function createEmptyCategoryCounts(): CategoryCounts {
  return {
    EMAIL: 0,
    PHONE: 0,
    IPV4: 0,
    PAN: 0,
    AADHAAR: 0,
    CREDIT_CARD: 0,
  };
}

function partialMaskValue(candidate: DetectionCandidate): string {
  const { category, rawValue } = candidate;

  switch (category) {
    case "EMAIL": {
      const atIdx = rawValue.indexOf("@");
      if (atIdx <= 0) return "[REDACTED]";
      const local = rawValue.slice(0, atIdx);
      const domain = rawValue.slice(atIdx + 1);
      const visibleLocal = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
      const dotIdx = domain.lastIndexOf(".");
      const domainName = dotIdx > 0 ? domain.slice(0, dotIdx) : domain;
      const tld = dotIdx > 0 ? domain.slice(dotIdx) : "";
      const visibleDomain = domainName.slice(0, 1);
      return `${visibleLocal}***@${visibleDomain}***${tld}`;
    }

    case "PHONE": {
      const digits = stripNonDigits(rawValue);
      const last4 = digits.slice(-4);
      const prefix = rawValue.startsWith("+")
        ? `+${digits.slice(0, Math.max(1, digits.length - 10))} `
        : "";
      return `${prefix}${"*".repeat(Math.max(4, digits.length - 4))}${last4}`;
    }

    case "IPV4": {
      const octets = rawValue.split(".");
      if (octets.length !== 4) return "[REDACTED]";
      return `${octets[0]}.***.***.${octets[3]}`;
    }

    case "PAN": {
      const upper = rawValue.toUpperCase();
      if (upper.length !== 10) return "[REDACTED]";
      return `${upper.slice(0, 2)}******${upper.slice(8)}`;
    }

    case "AADHAAR": {
      const digits = stripNonDigits(rawValue);
      return `XXXX-XXXX-${digits.slice(-4)}`;
    }

    case "CREDIT_CARD": {
      const digits = stripNonDigits(rawValue);
      const first4 = digits.slice(0, 4);
      const last4 = digits.slice(-4);
      return `${first4}-XXXX-XXXX-${last4}`;
    }
  }
}

export function formatReplacement(
  candidate: DetectionCandidate,
  mode: RedactionMode,
  session: PseudonymSession
): string {
  if (mode === "FULL_MASK") {
    return "[REDACTED]";
  }

  if (mode === "PARTIAL_MASK") {
    return partialMaskValue(candidate);
  }

  // CONSISTENT PSEUDONYMIZATION — deterministic within this local session only
  const key = `${candidate.category}:${candidate.normalizedValue}`;
  const existing = session.mappings.get(key);
  if (existing) {
    return existing;
  }

  session.counters[candidate.category] += 1;
  const count = String(session.counters[candidate.category]).padStart(2, "0");
  const token = `${PII_CATEGORIES[candidate.category].prefix}_${count}`;
  session.mappings.set(key, token);
  return token;
}

export interface SanitizeOptions {
  mode: RedactionMode;
  enabledCategories?: PiiCategory[];
  session?: PseudonymSession;
  uniqueSet?: Set<string>;
}

/**
 * Sanitizes plain text entirely inside the browser.
 * Preserves character positions for both original and sanitized highlight panels.
 */
export function sanitizeDocumentText(
  text: string,
  options: SanitizeOptions
): SanitizationResult {
  const startMs = performance.now();
  const enabledCategories = options.enabledCategories ?? ALL_PII_CATEGORIES;
  const session = options.session ?? createPseudonymSession();
  const uniqueSet = options.uniqueSet ?? new Set<string>();

  const { candidates, luhnInvalidCandidates } = detectPii(text, enabledCategories);
  const categoryCounts = createEmptyCategoryCounts();
  const entities: DetectedEntity[] = [];

  let cursor = 0;
  let sanitizedCursor = 0;
  const chunks: string[] = [];
  let luhnValidCards = 0;
  let aadhaarValidFormat = 0;

  candidates.forEach((candidate, idx) => {
    const unchanged = text.slice(cursor, candidate.start);
    chunks.push(unchanged);
    sanitizedCursor += unchanged.length;

    const replacement = formatReplacement(candidate, options.mode, session);
    const sanitizedStart = sanitizedCursor;
    chunks.push(replacement);
    sanitizedCursor += replacement.length;

    entities.push({
      ...candidate,
      id: `pii-${idx}-${candidate.start}`,
      replacement,
      sanitizedStart,
      sanitizedEnd: sanitizedCursor,
    });

    categoryCounts[candidate.category] += 1;
    uniqueSet.add(`${candidate.category}:${candidate.normalizedValue}`);

    if (candidate.category === "CREDIT_CARD") {
      luhnValidCards += 1;
    }
    if (candidate.category === "AADHAAR") {
      aadhaarValidFormat += 1;
    }

    cursor = candidate.end;
  });

  chunks.push(text.slice(cursor));
  const sanitizedText = chunks.join("");
  const durationMs = Math.max(1, Math.round(performance.now() - startMs));

  return {
    originalText: text,
    sanitizedText,
    mode: options.mode,
    enabledCategories,
    entities,
    summary: {
      totalDetections: entities.length,
      uniqueEntities: uniqueSet.size,
      categoryCounts,
      luhnValidCards,
      luhnInvalidCandidates,
      aadhaarValidFormat,
      durationMs,
    },
  };
}
