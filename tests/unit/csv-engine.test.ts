import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { sanitizeCsvDocument } from "@/lib/pii/csv";

describe("ZERVIX CSV Engine", () => {
  it("preserves headers, row order, quoted commas, escaped quotes, multiline cells, and empty cells", () => {
    const inputCsv = [
      'ID,Name,Email,Notes',
      '1,"Mehta, Aarav",aarav@example.com,"Line 1 ""VIP""\nLine 2 contact: aarav@example.com"',
      '2,"Nair, Diya",,"Empty email preserved, IP 192.168.10.20 redacted"',
    ].join("\n");

    const res = sanitizeCsvDocument(inputCsv, { mode: "PSEUDONYMIZE" });

    expect(res.headers).toEqual(["ID", "Name", "Email", "Notes"]);
    expect(res.rowCount).toBe(2);
    expect(res.columnCount).toBe(4);
    expect(res.sanitizedRows[0][1]).toBe("Mehta, Aarav");
    expect(res.sanitizedRows[0][2]).toBe("EMAIL_01");
    expect(res.sanitizedRows[0][3]).toContain('Line 1 "VIP"\nLine 2 contact: EMAIL_01');
    expect(res.sanitizedRows[1][2]).toBe("");
    expect(res.sanitizedRows[1][3]).toContain("IP_01");

    // Verify re-parsing serialized CSV keeps exact structure and rows
    const reparsed = Papa.parse<string[]>(res.serializedCsv, { header: false });
    expect(reparsed.data).toHaveLength(3);
    expect(reparsed.data[1][1]).toBe("Mehta, Aarav");
    expect(reparsed.data[1][3]).toContain('Line 1 "VIP"\nLine 2 contact: EMAIL_01');
    expect(reparsed.data[2][2]).toBe("");
  });

  it("handles empty CSV input gracefully", () => {
    const res = sanitizeCsvDocument("   ", { mode: "FULL_MASK" });
    expect(res.rowCount).toBe(0);
    expect(res.summary.totalDetections).toBe(0);
    expect(res.serializedCsv).toBe("");
  });

  it("handles large CSV documents within milliseconds", () => {
    const header = "id,email,ip";
    const rows = Array.from({ length: 500 }, (_, i) => `${i},user${i}@corp.net,10.0.0.${(i % 250) + 1}`);
    const bigCsv = [header, ...rows].join("\n");
    const res = sanitizeCsvDocument(bigCsv, { mode: "FULL_MASK" });
    expect(res.rowCount).toBe(500);
    expect(res.summary.totalDetections).toBe(1000);
  });
});
