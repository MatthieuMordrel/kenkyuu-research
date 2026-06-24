import { FlaskConical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @property className - Optional layout classes applied to the loading page.
 * @property label - Short status text displayed beside the loading indicator.
 */
interface AppLoadingPageProps {
  className?: string;
  label?: string;
}

const metricBars = ["h-12", "h-16", "h-10", "h-20"] as const;

/**
 * Renders the full-page loading state used while authentication and route data
 * are resolving.
 */
export function AppLoadingPage({
  className,
  label = "Preparing workspace",
}: AppLoadingPageProps) {
  return (
    <main
      className={cn(
        "relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-6 py-10",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute inset-x-6 top-12 grid max-w-5xl grid-cols-4 gap-3 opacity-60 sm:inset-x-12 lg:left-1/2 lg:-translate-x-1/2">
        {metricBars.map((height, index) => (
          <div
            key={height}
            className="flex min-h-24 items-end rounded-lg border bg-card/70 p-2 shadow-sm"
          >
            <div
              className={cn(
                "w-full animate-pulse rounded-md bg-primary/10",
                height,
                index % 2 === 0 && "bg-chart-2/20"
              )}
            />
          </div>
        ))}
      </div>

      <section
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="relative flex size-16 items-center justify-center rounded-lg border bg-card shadow-sm">
          <div className="absolute inset-2 rounded-md border border-dashed border-primary/25" />
          <FlaskConical className="size-7 text-primary" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span>{label}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Loading the latest research state.
          </p>
        </div>

        <div className="grid w-full gap-2" aria-hidden="true">
          <div className="h-2 rounded-full bg-muted">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary/25" />
          </div>
          <div className="mx-auto h-2 w-3/4 rounded-full bg-muted" />
        </div>
      </section>
    </main>
  );
}
