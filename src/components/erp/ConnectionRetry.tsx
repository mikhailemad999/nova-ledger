import { Link } from "@tanstack/react-router";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title?: string;
  message: string;
  detail?: string | null;
  onRetry: () => void;
  retrying?: boolean;
  /** Optional secondary escape hatch, e.g. "Sign in again" when the session is stale. */
  secondaryTo?: string | undefined;
  secondaryLabel?: string | undefined;
  className?: string;
};

/** Retryable connection state: shown when a backend call fails so the user is never stuck on a spinner. */
export function ConnectionRetry({
  title = "Connection problem",
  message,
  detail,
  onRetry,
  retrying = false,
  secondaryTo,
  secondaryLabel = "Sign in again",
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={
        className ??
        "flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 px-6 text-center"
      }
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <CloudOff className="size-6" aria-hidden />
      </span>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {detail ? (
        <p className="num max-w-md truncate rounded-md border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          {detail}
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={onRetry} disabled={retrying}>
          {retrying ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          {retrying ? "Retrying…" : "Try again"}
        </Button>
        {secondaryTo ? (
          <Button asChild variant="outline">
            <Link to={secondaryTo}>{secondaryLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
