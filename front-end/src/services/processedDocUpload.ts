/** Concurrent uploads per batch (folder / drag-drop). */
export const PROCESSED_DOC_UPLOAD_BATCH_SIZE = 3;

const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 800;

export class ProcessedDocUploadHttpError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ProcessedDocUploadHttpError";
    this.status = status;
    this.code = code;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetryStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 429;
}

function isTransientNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  if (e.name === "TypeError" && m.includes("fetch")) return true;
  if (m.includes("failed to fetch")) return true;
  if (m.includes("networkerror")) return true;
  if (m === "request aborted" || m.includes("request aborted")) return true;
  return false;
}

async function parseErrorBody(
  res: Response,
): Promise<{ error?: string; code?: string }> {
  try {
    const text = await res.text();
    if (!text) return {};
    try {
      const j = JSON.parse(text) as { error?: string; code?: string };
      return { error: j.error, code: j.code };
    } catch {
      return { error: text.slice(0, 200) };
    }
  } catch {
    return {};
  }
}

/**
 * POST multipart to processed-docs upload with retries for transient failures.
 * `buildFormData` is invoked per attempt so the body can be recreated after each retry.
 */
export async function uploadProcessedDocFile(
  apiBaseUrl: string,
  buildFormData: () => FormData,
  init?: RequestInit,
): Promise<void> {
  const url = `${apiBaseUrl.replace(/\/$/, "")}/api/processed-docs/files/upload`;
  let lastErr: unknown;

  for (let attempt = 0; attempt < DEFAULT_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: buildFormData(),
        credentials: "include",
        ...init,
      });

      if (res.ok) return;

      const body = await parseErrorBody(res);
      const msg = body.error || `Lỗi HTTP ${res.status}`;
      const code = body.code;

      if (shouldRetryStatus(res.status) && attempt < DEFAULT_MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      throw new ProcessedDocUploadHttpError(msg, res.status, code);
    } catch (e) {
      lastErr = e;
      if (e instanceof ProcessedDocUploadHttpError) throw e;
      if (isTransientNetworkError(e) && attempt < DEFAULT_MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw e;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("Upload thất bại sau nhiều lần thử");
}
