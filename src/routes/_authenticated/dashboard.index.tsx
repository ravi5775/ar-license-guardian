import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyExperiences } from "@/lib/experiences.functions";
import { Boxes, Eye, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Overview,
});

function Overview() {
  const fn = useServerFn(listMyExperiences);
  const { data: experiences = [] } = useQuery({
    queryKey: ["experiences"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const total = experiences.length;
  const published = experiences.filter((e) => e.published).length;
  const totalViews = experiences.reduce((sum, e) => sum + (e.view_count ?? 0), 0);

  const stats = [
    { label: "Total Experiences", value: total, icon: Boxes },
    { label: "Published", value: published, icon: Eye },
    { label: "Total Views", value: totalViews.toLocaleString(), icon: TrendingUp },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <h1 className="text-3xl font-serif italic mb-1">Overview</h1>
      <p className="text-sm text-muted-foreground mb-8">Welcome back to your AR command center.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="text-3xl font-serif">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Experiences</h2>
        {experiences.length === 0 ? (
          <p className="text-sm text-muted-foreground">No experiences yet. Create your first one.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {experiences.slice(0, 5).map((e) => (
              <div key={e.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">/{e.slug}</div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    e.published ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {e.published ? "Published" : "Draft"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
