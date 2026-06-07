import { useState } from "react";
import { useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Tag, X } from "lucide-react";

function CategoryForm({ initial, onSubmit, onClose, loading }: any) {
  const [form, setForm] = useState({ name: initial?.name || "", description: initial?.description || "" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">{initial ? "Edit Kategori" : "Tambah Kategori"}</h2>
          <button onClick={onClose}><X size={20} className="text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Kategori *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Batal</button>
          <button onClick={() => onSubmit(form)} disabled={loading || !form.name}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const qc = useQueryClient();
  const { data: categories, isLoading } = useListCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Kategori</h1>
          <p className="text-muted-foreground text-sm">{(categories || []).length} kategori</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90">
          <Plus size={16} /> Tambah Kategori
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading && [1,2,3].map(i => <div key={i} className="h-24 bg-card border border-card-border rounded-xl animate-pulse" />)}
        {!isLoading && (categories || []).length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            <Tag size={36} className="mx-auto mb-3 opacity-30" />
            <div>Belum ada kategori</div>
          </div>
        )}
        {(categories || []).map(c => (
          <div key={c.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm group hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Tag size={18} className="text-accent-foreground" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditCat(c)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                <button onClick={() => { if (confirm("Hapus kategori?")) deleteCategory.mutate({ id: c.id }, { onSuccess: invalidate }); }}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="font-semibold text-foreground">{c.name}</div>
            {c.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</div>}
          </div>
        ))}
      </div>

      {showForm && <CategoryForm onSubmit={(form: any) => createCategory.mutate({ data: form }, { onSuccess: () => { setShowForm(false); invalidate(); } })} onClose={() => setShowForm(false)} loading={createCategory.isPending} />}
      {editCat && <CategoryForm initial={editCat} onSubmit={(form: any) => updateCategory.mutate({ id: editCat.id, data: form }, { onSuccess: () => { setEditCat(null); invalidate(); } })} onClose={() => setEditCat(null)} loading={updateCategory.isPending} />}
    </div>
  );
}
