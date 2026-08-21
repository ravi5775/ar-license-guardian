import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  CALIBRATION_STEPS,
  listMarkerTests,
  recordMarkerTest,
  deleteMarkerTest,
} from "@/lib/marker-tests.functions";
import { listMyAlbums } from "@/lib/albums.functions";
import { QueryState } from "@/components/QueryState";
import { CheckCircle2, CircleAlert, Play, Square, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/marker-tests")({
  head: () => ({
    meta: [
      { title: "Marker Accuracy Testing — Aether AR" },
      {
        name: "description",
        content:
          "Run guided real-world AR marker calibration steps and record scan outcomes per print.",
      },
    ],
  }),
  component: MarkerTestsPage,
});

type Outcome = "success" | "partial" | "fail";

function MarkerTestsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMarkerTests);
  const albumsFn = useServerFn(listMyAlbums);
  const record = useServerFn(recordMarkerTest);
  const del = useServerFn(deleteMarkerTest);

  const tests = useQuery({
    queryKey: ["marker-tests"],
    queryFn: () => list(),
    staleTime: 15_000,
  });
  const albums = useQuery({
    queryKey: ["albums"],
    queryFn: () => albumsFn(),
    staleTime: 60_000,
  });

  const [stepIdx, setStepIdx] = useState(0);
  const [albumId, setAlbumId] = useState<string>("");
  const [markerLabel, setMarkerLabel] = useState("");
  const [device, setDevice] = useState("");
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && !device) {
      setDevice(navigator.userAgent.slice(0, 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startRef.current) setElapsed(Date.now() - startRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  const step = CALIBRATION_STEPS[stepIdx];

  const save = useMutation({
    mutationFn: (outcome: Outcome) =>
      record({
        data: {
          album_id: albumId || null,
          marker_label: markerLabel.trim() || "Untitled print",
          step_key: step.key,
          lighting: step.lighting,
          distance_cm: step.distance_cm,
          angle_deg: step.angle_deg,
          device: device || null,
          outcome,
          time_to_detect_ms: elapsed,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Result recorded");
      setNotes("");
      setElapsed(null);
      setRunning(false);
      startRef.current = null;
      qc.invalidateQueries({ queryKey: ["marker-tests"] });
      setStepIdx((i) => Math.min(i + 1, CALIBRATION_STEPS.length - 1));
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save result"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marker-tests"] }),
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const rows = tests.data ?? [];
  const total = rows.length;
  const ok = rows.filter((r: any) => r.outcome === "success").length;
  const successRate = total ? Math.round((ok / total) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-serif italic mb-1">Marker accuracy testing</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Work through the guided steps with a real printed photo and record what actually happened.
        Results build your reliability baseline per print.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat label="Runs recorded" value={String(total)} />
        <Stat label="Success rate" value={`${successRate}%`} />
        <Stat
          label="Failures"
          value={String(rows.filter((r: any) => r.outcome === "fail").length)}
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-4 md:p-6 mb-8">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CALIBRATION_STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStepIdx(i)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                i === stepIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        <h2 className="text-lg font-medium mb-1">{step.title}</h2>
        <p className="text-sm text-muted-foreground mb-4">{step.instruction}</p>

        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">Print / marker label</span>
            <input
              value={markerLabel}
              onChange={(e) => setMarkerLabel(e.target.value)}
              placeholder="e.g. Wedding album — page 3, glossy 6×4"
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">Album (optional)</span>
            <select
              value={albumId}
              onChange={(e) => setAlbumId(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            >
              <option value="">— none —</option>
              {(albums.data ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={() => {
              if (running) {
                setRunning(false);
              } else {
                startRef.current = Date.now();
                setElapsed(0);
                setRunning(true);
              }
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-accent"
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Stop timer" : "Start detect timer"}
          </button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {elapsed === null ? "—" : `${(elapsed / 1000).toFixed(1)}s to detect`}
          </span>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="What happened? jitter, wrong photo matched, needed a second try…"
          className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm mb-4"
        />

        <div className="flex flex-wrap gap-2">
          <OutcomeBtn
            tone="success"
            disabled={save.isPending}
            onClick={() => save.mutate("success")}
          >
            <CheckCircle2 className="h-4 w-4" /> Locked on
          </OutcomeBtn>
          <OutcomeBtn
            tone="partial"
            disabled={save.isPending}
            onClick={() => save.mutate("partial")}
          >
            <CircleAlert className="h-4 w-4" /> Unstable
          </OutcomeBtn>
          <OutcomeBtn tone="fail" disabled={save.isPending} onClick={() => save.mutate("fail")}>
            <XCircle className="h-4 w-4" /> No detection
          </OutcomeBtn>
        </div>
      </div>

      <h2 className="text-lg font-medium mb-3">Recorded runs</h2>
      <QueryState
        isLoading={tests.isLoading}
        error={tests.error}
        onRetry={() => tests.refetch()}
        label="test runs"
      />
      {!tests.isLoading && !tests.error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No runs yet — complete a step above to start your baseline.
        </p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-card/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Print</th>
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">Conditions</th>
                <th className="px-3 py-2">Detect</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t border-border/40 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.marker_label}</td>
                  <td className="px-3 py-2">{r.step_key}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.lighting}
                    {r.distance_cm ? ` · ${r.distance_cm}cm` : ""}
                    {r.angle_deg != null ? ` · ${r.angle_deg}°` : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.time_to_detect_ms != null
                      ? `${(r.time_to_detect_ms / 1000).toFixed(1)}s`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <OutcomeBadge outcome={r.outcome} />
                    {r.notes && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-xs">{r.notes}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => delMut.mutate(r.id)}
                      aria-label="Delete run"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-medium tabular-nums">{value}</div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const map: Record<Outcome, string> = {
    success: "bg-emerald-500/15 text-emerald-500",
    partial: "bg-amber-500/15 text-amber-500",
    fail: "bg-destructive/15 text-destructive",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${map[outcome]}`}>{outcome}</span>;
}

function OutcomeBtn({
  tone,
  children,
  onClick,
  disabled,
}: {
  tone: Outcome;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const map: Record<Outcome, string> = {
    success: "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10",
    partial: "border-amber-500/40 text-amber-500 hover:bg-amber-500/10",
    fail: "border-destructive/40 text-destructive hover:bg-destructive/10",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm disabled:opacity-50 ${map[tone]}`}
    >
      {children}
    </button>
  );
}
