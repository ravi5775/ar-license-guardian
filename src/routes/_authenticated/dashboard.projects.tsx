import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FolderPlus, Folder, Images, Boxes, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { QueryState } from "@/components/QueryState";
import {
  assignToProject,
  createProject,
  deleteProject,
  listProjects,
  renameProject,
} from "@/lib/projects.functions";

export const Route = createFileRoute("/_authenticated/dashboard/projects")({
  component: ProjectsPage,
  head: () => ({
    meta: [
      { title: "Projects — Aether AR Dashboard" },
      {
        name: "description",
        content:
          "Group AR albums and experiences into client projects so every event stays organised and separate.",
      },
    ],
  }),
});

type Item = {
  id: string;
  title: string;
  slug: string | null;
  project_id: string | null;
  published: boolean;
};

function ProjectsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listProjects);
  const create = useServerFn(createProject);
  const rename = useServerFn(renameProject);
  const remove = useServerFn(deleteProject);
  const assign = useServerFn(assignToProject);

  const [name, setName] = useState("");

  const query = useQuery({
    queryKey: ["projects"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["albums"] });
    qc.invalidateQueries({ queryKey: ["experiences"] });
  };

  const createMut = useMutation({
    mutationFn: (n: string) => create({ data: { name: n } }),
    onSuccess: () => {
      setName("");
      toast.success("Project created");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create project"),
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: string; name: string }) => rename({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? "Rename failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Project removed — its content is now unfiled");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const assignMut = useMutation({
    mutationFn: (v: {
      kind: "album" | "experience";
      id: string;
      project_id: string | null;
    }) => assign({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? "Could not move item"),
  });

  const projects = query.data?.projects ?? [];
  const albums = (query.data?.albums ?? []) as Item[];
  const experiences = (query.data?.experiences ?? []) as Item[];

  const picker = (kind: "album" | "experience", item: Item) => (
    <select
      value={item.project_id ?? ""}
      onChange={(e) =>
        assignMut.mutate({
          kind,
          id: item.id,
          project_id: e.target.value || null,
        })
      }
      className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
    >
      <option value="">Unfiled</option>
      {projects.map((p: any) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );

  const row = (kind: "album" | "experience", item: Item) => (
    <li
      key={item.id}
      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/30 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        {kind === "album" ? (
          <Images className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-sm">{item.title}</span>
        {!item.published && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            draft
          </span>
        )}
      </div>
      {picker(kind, item)}
    </li>
  );

  return (
    <div className="p-6 md:p-8 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif italic">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Folders for your clients — keep each wedding, event or brand
            campaign separate. Content stays private to your account.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createMut.mutate(name.trim());
          }}
          className="flex items-center gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sharma Wedding"
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            <FolderPlus className="h-4 w-4" /> New project
          </button>
        </form>
      </header>

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      >
        <div className="space-y-6">
          {projects.map((p: any) => {
            const pa = albums.filter((a) => a.project_id === p.id);
            const pe = experiences.filter((x) => x.project_id === p.id);
            return (
              <section
                key={p.id}
                className="rounded-xl border border-border/60 bg-card/20 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-medium">{p.name}</h2>
                    <span className="text-xs text-muted-foreground">
                      {pa.length} album{pa.length === 1 ? "" : "s"} ·{" "}
                      {pe.length} experience{pe.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const next = window.prompt("Rename project", p.name);
                        if (next?.trim())
                          renameMut.mutate({ id: p.id, name: next.trim() });
                      }}
                      className="rounded-md p-2 text-muted-foreground hover:bg-accent"
                      aria-label="Rename project"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            "Remove this project? Albums and experiences inside it are kept and become unfiled.",
                          )
                        )
                          deleteMut.mutate(p.id);
                      }}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {pa.length + pe.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing filed here yet — use the dropdowns below to move
                    albums or experiences into this project.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {pa.map((a) => row("album", a))}
                    {pe.map((x) => row("experience", x))}
                  </ul>
                )}
              </section>
            );
          })}

          <section className="rounded-xl border border-dashed border-border/60 p-4">
            <h2 className="mb-3 text-base font-medium">Unfiled</h2>
            {albums.filter((a) => !a.project_id).length +
              experiences.filter((x) => !x.project_id).length ===
            0 ? (
              <p className="text-xs text-muted-foreground">
                Everything is filed.{" "}
                <Link to="/dashboard/albums" className="underline">
                  Go to albums
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {albums.filter((a) => !a.project_id).map((a) => row("album", a))}
                {experiences
                  .filter((x) => !x.project_id)
                  .map((x) => row("experience", x))}
              </ul>
            )}
          </section>
        </div>
      </QueryState>
    </div>
  );
}
