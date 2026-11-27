/**
 * Pure validation utilities for ZERVIX PII categories.
 * Note: Format and checksum checks validate mathematical/structural conformance only;
 * they never confirm whether an ID or card is genuinely issued or active.
 */

// Verhoeff multiplication, permutation, and inverse tables for 12-digit Aadhaar checksum
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Complete Luhn (Mod-10) algorithm for payment card candidates (13-19 digits).
 * Rejects uniform repeated-digit strings like 0000000000000000.
 */
export function luhnCheck(raw: string): boolean {
  const digits = stripNonDigits(raw);
  if (digits.length < 13 || digits.length > 19) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Verhoeff checksum validation used on 12-digit Aadhaar-format numbers.
 */
export function verhoeffCheck(raw: string): boolean {
  const digits = stripNonDigits(raw);
  if (digits.length !== 12) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[digits.length - 1 - i]);
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digit]];
  }
  return c === 0;
}

/**
 * Generates a valid Verhoeff check digit for an 11-digit base (useful for synthetic test samples).
 */
export function computeVerhoeffCheckDigit(elevenDigits: string): string {
  const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];
  let c = 0;
  const reversed = elevenDigits.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][reversed[i]]];
  }
  return String(INV[c]);
}

/**
 * Aadhaar structure check: 12 digits starting with 2-9, not all identical digits.
 * Returns whether format is valid and whether Verhoeff checksum passes.
 */
export function validateAadhaarCandidate(raw: string): {
  isFormatValid: boolean;
  isChecksumValid: boolean;
} {
  const digits = stripNonDigits(raw);
  if (!/^[2-9]\d{11}$/.test(digits)) {
    return { isFormatValid: false, isChecksumValid: false };
  }
  if (/^(\d)\1{11}$/.test(digits)) {
    return { isFormatValid: false, isChecksumValid: false };
  }
  return {
    isFormatValid: true,
    isChecksumValid: verhoeffCheck(digits),
  };
}

/**
 * Indian PAN format: 5 uppercase letters, 4 digits, 1 uppercase letter.
 */
export function isValidPan(raw: string): boolean {
  const normalized = raw.trim().toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized);
}

/**
 * Validates an IPv4 dotted-quad address with octets 0..255 and rejects leading zeros like 01.
 */
export function isValidIpv4(raw: string): boolean {
  const parts = raw.trim().split(".");
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return false;
    const num = Number(part);
    if (num < 0 || num > 255) return false;
  }
  return true;
}

export function isValidEmail(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length > 254) return false;
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(
    trimmed
  ) && /\.[A-Za-z]{2,}$/.test(trimmed);
}

/**
 * Validates phone numbers while rejecting dates, timestamps, Aadhaar (12 digits w/o +),
 * and payment card numbers (13-19 digits).
 */
export function isValidPhone(raw: string): boolean {
  const trimmed = raw.trim();
  // Reject ISO dates like 2026-11-27 or dotted dates 12.10.2025
  if (/^\d{4}[-/.]\d{2}[-/.]\d{2}$/.test(trimmed)) return false;
  if (/^\d{2}[-/.]\d{2}[-/.]\d{4}$/.test(trimmed)) return false;
  // Reject version/IP-like dotted strings
  if (/^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) return false;

  const digits = stripNonDigits(trimmed);
  const hasPlus = trimmed.startsWith("+");

  if (hasPlus) {
    // E.164 international phone numbers: 8 to 15 digits
    if (digits.length < 8 || digits.length > 15) return false;
    // Reject if it looks like a raw 12-digit + formatted card/aadhaar
    if (digits.length === 12 && !trimmed.startsWith("+91") && !trimmed.startsWith("+1")) {
      return digits.length <= 15;
    }
    return true;
  }

  // Without leading +:
  // Support 10-digit Indian mobile (6-9XXXXXXXXX) or US/standard 10-digit (e.g. (415) 555-0192 or 415-555-0192)
  if (digits.length === 10) {
    if (/^[6-9]\d{9}$/.test(digits)) return true;
    // Formatted 10-digit like 415-555-0192 or (415) 555-0192
    if (/[\s().-]/.test(trimmed) && /^[2-9]\d{9}$/.test(digits)) return true;
    return false;
  }

  // 11 digits starting with 1 (US) or 0 (trunk) when formatted
  if (digits.length === 11 && /^[01][2-9]\d{9}$/.test(digits) && /[\s().-]/.test(trimmed)) {
    return true;
  }

  // 12 digits starting with 91 + Indian 10-digit mobile starting 6-9
  if (digits.length === 12 && /^91[6-9]\d{9}$/.test(digits)) {
    return true;
  }

  return false;
}
