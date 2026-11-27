import {
  ALL_PII_CATEGORIES,
  DetectionCandidate,
  PiiCategory,
} from "./types";
import {
  isValidEmail,
  isValidIpv4,
  isValidPan,
  isValidPhone,
  luhnCheck,
  stripNonDigits,
  validateAadhaarCandidate,
} from "./validators";

const CATEGORY_PRIORITY: Record<PiiCategory, number> = {
  EMAIL: 6,
  CREDIT_CARD: 5,
  AADHAAR: 4,
  PAN: 3,
  IPV4: 2,
  PHONE: 1,
};

export interface DetectResult {
  candidates: DetectionCandidate[];
  luhnInvalidCandidates: number;
}

function detectEmails(text: string): DetectionCandidate[] {
  const results: DetectionCandidate[] = [];
  const regex =
    /\b[A-Za-z0-9][A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/g;

  for (const match of text.matchAll(regex)) {
    const rawValue = match[0];
    const start = match.index ?? 0;
    if (!isValidEmail(rawValue)) continue;
    results.push({
      category: "EMAIL",
      rawValue,
      normalizedValue: rawValue.toLowerCase(),
      start,
      end: start + rawValue.length,
      validationStatus: "VALID_FORMAT",
    });
  }
  return results;
}

function detectIpv4(text: string): DetectionCandidate[] {
  const results: DetectionCandidate[] = [];
  // Lookbehind/lookahead avoids matching version prefixes like v1.2.3.4 or longer dotted numbers 1.2.3.4.5
  const regex = /(?<![\dA-Za-z.])\d{1,3}(?:\.\d{1,3}){3}(?![\dA-Za-z.])/g;

  for (const match of text.matchAll(regex)) {
    const rawValue = match[0];
    const start = match.index ?? 0;
    if (!isValidIpv4(rawValue)) continue;
    results.push({
      category: "IPV4",
      rawValue,
      normalizedValue: rawValue,
      start,
      end: start + rawValue.length,
      validationStatus: "VALID_FORMAT",
    });
  }
  return results;
}

function detectPan(text: string): DetectionCandidate[] {
  const results: DetectionCandidate[] = [];
  const regex = /(?<![A-Za-z0-9])[A-Za-z]{5}[0-9]{4}[A-Za-z](?![A-Za-z0-9])/g;

  for (const match of text.matchAll(regex)) {
    const rawValue = match[0];
    const start = match.index ?? 0;
    if (!isValidPan(rawValue)) continue;
    results.push({
      category: "PAN",
      rawValue,
      normalizedValue: rawValue.toUpperCase(),
      start,
      end: start + rawValue.length,
      validationStatus: "VALID_FORMAT",
    });
  }
  return results;
}

function detectCreditCards(text: string): {
  valid: DetectionCandidate[];
  invalidCount: number;
} {
  const valid: DetectionCandidate[] = [];
  let invalidCount = 0;
  // Matches 13-19 digits optionally grouped by single spaces or hyphens
  const regex = /(?<![\dA-Za-z])(?:\d[\s-]?){12,18}\d(?![\dA-Za-z])/g;

  for (const match of text.matchAll(regex)) {
    const rawValue = match[0].trim();
    const start = (match.index ?? 0) + (match[0].length - match[0].trimStart().length);
    const digits = stripNonDigits(rawValue);
    if (digits.length < 13 || digits.length > 19) continue;
    // Reject obvious timestamps / phone lists with too many hyphens/spaces
    if (/[\s-]{2,}/.test(rawValue)) continue;

    if (luhnCheck(digits)) {
      valid.push({
        category: "CREDIT_CARD",
        rawValue,
        normalizedValue: digits,
        start,
        end: start + rawValue.length,
        validationStatus: "LUHN_VALID_CANDIDATE",
      });
    } else {
      invalidCount += 1;
    }
  }

  return { valid, invalidCount };
}

function detectAadhaar(text: string): DetectionCandidate[] {
  const results: DetectionCandidate[] = [];
  // 12 digits either contiguous or in 4-4-4 space/hyphen groups;
  // avoid matching 12-digit prefixes/suffixes of 13-19 digit card numbers.
  const regex =
    /(?<![\dA-Za-z+]|\d[\s-])([2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4})(?![\dA-Za-z]|[\s-]\d)/g;

  for (const match of text.matchAll(regex)) {
    const rawValue = match[1];
    const start = match.index ?? 0;
    const { isFormatValid, isChecksumValid } = validateAadhaarCandidate(rawValue);
    if (!isFormatValid) continue;

    results.push({
      category: "AADHAAR",
      rawValue,
      normalizedValue: stripNonDigits(rawValue),
      start,
      end: start + rawValue.length,
      validationStatus: isChecksumValid
        ? "AADHAAR_CHECKSUM_VALID"
        : "AADHAAR_FORMAT_ONLY",
    });
  }
  return results;
}

function detectPhones(text: string): DetectionCandidate[] {
  const results: DetectionCandidate[] = [];
  const regex =
    /(?<![\dA-Za-z@]|\d[\s.-])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,5}[\s.-]?)\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{1,4})?(?![\dA-Za-z]|[\s.-]\d)/g;

  for (const match of text.matchAll(regex)) {
    const rawValue = match[0].trim();
    const leadingWhitespace = match[0].length - match[0].trimStart().length;
    const start = (match.index ?? 0) + leadingWhitespace;
    if (!isValidPhone(rawValue)) continue;

    const digits = stripNonDigits(rawValue);
    const normalized = rawValue.startsWith("+") ? `+${digits}` : digits;

    results.push({
      category: "PHONE",
      rawValue,
      normalizedValue: normalized,
      start,
      end: start + rawValue.length,
      validationStatus: "VALID_FORMAT",
    });
  }
  return results;
}

/**
 * Resolves overlapping spans deterministically:
 * Higher category specificity wins; on tie, longer span wins; then earlier start.
 */
export function resolveOverlaps(
  candidates: DetectionCandidate[]
): DetectionCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    const prioDiff = CATEGORY_PRIORITY[b.category] - CATEGORY_PRIORITY[a.category];
    if (prioDiff !== 0) return prioDiff;
    const lenDiff = b.end - b.start - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return a.start - b.start;
  });

  const accepted: DetectionCandidate[] = [];

  for (const candidate of sorted) {
    const overlaps = accepted.some(
      (item) => candidate.start < item.end && candidate.end > item.start
    );
    if (!overlaps) {
      accepted.push(candidate);
    }
  }

  return accepted.sort((a, b) => a.start - b.start);
}

/**
 * Runs all enabled PII detectors on a string without sending anything over the network.
 */
export function detectPii(
  text: string,
  enabledCategories: PiiCategory[] = ALL_PII_CATEGORIES
): DetectResult {
  if (!text) {
    return { candidates: [], luhnInvalidCandidates: 0 };
  }

  const enabled = new Set(enabledCategories);
  const pool: DetectionCandidate[] = [];
  let luhnInvalidCandidates = 0;

  if (enabled.has("EMAIL")) {
    pool.push(...detectEmails(text));
  }
  if (enabled.has("CREDIT_CARD")) {
    const cc = detectCreditCards(text);
    pool.push(...cc.valid);
    luhnInvalidCandidates = cc.invalidCount;
  }
  if (enabled.has("AADHAAR")) {
    pool.push(...detectAadhaar(text));
  }
  if (enabled.has("PAN")) {
    pool.push(...detectPan(text));
  }
  if (enabled.has("IPV4")) {
    pool.push(...detectIpv4(text));
  }
  if (enabled.has("PHONE")) {
    pool.push(...detectPhones(text));
  }

  return {
    candidates: resolveOverlaps(pool),
    luhnInvalidCandidates,
  };
}
