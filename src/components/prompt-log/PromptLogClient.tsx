"use client";

import { useState, useEffect } from "react";
import { TerminalSquare, Plus, Loader2 } from "lucide-react";

interface PromptLogItem {
  id: string;
  phase: string;
  category: string;
  title: string;
  summary: string;
  promptNotes: string;
  outcome: string;
  createdAt: string;
}

export function PromptLogClient({ isAdmin }: { isAdmin: boolean }) {
  const [entries, setEntries] = useState<PromptLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  const [showAdd, setShowAdd] = useState(false);
  const [phase, setPhase] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [promptNotes, setPromptNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prompt-log")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
  }, []);

  const categories = Array.from(new Set(entries.map((e) => e.category)));
  const visible =
    filter === "ALL" ? entries : entries.filter((e) => e.category === filter);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/prompt-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          category,
          title,
          summary,
          promptNotes,
          outcome,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Failed to create prompt log entry.");
        return;
      }
      setEntries((prev) => [data.entry, ...prev]);
      setShowAdd(false);
      setPhase("");
      setCategory("");
      setTitle("");
      setSummary("");
      setPromptNotes("");
      setOutcome("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Prompt Engineering Log
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Genuine architecture, PII engine, security, and testing engineering
            records. Contains zero secrets or original PII.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filter prompt log category"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
          >
            <option value="ALL">All Phases & Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowAdd((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white px-4 py-2 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Record
            </button>
          ) : null}
        </div>
      </div>

      {showAdd && isAdmin ? (
        <form
          onSubmit={handleCreate}
          className="zervix-gradient-border rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-sm font-semibold">Append Engineering Record</h3>
          {error ? (
            <div role="alert" className="text-xs text-red-300 bg-red-500/15 p-2.5 rounded-xl">
              {error}
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Phase (e.g. Phase 6 — Automated Testing)"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
            />
            <input
              required
              placeholder="Category (e.g. Security Review)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
            />
          </div>
          <input
            required
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
          />
          <textarea
            required
            rows={2}
            placeholder="Summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
          />
          <textarea
            required
            rows={2}
            placeholder="Prompt Engineering Notes"
            value={promptNotes}
            onChange={(e) => setPromptNotes(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
          />
          <input
            required
            placeholder="Verified Outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 rounded-xl text-xs border border-[var(--border-subtle)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save Record
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="text-xs text-[var(--text-secondary)]">Loading prompt log...</div>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <article
              key={item.id}
              className="zervix-glass rounded-2xl p-5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-violet-300">
                    {item.phase}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                    {item.category}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-sm font-bold">{item.title}</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {item.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-[var(--bg-secondary)] p-3 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-violet-300 font-semibold mb-1">
                    Prompt Engineering Notes
                  </div>
                  <p className="text-[var(--text-secondary)]">{item.promptNotes}</p>
                </div>
                <div className="rounded-xl bg-[var(--bg-secondary)] p-3 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold mb-1">
                    Verified Outcome
                  </div>
                  <p className="text-[var(--text-secondary)]">{item.outcome}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
