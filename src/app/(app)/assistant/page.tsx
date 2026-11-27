import { FloatingAssistant } from "@/components/assistant/FloatingAssistant";
import { getGeminiConfigStatus } from "@/lib/gemini/client";
import { ShieldAlert, KeyRound, Sparkles } from "lucide-react";

export default function AssistantPage() {
  const aiStatus = getGeminiConfigStatus();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            ZERVIX AI ASSISTANT
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Powered server-side by the{" "}
            <span className="text-cyan-300 font-medium">ZERVIX AI Engine</span>{" "}
            with dual PII preflight protection.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium ${
            aiStatus.configured
              ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-300"
              : "bg-amber-500/10 border-amber-400/30 text-amber-200"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          {aiStatus.configured
            ? "ZERVIX AI Ready"
            : "ZERVIX AI Server Key Required"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <FloatingAssistant embedded appContext="Dedicated AI Assistant Page" />
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="zervix-glass rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-300">
              <ShieldAlert className="w-4 h-4" />
              Privacy Boundary Enforced
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Do not paste documents, emails, phone numbers, PANs, Aadhaar
              candidates, or credit cards here. Both the browser and server block
              sensitive prompts before reaching ZERVIX AI.
            </p>
          </div>

          <div className="zervix-glass rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <Sparkles className="w-4 h-4" />
              Server Key Isolation
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              ZERVIX AI credentials are read exclusively in server-side Route
              Handlers and never exposed to client bundles or API responses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
