export type PiiCategory =
  | "EMAIL"
  | "PHONE"
  | "IPV4"
  | "PAN"
  | "AADHAAR"
  | "CREDIT_CARD";

export type RedactionMode = "FULL_MASK" | "PARTIAL_MASK" | "PSEUDONYMIZE";

export type ValidationStatus =
  | "VALID_FORMAT"
  | "LUHN_VALID_CANDIDATE"
  | "AADHAAR_CHECKSUM_VALID"
  | "AADHAAR_FORMAT_ONLY";

export interface PiiCategoryMeta {
  id: PiiCategory;
  label: string;
  shortLabel: string;
  color: string;
  badgeBg: string;
  prefix: string;
  description: string;
}

export const PII_CATEGORIES: Record<PiiCategory, PiiCategoryMeta> = {
  EMAIL: {
    id: "EMAIL",
    label: "Email Addresses",
    shortLabel: "Emails",
    color: "#22D3EE",
    badgeBg: "rgba(34, 211, 238, 0.16)",
    prefix: "EMAIL",
    description: "Standard RFC-compatible email identifiers",
  },
  PHONE: {
    id: "PHONE",
    label: "Phone Numbers",
    shortLabel: "Phones",
    color: "#8B5CF6",
    badgeBg: "rgba(139, 92, 246, 0.16)",
    prefix: "PHONE",
    description: "International and Indian mobile/landline numbers",
  },
  IPV4: {
    id: "IPV4",
    label: "IPv4 Addresses",
    shortLabel: "IPv4",
    color: "#3B82F6",
    badgeBg: "rgba(59, 130, 246, 0.16)",
    prefix: "IP",
    description: "Dotted-quad IPv4 network addresses (0-255 octets)",
  },
  PAN: {
    id: "PAN",
    label: "Indian PAN Numbers",
    shortLabel: "PAN",
    color: "#D946EF",
    badgeBg: "rgba(217, 70, 239, 0.16)",
    prefix: "PAN",
    description: "10-character Permanent Account Number structure",
  },
  AADHAAR: {
    id: "AADHAAR",
    label: "Aadhaar-Format Numbers",
    shortLabel: "Aadhaar",
    color: "#A855F7",
    badgeBg: "rgba(168, 85, 247, 0.16)",
    prefix: "AADHAAR",
    description: "12-digit Aadhaar structure with Verhoeff checksum check",
  },
  CREDIT_CARD: {
    id: "CREDIT_CARD",
    label: "Credit Card Candidates",
    shortLabel: "Cards",
    color: "#22C55E",
    badgeBg: "rgba(34, 197, 94, 0.16)",
    prefix: "CARD",
    description: "Luhn-verified 13-19 digit payment card candidates",
  },
};

export const ALL_PII_CATEGORIES: PiiCategory[] = [
  "EMAIL",
  "PHONE",
  "IPV4",
  "PAN",
  "AADHAAR",
  "CREDIT_CARD",
];

export interface DetectionCandidate {
  category: PiiCategory;
  rawValue: string;
  normalizedValue: string;
  start: number;
  end: number;
  validationStatus: ValidationStatus;
}

export interface DetectedEntity extends DetectionCandidate {
  id: string;
  replacement: string;
  sanitizedStart: number;
  sanitizedEnd: number;
}

export type CategoryCounts = Record<PiiCategory, number>;

export interface SanitizationSummary {
  totalDetections: number;
  uniqueEntities: number;
  categoryCounts: CategoryCounts;
  luhnValidCards: number;
  luhnInvalidCandidates: number;
  aadhaarValidFormat: number;
  durationMs: number;
}

export interface SanitizationResult {
  originalText: string;
  sanitizedText: string;
  mode: RedactionMode;
  enabledCategories: PiiCategory[];
  entities: DetectedEntity[];
  summary: SanitizationSummary;
}

export interface CsvCellHighlight {
  rowIndex: number;
  colIndex: number;
  originalValue: string;
  sanitizedValue: string;
  entities: DetectedEntity[];
}

export interface CsvSanitizationResult {
  headers: string[];
  originalRows: string[][];
  sanitizedRows: string[][];
  serializedCsv: string;
  cellResults: CsvCellHighlight[];
  mode: RedactionMode;
  enabledCategories: PiiCategory[];
  summary: SanitizationSummary;
  rowCount: number;
  columnCount: number;
}
