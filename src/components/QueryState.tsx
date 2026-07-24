import { AlertTriangle, Loader2 } from "lucide-react";

export function QueryState({
  isLoading,
  error,
  onRetry,
  label = "data",
}: {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  label?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/40 px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading {label}…
      </div>
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Couldn’t load {label}
        </div>
        <p className="mt-1 text-xs text-muted-foreground break-words">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 rounded-md border border-border/60 px-3 py-1.5 text-xs hover:bg-accent"
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  return null;
}
