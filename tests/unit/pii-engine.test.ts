import { describe, expect, it } from "vitest";
import { detectPii } from "@/lib/pii/detectors";
import { sanitizeDocumentText } from "@/lib/pii/sanitizer";
import {
  computeVerhoeffCheckDigit,
  isValidIpv4,
  isValidPan,
  luhnCheck,
  verhoeffCheck,
} from "@/lib/pii/validators";
import { checkPromptForPii } from "@/lib/pii/preflight";

describe("ZERVIX Validators", () => {
  it("validates Luhn credit card candidates accurately and rejects invalid/repeated ones", () => {
    expect(luhnCheck("4532-0151-1283-0366")).toBe(true);
    expect(luhnCheck("4111111111111111")).toBe(true);
    expect(luhnCheck("4532-0151-1283-0367")).toBe(false);
    expect(luhnCheck("0000000000000000")).toBe(false);
    expect(luhnCheck("123456")).toBe(false);
  });

  it("validates Verhoeff Aadhaar checksum and rejects invalid checksum", () => {
    const base = "34987654321";
    const check = computeVerhoeffCheckDigit(base);
    const validAadhaar = `${base}${check}`;
    expect(verhoeffCheck(validAadhaar)).toBe(true);
    const badDigit = check === "9" ? "8" : "9";
    expect(verhoeffCheck(`${base}${badDigit}`)).toBe(false);
  });

  it("validates Indian PAN and IPv4 octets", () => {
    expect(isValidPan("ABCPE1234F")).toBe(true);
    expect(isValidPan("PQRSX6789K")).toBe(true);
    expect(isValidPan("ABC1234F")).toBe(false);
    expect(isValidPan("PQRSX6789KZ")).toBe(false);
    expect(isValidIpv4("192.168.1.254")).toBe(true);
    expect(isValidIpv4("256.1.1.1")).toBe(false);
    expect(isValidIpv4("192.168.01.1")).toBe(false);
  });
});

describe("ZERVIX PII Detection & Overlap Prevention", () => {
  it("detects all 6 categories without overlapping spans or false positives", () => {
    const aadhaar = `34987654321${computeVerhoeffCheckDigit("34987654321")}`;
    const text = [
      "Email: user.test@domain.org",
      "Phone: +91 9876543210",
      "IP: 10.0.12.44",
      "PAN: ABCPE1234F",
      `Aadhaar: ${aadhaar}`,
      "Card: 4532-0151-1283-0366",
      "BadCard: 4532-0151-1283-0367",
      "Version: v1.2.3.4 on 2026-11-27",
    ].join("\n");

    const { candidates, luhnInvalidCandidates } = detectPii(text);
    const categories = candidates.map((c) => c.category);
    expect(categories).toEqual([
      "EMAIL",
      "PHONE",
      "IPV4",
      "PAN",
      "AADHAAR",
      "CREDIT_CARD",
    ]);
    expect(luhnInvalidCandidates).toBe(1);

    // Ensure no overlapping ranges
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].start).toBeGreaterThanOrEqual(candidates[i - 1].end);
    }
  });

  it("detects edge-case synthetic credentials while ignoring negative cases", () => {
    const edgeCaseDoc = [
      "Email candidate: qa.user+zervix@example.net",
      "IPv4 documentation address: 198.51.100.25",
      "PAN-format candidate: PQRSX6789K",
      "Phone candidate: +1 (202) 555-0147",
      "Malformed email: qa.user@@example",
      "Invalid IPv4: 999.999.999.999",
      "Ordinary number: 123456",
      "Short card candidate: 1234 5678",
    ].join("\n");

    const res = sanitizeDocumentText(edgeCaseDoc, { mode: "FULL_MASK" });
    expect(res.entities.map((e) => e.category)).toEqual(["EMAIL", "IPV4", "PAN", "PHONE"]);
    expect(res.sanitizedText).not.toContain("qa.user+zervix@example.net");
    expect(res.sanitizedText).not.toContain("198.51.100.25");
    expect(res.sanitizedText).not.toContain("PQRSX6789K");
    expect(res.sanitizedText).not.toContain("+1 (202) 555-0147");
    expect(res.sanitizedText).toContain("qa.user@@example");
    expect(res.sanitizedText).toContain("999.999.999.999");
    expect(res.sanitizedText).toContain("123456");
    expect(res.sanitizedText).toContain("1234 5678");
  });

  it("respects category enable/disable toggles", () => {
    const text = "Contact test@example.com or 192.168.1.1";
    const result = sanitizeDocumentText(text, {
      mode: "FULL_MASK",
      enabledCategories: ["EMAIL"],
    });
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].category).toBe("EMAIL");
    expect(result.sanitizedText).toBe("Contact [REDACTED] or 192.168.1.1");
  });
});

describe("ZERVIX Sanitization Modes", () => {
  const aadhaar = `34987654321${computeVerhoeffCheckDigit("34987654321")}`;
  const sample = `Mail: alice@corp.io, Repeat: ALICE@corp.io, PAN: ABCPE1234F, Card: 4532-0151-1283-0366, Aadhaar: ${aadhaar}`;

  it("applies FULL_MASK mode", () => {
    const res = sanitizeDocumentText(sample, { mode: "FULL_MASK" });
    expect(res.sanitizedText).not.toContain("alice@corp.io");
    expect(res.sanitizedText).not.toContain("ABCPE1234F");
    expect(res.sanitizedText).toContain("[REDACTED]");
    expect(res.summary.totalDetections).toBe(5);
    expect(res.summary.uniqueEntities).toBe(4);
  });

  it("applies PARTIAL_MASK mode preserving verification context", () => {
    const res = sanitizeDocumentText(sample, { mode: "PARTIAL_MASK" });
    expect(res.sanitizedText).toContain("al***@c***.io");
    expect(res.sanitizedText).toContain("AB******4F");
    expect(res.sanitizedText).toContain("4532-XXXX-XXXX-0366");
    expect(res.sanitizedText).toContain(`XXXX-XXXX-${aadhaar.slice(-4)}`);
  });

  it("applies PSEUDONYMIZE deterministically per session and resets across new documents", () => {
    const res1 = sanitizeDocumentText(sample, { mode: "PSEUDONYMIZE" });
    expect(res1.sanitizedText).toContain("Mail: EMAIL_01, Repeat: EMAIL_01");
    expect(res1.sanitizedText).toContain("PAN_01");
    expect(res1.sanitizedText).toContain("CARD_01");
    expect(res1.sanitizedText).toContain("AADHAAR_01");

    const res2 = sanitizeDocumentText("bob@other.org", { mode: "PSEUDONYMIZE" });
    expect(res2.sanitizedText).toBe("EMAIL_01");
  });
});

describe("ZERVIX Gemini PII Preflight Guard", () => {
  it("allows safe product-help questions", () => {
    const check = checkPromptForPii(
      "How does Luhn validation work for payment card candidates in ZERVIX?"
    );
    expect(check.blocked).toBe(false);
  });

  it("blocks prompts containing emails, PAN, Aadhaar, cards, or API keys", () => {
    expect(checkPromptForPii("Please check alice@example.com for me").blocked).toBe(
      true
    );
    expect(checkPromptForPii("Is PAN ABCPE1234F valid?").blocked).toBe(true);
    expect(checkPromptForPii("My key is AIzaSyDummyKeyValue1234567890123").blocked).toBe(
      true
    );
  });
});
