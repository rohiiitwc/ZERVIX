import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: Record<string, string>
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status, headers }
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
  maxBytes = 32 * 1024
): Promise<
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }
> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) {
    return {
      ok: false,
      response: apiError(
        413,
        "PAYLOAD_TOO_LARGE",
        `Request body exceeds ${maxBytes} byte limit.`
      ),
    };
  }

  let rawText = "";
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false,
      response: apiError(400, "INVALID_BODY", "Unable to read request body."),
    };
  }

  if (Buffer.byteLength(rawText, "utf8") > maxBytes) {
    return {
      ok: false,
      response: apiError(
        413,
        "PAYLOAD_TOO_LARGE",
        `Request body exceeds ${maxBytes} byte limit.`
      ),
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      response: apiError(400, "INVALID_JSON", "Malformed JSON payload."),
    };
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    return {
      ok: false,
      response: apiError(
        400,
        "VALIDATION_ERROR",
        result.error.issues[0]?.message ?? "Validation failed.",
        result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }))
      ),
    };
  }

  return { ok: true, data: result.data };
}
