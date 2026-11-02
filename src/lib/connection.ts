/**
 * Connection-error detection shared by sign-in and workspace loading so a
 * paused / unreachable backend surfaces a retryable state instead of a dead end.
 */
export function isConnectionError(error: unknown): boolean {
  if (!error) return false;

  // supabase-js marks transport / 5xx auth failures as retryable; AuthApiError carries `status`.
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number" && status >= 500) return true;

  const message = error instanceof Error ? error.message : String(error);
  if (!message) return false;
  const m = message.toLowerCase();

  return (
    m.includes("failed to fetch") ||
    m.includes("fetch failed") ||
    m.includes("load failed") ||
    m.includes("networkerror") ||
    m.includes("network error") ||
    m.includes("connection refused") ||
    m.includes("connection reset") ||
    m.includes("connection closed") ||
    m.includes("socket hang up") ||
    m.includes("timed out") ||
    m.includes("timeout") ||
    /\b5\d\d\b/.test(message) // bare status codes such as 530 / 502 in the message
  );
}

/** One-line, user-safe reason for a connection failure (no stack traces). */
export function describeConnectionError(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

/** React Query options: auto-retry only transient connection failures, with a short backoff. */
export const retryOnConnectionError = {
  retry: (failureCount: number, error: unknown) => isConnectionError(error) && failureCount < 2,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 4000),
};
