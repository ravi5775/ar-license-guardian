import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getAnalytics } from "@/lib/analytics.functions";
import { QueryState } from "@/components/QueryState";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  head: () => ({
    meta: [
      { title: "Scan Analytics — Aether AR" },
      {
        name: "description",
        content:
          "Album scans, photo identification success rate and playback completion per photo.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fn = useServerFn(getAnalytics);
  const [days, setDays] = useState(30);

  const q = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => fn({ data: { days } }),
    staleTime: 30_000,
  });

  const t = q.data?.totals;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-serif italic">Scan analytics</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Album scans, how often a photo is correctly identified, and how much of each video people
        actually watch.
      </p>

      <QueryState
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        label="analytics"
      />

      {t && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <Stat label="Album scans" value={String(t.scans)} />
            <Stat
              label="Photo identified"
              value={`${t.scans ? Math.round((t.identified / t.scans) * 100) : 0}%`}
              sub={`${t.identified} of ${t.scans} sessions`}
            />
            <Stat label="Videos started" value={String(t.plays)} />
            <Stat
              label="Playback completion"
              value={`${t.plays ? Math.round((t.completions / t.plays) * 100) : 0}%`}
              sub={`${t.completions} finished`}
            />
          </div>

          {q.data!.albums.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No albums yet — create one to start collecting scan data.
            </p>
          )}

          <div className="space-y-6">
            {q.data!.albums.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 md:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <h2 className="text-lg font-medium">{a.title}</h2>
                  <div className="text-xs text-muted-foreground">
                    {a.scans} scans · {a.identification_rate}% identified · {a.timeouts} timeouts
                  </div>
                </div>
                {a.photos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No photos.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3">#</th>
                          <th className="py-2 pr-3">Photo</th>
                          <th className="py-2 pr-3">Identified</th>
                          <th className="py-2 pr-3">Plays</th>
                          <th className="py-2 pr-3">Completed</th>
                          <th className="py-2 pr-3">Avg. detect</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.photos.map((p) => (
                          <tr key={p.target_index} className="border-t border-border/40">
                            <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                              {p.target_index + 1}
                            </td>
                            <td className="py-2 pr-3">{p.title}</td>
                            <td className="py-2 pr-3 tabular-nums">{p.found}</td>
                            <td className="py-2 pr-3 tabular-nums">{p.starts}</td>
                            <td className="py-2 pr-3 tabular-nums">
                              {p.completes}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({p.completion_rate}%)
                              </span>
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {p.avg_detect_ms != null
                                ? `${(p.avg_detect_ms / 1000).toFixed(1)}s`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-medium tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
