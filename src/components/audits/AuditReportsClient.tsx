"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Download,
  ArrowUpDown,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";

interface AuditRecord {
  id: string;
  userId: string;
  action: string;
  fileName: string | null;
  sanitizationMode: string | null;
  enabledCategories: string[];
  detectionCount: number;
  uniqueEntityCount: number;
  durationMs: number;
  exportStatus: string;
  createdAt: string;
}

function formatExportStatus(status: string): string {
  if (status === "NOT_EXPORTED") return "Not Exported";
  if (status === "COPIED") return "Copied";
  return status.replace(/_/g, " ");
}

export function AuditReportsClient({ initialSearch = "" }: { initialSearch?: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "detectionCount">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    { type: "single"; log: AuditRecord } | { type: "all" } | null
  >(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  function openDeleteConfirm(target: { type: "single"; log: AuditRecord } | { type: "all" }) {
    setPendingDelete(target);
    confirmDialogRef.current?.showModal();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    confirmDialogRef.current?.close();
    setPendingDelete(null);
    setExportError(null);

    const key = target.type === "all" ? "all" : target.log.id;
    setDeletingKey(key);
    try {
      const res = await fetch("/api/audits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          target.type === "all"
            ? { deleteAll: true }
            : { auditId: target.log.id }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setExportError(data?.error?.message ?? "Failed to delete audit record.");
        return;
      }
      if (target.type === "all") {
        setItems([]);
        setPage(1);
        setTotalPages(1);
      } else {
        setItems((prev) => prev.filter((item) => item.id !== target.log.id));
      }
      setRefreshTick((t) => t + 1);
    } catch {
      setExportError("Network error while deleting audit record.");
    } finally {
      setDeletingKey(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const sp = new URLSearchParams({
      page: String(page),
      pageSize: "12",
      sortBy,
      sortDir,
    });
    if (search.trim()) sp.set("search", search.trim());
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);

    fetch(`/api/audits?${sp.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!cancelled && res.ok) {
          setItems(data.items ?? []);
          setTotalPages(data.pagination?.totalPages ?? 1);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, dateFrom, dateTo, sortBy, sortDir, page, refreshTick]);

  function buildExportUrl(format: "csv" | "json", auditId?: string) {
    const sp = new URLSearchParams({ format, sortBy, sortDir });
    if (auditId) {
      sp.set("auditId", auditId);
    } else {
      if (search.trim()) sp.set("search", search.trim());
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);
    }
    return `/api/audits?${sp.toString()}`;
  }

  async function handleExport(format: "csv" | "json", auditId?: string) {
    const key = `${auditId ?? "all"}:${format}`;
    setExportingKey(key);
    setExportError(null);
    try {
      const res = await fetch(buildExportUrl(format, auditId));
      if (!res.ok) {
        setExportError("Failed to export audit report.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = auditId
        ? `zervix-audit-${auditId.slice(0, 8)}.${format}`
        : `zervix-audit-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setRefreshTick((t) => t + 1);
    } catch {
      setExportError("Network error while exporting audit report.");
    } finally {
      setExportingKey(null);
    }
  }

  function toggleSort(field: "createdAt" | "detectionCount") {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Reports</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Tamper-evident processing logs isolated to your account. Original PII
            values and raw document contents are never recorded.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={exportingKey !== null}
            onClick={() => void handleExport("csv")}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500/20 border border-violet-400/40 px-4 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/30 disabled:opacity-50 transition cursor-pointer"
          >
            {exportingKey === "all:csv" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Export CSV
          </button>
          <button
            type="button"
            disabled={exportingKey !== null}
            onClick={() => void handleExport("json")}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50 transition cursor-pointer"
          >
            {exportingKey === "all:json" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileJson className="w-4 h-4" />
            )}
            Export JSON
          </button>
          <button
            type="button"
            disabled={deletingKey !== null || items.length === 0}
            onClick={() => openDeleteConfirm({ type: "all" })}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-400/35 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/25 disabled:opacity-40 transition cursor-pointer"
          >
            {deletingKey === "all" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Clear All
          </button>
        </div>
      </div>

      {exportError ? (
        <div role="alert" className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200">
          {exportError}
        </div>
      ) : null}

      {/* Filters */}
      <section className="zervix-glass rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label htmlFor="audit-search" className="block text-[11px] text-[var(--text-secondary)] mb-1">
            Search File Name, Action, or Export Status
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="audit-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search audit records..."
              className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div>
          <label htmlFor="audit-from" className="block text-[11px] text-[var(--text-secondary)] mb-1">
            From Date
          </label>
          <input
            id="audit-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
          />
        </div>

        <div>
          <label htmlFor="audit-to" className="block text-[11px] text-[var(--text-secondary)] mb-1">
            To Date
          </label>
          <input
            id="audit-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
          />
        </div>
      </section>

      {/* Audit Table */}
      <section className="zervix-glass rounded-2xl p-5 space-y-4">
        {items.length === 0 && !loading ? (
          <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
            No audit records found. Process a document in the Workspace to create an
            audit trail.
          </div>
        ) : (
          <div className="zervix-table-wrap rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("createdAt")}
                      className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"
                    >
                      Timestamp
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Categories</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("detectionCount")}
                      className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"
                    >
                      Detections / Unique
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Export Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {items.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.03]">
                    <td className="py-3 px-4 whitespace-nowrap text-[var(--text-secondary)]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-medium max-w-[200px] truncate">
                      {log.fileName ?? log.action}
                    </td>
                    <td className="py-3 px-4">
                      {log.sanitizationMode?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[var(--text-secondary)]">
                      {log.enabledCategories.join(", ")}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-cyan-300">{log.detectionCount}</span>
                      {" / "}
                      <span className="text-violet-300">{log.uniqueEntityCount}</span>
                    </td>
                    <td className="py-3 px-4 font-mono">{log.durationMs} ms</td>
                    <td className="py-3 px-4">
                      {log.exportStatus === "NOT_EXPORTED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 text-[11px]">
                          Not Exported
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          {formatExportStatus(log.exportStatus)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={exportingKey !== null}
                          onClick={() => void handleExport("csv", log.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50 text-[11px] font-medium cursor-pointer"
                          title="Export audit record as CSV"
                        >
                          {exportingKey === `${log.id}:csv` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          CSV
                        </button>
                        <button
                          type="button"
                          disabled={exportingKey !== null}
                          onClick={() => void handleExport("json", log.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-400/35 text-violet-200 hover:bg-violet-500/25 disabled:opacity-50 text-[11px] font-medium cursor-pointer"
                          title="Export audit record as JSON"
                        >
                          {exportingKey === `${log.id}:json` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          JSON
                        </button>
                        <button
                          type="button"
                          disabled={deletingKey !== null}
                          onClick={() => openDeleteConfirm({ type: "single", log })}
                          aria-label={`Delete audit record ${log.fileName ?? log.action}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 border border-red-400/35 text-red-200 hover:bg-red-500/25 disabled:opacity-50 text-[11px] font-medium cursor-pointer"
                          title="Delete this audit record"
                        >
                          {deletingKey === log.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Native Confirm Delete Modal */}
      <dialog
        ref={confirmDialogRef}
        aria-labelledby="audit-delete-title"
        className="zervix-elevated rounded-2xl p-6 max-w-md w-[92vw] text-[var(--text-primary)] m-auto"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 text-red-300">
            <Trash2 className="w-5 h-5 shrink-0" />
            <h3 id="audit-delete-title" className="text-base font-bold">
              {pendingDelete?.type === "all"
                ? "Clear All Audit Reports?"
                : "Delete Audit Record?"}
            </h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {pendingDelete?.type === "all"
              ? "This will permanently remove all of your personal audit log entries and their linked processing metadata from your account."
              : `This will permanently delete "${pendingDelete?.log.fileName ?? pendingDelete?.log.action ?? "this record"}" and its linked metadata from your account.`}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                confirmDialogRef.current?.close();
                setPendingDelete(null);
              }}
              className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-medium hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-500 cursor-pointer"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
