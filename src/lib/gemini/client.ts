import "server-only";
import { GoogleGenAI } from "@google/genai";

export const ZERVIX_SYSTEM_INSTRUCTION = `You are ZERVIX AI ASSISTANT, the official product-help assistant for ZERVIX.

Your purpose is to help users understand data privacy, PII detection, sanitization modes, validation, reports, security and application navigation.

Provide accurate, concise and practical answers.

Never claim to have processed a document.

Never claim to have accessed private files.

Never request passwords, API keys, Aadhaar numbers, credit card numbers or other sensitive information.

Never request original document contents.

Explain that document sanitization happens locally in the user's browser.

Do not invent statistics, security certifications or compliance guarantees.

If you do not know something, say so.

Always prioritize user privacy.`;

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export interface GeminiConfigStatus {
  configured: boolean;
  model: string;
}

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

export function getGeminiConfigStatus(): GeminiConfigStatus {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return {
    configured:
      apiKey.length > 0 &&
      apiKey !== "your_server_side_key_here",
    model,
  };
}

export class GeminiIntegrationError extends Error {
  statusCode: number;
  code:
    | "NOT_CONFIGURED"
    | "INVALID_CREDENTIALS"
    | "QUOTA_EXHAUSTED"
    | "MODEL_UNAVAILABLE"
    | "UPSTREAM_ERROR";

  constructor(
    message: string,
    statusCode: number,
    code:
      | "NOT_CONFIGURED"
      | "INVALID_CREDENTIALS"
      | "QUOTA_EXHAUSTED"
      | "MODEL_UNAVAILABLE"
      | "UPSTREAM_ERROR"
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function classifyGeminiError(err: unknown, model: string): GeminiIntegrationError {
  if (err instanceof GeminiIntegrationError) {
    return err;
  }

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission_denied")
  ) {
    return new GeminiIntegrationError(
      "ZERVIX AI credentials were rejected by the upstream service. Verify server configuration.",
      502,
      "INVALID_CREDENTIALS"
    );
  }

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit")
  ) {
    return new GeminiIntegrationError(
      "ZERVIX AI quota or rate limit exceeded. Please wait a moment before trying again.",
      429,
      "QUOTA_EXHAUSTED"
    );
  }

  if (
    lower.includes("503") ||
    lower.includes("high demand") ||
    lower.includes("unavailable") ||
    lower.includes("not found") ||
    lower.includes("404") ||
    (lower.includes("model") && lower.includes("unsupported"))
  ) {
    return new GeminiIntegrationError(
      `ZERVIX AI model "${model}" is currently unavailable. Please try again shortly.`,
      502,
      "MODEL_UNAVAILABLE"
    );
  }

  return new GeminiIntegrationError(
    "Unable to reach ZERVIX AI due to a network or upstream service error.",
    502,
    "UPSTREAM_ERROR"
  );
}

export async function generateZervixAssistantReply(params: {
  message: string;
  history?: ChatTurn[];
  appContext?: string;
}): Promise<{ reply: string; model: string }> {
  const { configured, model } = getGeminiConfigStatus();
  if (!configured) {
    throw new GeminiIntegrationError(
      "ZERVIX AI is not configured on the server yet. Add your server-side key to .env.local to enable live responses.",
      503,
      "NOT_CONFIGURED"
    );
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!.trim(),
    httpOptions: { timeout: 20000 },
  });

  const contents = [
    ...(params.history ?? []).slice(-10).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: "user" as const,
      parts: [
        {
          text: params.appContext
            ? `[Non-sensitive app context: ${params.appContext}]\n\nUser question: ${params.message}`
            : params.message,
        },
      ],
    },
  ];

  const candidateModels = [
    model,
    ...FALLBACK_MODELS.filter((m) => m !== model),
  ];

  let lastError: GeminiIntegrationError | null = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const activeModel = candidateModels[i];
    try {
      const response = await ai.models.generateContent({
        model: activeModel,
        contents,
        config: {
          systemInstruction: ZERVIX_SYSTEM_INSTRUCTION,
          temperature: 0.35,
          maxOutputTokens: 900,
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new GeminiIntegrationError(
          "ZERVIX AI returned an empty response. Please try rephrasing your question.",
          502,
          "UPSTREAM_ERROR"
        );
      }

      return { reply: text, model: activeModel };
    } catch (err: unknown) {
      const classified = classifyGeminiError(err, activeModel);
      lastError = classified;
      // Only fall back to another model when a model is temporarily unavailable / high demand (503/404)
      if (classified.code !== "MODEL_UNAVAILABLE") {
        throw classified;
      }
    }
  }

  throw lastError ?? new GeminiIntegrationError("Unable to reach ZERVIX AI.", 502, "UPSTREAM_ERROR");
}
