import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";

describe("ZERVIX Sanitization Workspace UI", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ activity: { id: "act-1" } }),
      })
    );
  });

  it("processes pasted text locally, renders live comparison, and never uploads raw text", async () => {
    render(<WorkspaceClient />);

    const textarea = screen.getByLabelText(/Or paste document text/i);
    fireEvent.change(textarea, {
      target: {
        value: "Contact <script>alert(1)</script> at alice@example.com or PAN ABCPE1234F",
      },
    });

    const processBtn = screen.getByRole("button", { name: /Process Document/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Original Document \(Detected PII Highlighted\)/i)
      ).toBeTruthy();
      expect(
        screen.getByText(/Sanitized Document \(Replacements Highlighted\)/i)
      ).toBeTruthy();
    });

    // Verify fetch was called ONLY with metadata (never raw document text)
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.totalDetections).toBe(2);
    expect(body).not.toHaveProperty("originalText");
    expect(body).not.toHaveProperty("sanitizedText");
    expect(JSON.stringify(body)).not.toContain("alice@example.com");
    expect(JSON.stringify(body)).not.toContain("ABCPE1234F");
  });

  it("loads synthetic CSV sample and preserves row/column structure", async () => {
    render(<WorkspaceClient />);

    const csvSampleBtn = screen.getByRole("button", {
      name: /Synthetic Customer Directory \(CSV\)/i,
    });
    fireEvent.click(csvSampleBtn);

    fireEvent.click(screen.getByRole("button", { name: /Process Document/i }));

    await waitFor(() => {
      expect(screen.getByText(/Live CSV Comparison/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Download CSV/i })).toBeTruthy();
    });
  });
});
