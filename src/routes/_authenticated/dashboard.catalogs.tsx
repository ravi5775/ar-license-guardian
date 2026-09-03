import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Package, Plus, Link as LinkIcon, QrCode, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { QueryState } from "@/components/QueryState";
import { MediaUploader } from "@/components/MediaUploader";
import {
  listCatalogs,
  createCatalog,
  updateCatalog,
  deleteCatalog,
  saveCatalogItem,
  deleteCatalogItem,
  listMyCatalogItems,
  signCatalogUpload,
} from "@/lib/catalog.functions";

export const Route = createFileRoute("/_authenticated/dashboard/catalogs")({
  component: CatalogManagerPage,
});

type CatalogDraft = {
  id?: string;
  name: string;
  slug: string;
  is_active: boolean;
};

type ItemDraft = {
  id?: string;
  catalog_id: string;
  name: string;
  sku: string;
  category: "furniture" | "paint" | "flooring";
  glb_path: string;
  usdz_path: string;
  thumb_path: string;
  width_m: number;
  height_m: number;
  depth_m: number;
  color_hex: string;
  placement: "floor" | "wall";
  sort_order: number;
  is_active: boolean;
};

const emptyCatalog: CatalogDraft = { name: "", slug: "", is_active: true };
const emptyItem = (catalogId: string): ItemDraft => ({
  catalog_id: catalogId,
  name: "",
  sku: "",
  category: "furniture",
  glb_path: "",
  usdz_path: "",
  thumb_path: "",
  width_m: 1,
  height_m: 1,
  depth_m: 0.4,
  color_hex: "#d9b06d",
  placement: "floor",
  sort_order: 0,
  is_active: true,
});

function CatalogManagerPage() {
  const queryClient = useQueryClient();
  const listCatalogsFn = useServerFn(listCatalogs);
  const createCatalogFn = useServerFn(createCatalog);
  const updateCatalogFn = useServerFn(updateCatalog);
  const deleteCatalogFn = useServerFn(deleteCatalog);
  const saveItemFn = useServerFn(saveCatalogItem);
  const deleteItemFn = useServerFn(deleteCatalogItem);
  const listMyCatalogItemsFn = useServerFn(listMyCatalogItems);

  const [catalogDraft, setCatalogDraft] = useState<CatalogDraft | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => listCatalogsFn(),
    staleTime: 30_000,
  });

  const selectedCatalog = useMemo(
    () =>
      ((catalogQuery.data ?? []) as any[]).find(
        (catalog: any) => catalog.id === selectedCatalogId,
      ) ?? null,
    [catalogQuery.data, selectedCatalogId],
  );

  const itemsQuery = useQuery({
    queryKey: ["catalog-items", selectedCatalogId],
    queryFn: () =>
      selectedCatalogId
        ? listMyCatalogItemsFn({ data: { catalogId: selectedCatalogId } })
        : Promise.resolve([]),
    enabled: !!selectedCatalogId && !!selectedCatalog?.slug,
    staleTime: 30_000,
  });

  const saveCatalogMutation = useMutation({
    mutationFn: async (draft: CatalogDraft) => {
      if (draft.id) return updateCatalogFn({ data: draft });
      return createCatalogFn({ data: draft });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catalogs"] });
      toast.success("Catalog saved");
      setCatalogDraft(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not save catalog"),
  });

  const deleteCatalogMutation = useMutation({
    mutationFn: (id: string) => deleteCatalogFn({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catalogs"] });
      setSelectedCatalogId(null);
      setItemDraft(null);
      toast.success("Catalog deleted");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not delete catalog"),
  });

  const saveItemMutation = useMutation({
    mutationFn: (draft: ItemDraft) => saveItemFn({ data: draft }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catalog-items", selectedCatalogId] });
      setItemDraft(null);
      toast.success("Catalog item saved");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not save item"),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteItemFn({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catalog-items", selectedCatalogId] });
      toast.success("Item removed");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not delete item"),
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif italic">Room catalogs</h1>
          <p className="text-sm text-muted-foreground">
            Build a public room-viewing catalog for furniture, paint, and flooring.
          </p>
        </div>
        <button
          onClick={() => setCatalogDraft({ ...emptyCatalog })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New catalog
        </button>
      </div>

      <QueryState
        isLoading={catalogQuery.isLoading}
        error={catalogQuery.error}
        onRetry={() => catalogQuery.refetch()}
        label="catalogs"
      />

      {catalogQuery.data && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            {catalogQuery.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                No catalogs yet.
              </div>
            ) : (
              (catalogQuery.data as any[]).map((catalog: any) => (
                <button
                  key={catalog.id}
                  type="button"
                  onClick={() => setSelectedCatalogId(catalog.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedCatalogId === catalog.id
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 bg-card/40 hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{catalog.name}</div>
                      <div className="text-xs text-muted-foreground">/room/{catalog.slug}</div>
                    </div>
                    <span className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide">
                      {catalog.is_active ? "Active" : "Draft"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCatalogDraft({
                          id: catalog.id,
                          name: catalog.name,
                          slug: catalog.slug,
                          is_active: catalog.is_active,
                        });
                      }}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${catalog.name}"?`))
                          deleteCatalogMutation.mutate(catalog.id);
                      }}
                      className="rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="space-y-5">
            {selectedCatalog ? (
              <>
                <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-medium">{selectedCatalog.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        Share link: /room/{selectedCatalog.slug}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/room/${selectedCatalog.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                      >
                        <LinkIcon className="h-3.5 w-3.5" /> Open
                      </a>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                      >
                        <QrCode className="h-3.5 w-3.5" /> QR
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-base font-medium">Catalog items</h3>
                    <button
                      type="button"
                      onClick={() => setItemDraft(emptyItem(selectedCatalog.id))}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add item
                    </button>
                  </div>

                  <QueryState
                    isLoading={itemsQuery.isLoading}
                    error={itemsQuery.error}
                    onRetry={() => itemsQuery.refetch()}
                    label="catalog-items"
                  />

                  {itemsQuery.data && itemsQuery.data.length === 0 && (
                    <p className="text-sm text-muted-foreground">No assets in this catalog yet.</p>
                  )}

                  <div className="space-y-3">
                    {(itemsQuery.data ?? []).map((item: any) => (
                      <div
                        key={item.id}
                        data-testid="catalog-item-row"
                        data-active={item.is_active ? "true" : "false"}
                        className="rounded-xl border border-border/60 bg-background/60 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.category} · {item.placement}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              data-testid={`edit-item-${item.id}`}
                              onClick={() =>
                                setItemDraft({
                                  id: item.id,
                                  catalog_id: item.catalog_id,
                                  name: item.name,
                                  sku: item.sku,
                                  category: item.category,
                                  glb_path: item.glb_path,
                                  usdz_path: item.usdz_path,
                                  thumb_path: item.thumb_path ?? "",
                                  width_m: Number(item.width_m ?? 1),
                                  height_m: Number(item.height_m ?? 1),
                                  depth_m: Number(item.depth_m ?? 0.4),
                                  color_hex: item.color_hex ?? "#d9b06d",
                                  placement: item.placement,
                                  sort_order: Number(item.sort_order ?? 0),
                                  is_active: item.is_active,
                                })
                              }
                              className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              data-testid="toggle-active-inactive-item"
                              onClick={() =>
                                saveItemMutation.mutate({
                                  id: item.id,
                                  catalog_id: item.catalog_id,
                                  name: item.name,
                                  sku: item.sku,
                                  category: item.category,
                                  glb_path: item.glb_path,
                                  usdz_path: item.usdz_path,
                                  thumb_path: item.thumb_path ?? "",
                                  width_m: Number(item.width_m ?? 1),
                                  height_m: Number(item.height_m ?? 1),
                                  depth_m: Number(item.depth_m ?? 0.4),
                                  color_hex: item.color_hex ?? "#d9b06d",
                                  placement: item.placement,
                                  sort_order: Number(item.sort_order ?? 0),
                                  is_active: !item.is_active,
                                })
                              }
                              className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                            >
                              {item.is_active ? "Deactivate" : "Reactivate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Remove "${item.name}" from the catalog?`))
                                  deleteItemMutation.mutate(item.id);
                              }}
                              className="rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-sm text-muted-foreground">
                <Package className="mx-auto mb-3 h-6 w-6 opacity-70" />
                Select a catalog to manage room items.
              </div>
            )}
          </div>
        </div>
      )}

      {catalogDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="text-xl font-serif italic mb-4">
              {catalogDraft.id ? "Edit catalog" : "New catalog"}
            </h3>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Name</span>
                <input
                  value={catalogDraft.name}
                  onChange={(e) => setCatalogDraft({ ...catalogDraft, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Slug</span>
                <input
                  value={catalogDraft.slug}
                  onChange={(e) => setCatalogDraft({ ...catalogDraft, slug: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={catalogDraft.is_active}
                  onChange={(e) =>
                    setCatalogDraft({ ...catalogDraft, is_active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCatalogDraft(null)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!catalogDraft.name.trim()) return toast.error("Catalog name is required");
                  saveCatalogMutation.mutate(catalogDraft);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {itemDraft && selectedCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="text-xl font-serif italic mb-4">
              {itemDraft.id ? "Edit item" : "New catalog item"}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block text-muted-foreground">Name</span>
                <input
                  data-testid="item-name"
                  value={itemDraft.name}
                  onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">SKU</span>
                <input
                  value={itemDraft.sku}
                  onChange={(e) => setItemDraft({ ...itemDraft, sku: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Category</span>
                <select
                  value={itemDraft.category}
                  onChange={(e) =>
                    setItemDraft({
                      ...itemDraft,
                      category: e.target.value as "furniture" | "paint" | "flooring",
                    })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="furniture">Furniture</option>
                  <option value="paint">Paint</option>
                  <option value="flooring">Flooring</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Placement</span>
                <select
                  value={itemDraft.placement}
                  onChange={(e) =>
                    setItemDraft({
                      ...itemDraft,
                      placement: e.target.value as "floor" | "wall",
                    })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="floor">Floor</option>
                  <option value="wall">Wall</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Width (m)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={itemDraft.width_m}
                  onChange={(e) => setItemDraft({ ...itemDraft, width_m: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Height (m)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={itemDraft.height_m}
                  onChange={(e) => setItemDraft({ ...itemDraft, height_m: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Depth (m)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={itemDraft.depth_m}
                  onChange={(e) => setItemDraft({ ...itemDraft, depth_m: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Color hex</span>
                <input
                  value={itemDraft.color_hex}
                  onChange={(e) => setItemDraft({ ...itemDraft, color_hex: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <div className="md:col-span-2">
                <MediaUploader
                  label="GLB model"
                  accept=".glb,.gltf,model/gltf-binary,application/octet-stream"
                  currentPath={itemDraft.glb_path || null}
                  prefix={`catalogs/${selectedCatalog.slug}`}
                  onUploaded={(path) => setItemDraft({ ...itemDraft, glb_path: path })}
                />
              </div>
              <div className="md:col-span-2">
                <MediaUploader
                  label="USDZ model"
                  accept=".usdz,application/octet-stream"
                  currentPath={itemDraft.usdz_path || null}
                  prefix={`catalogs/${selectedCatalog.slug}`}
                  onUploaded={(path) => setItemDraft({ ...itemDraft, usdz_path: path })}
                />
              </div>
              <div className="md:col-span-2">
                <MediaUploader
                  label="Thumbnail"
                  accept="image/*"
                  currentPath={itemDraft.thumb_path || null}
                  prefix={`catalogs/${selectedCatalog.slug}/thumbs`}
                  onUploaded={(path) => setItemDraft({ ...itemDraft, thumb_path: path })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemDraft(null)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="save-item"
                onClick={() => {
                  if (!itemDraft.name.trim() || !itemDraft.glb_path || !itemDraft.usdz_path) {
                    toast.error("Name, GLB, and USDZ are required");
                    return;
                  }
                  saveItemMutation.mutate({ ...itemDraft, catalog_id: selectedCatalog.id });
                }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                <Save className="h-4 w-4" /> Save item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
