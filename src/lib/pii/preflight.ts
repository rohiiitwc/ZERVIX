import { detectPii } from "./detectors";
import { ALL_PII_CATEGORIES, PII_CATEGORIES, PiiCategory } from "./types";

export interface PreflightCheckResult {
  blocked: boolean;
  detectedCategories: PiiCategory[];
  detectedLabels: string[];
  matchCount: number;
  reason: string | null;
}

/**
 * Checks whether a chat prompt or query contains likely sensitive PII values
 * (emails, phones, IPv4, PAN, Aadhaar-format, or Luhn-valid card candidates)
 * before allowing transmission to Gemini.
 *
 * Also checks for explicit API key / secret patterns (AIza..., sk-..., Bearer tokens).
 */
export function checkPromptForPii(input: string): PreflightCheckResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      blocked: false,
      detectedCategories: [],
      detectedLabels: [],
      matchCount: 0,
      reason: null,
    };
  }

  const { candidates } = detectPii(trimmed, ALL_PII_CATEGORIES);
  const categories = Array.from(new Set(candidates.map((c) => c.category)));

  // Check for likely secret/API-key patterns
  const hasSecretPattern =
    /\bAIza[0-9A-Za-z\-_]{20,}\b/.test(trimmed) ||
    /\bAQ\.[0-9A-Za-z\-_]{20,}\b/.test(trimmed) ||
    /\bsk-[A-Za-z0-9]{20,}\b/.test(trimmed) ||
    /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/i.test(trimmed);

  // Check for bulk document paste heuristics (e.g. CSV rows or >1800 chars with line breaks)
  const lineCount = trimmed.split(/\r?\n/).length;
  const looksLikeDocumentDump =
    (trimmed.length > 1800 && lineCount > 8) ||
    (lineCount >= 4 && trimmed.includes(",") && candidates.length >= 1);

  if (categories.length === 0 && !hasSecretPattern && !looksLikeDocumentDump) {
    return {
      blocked: false,
      detectedCategories: [],
      detectedLabels: [],
      matchCount: 0,
      reason: null,
    };
  }

  const detectedLabels = categories.map((c) => PII_CATEGORIES[c].label);
  if (hasSecretPattern) {
    detectedLabels.push("API Key / Secret Token");
  }
  if (looksLikeDocumentDump && categories.length === 0) {
    detectedLabels.push("Multi-line Document Content");
  }

  return {
    blocked: true,
    detectedCategories: categories,
    detectedLabels,
    matchCount: candidates.length + (hasSecretPattern ? 1 : 0),
    reason:
      "Privacy Guard blocked this message before transmission because it appears to contain sensitive PII or secret material (" +
      detectedLabels.join(", ") +
      "). Please remove sensitive values — use the local Sanitization Workspace for document processing.",
  };
}
