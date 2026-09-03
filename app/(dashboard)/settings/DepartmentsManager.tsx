"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Card, Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

type DepartmentRow = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  usage: {
    vacancies: number;
    applications: number;
    positionSlots: number;
    users: number;
    budgets: number;
  };
};

/**
 * Settings → Dept/Project management table.
 *
 * Full CRUD over the `departments` master list:
 *  - Create: POST /api/departments
 *  - Rename: PATCH /api/departments/[id]
 *  - Delete: DELETE /api/departments/[id] (soft-delete; blocked with usage
 *    info when the dept is still referenced by vacancies/users unless forced)
 *
 * Every dropdown in the app (candidate edit, vacancies, users, requisitions)
 * reads from the same table, so changes here propagate app-wide instantly.
 */
export function DepartmentsManager() {
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Inline "add" row
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline rename state: id of the row being edited + its draft value
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation: the row pending deletion (with usage shown)
  const [confirmDelete, setConfirmDelete] = useState<DepartmentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/departments?withUsage=1", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDepartments(data.departments ?? []);
    } catch {
      showToast("Failed to load departments", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      showToast("Enter a department/project name", "error");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add");
      showToast(
        data.created ? `Added "${name}"` : `"${name}" already exists`,
        "success",
      );
      setNewName("");
      await load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add",
        "error",
      );
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (row: DepartmentRow) => {
    setEditingId(row.id);
    setEditDraft(row.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = editDraft.trim();
    if (!name) {
      showToast("Name cannot be empty", "error");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/departments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to rename");
      showToast("Department renamed", "success");
      cancelEdit();
      await load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to rename",
        "error",
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (row: DepartmentRow, force: boolean) => {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/departments/${row.id}${force ? "?force=1" : ""}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.usage) {
        // Blocked because vacancies/users still reference it — surface the
        // counts and let the user decide whether to hide it anyway.
        setConfirmDelete({ ...row, usage: data.usage });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      showToast(`Deleted "${row.name}"`, "success");
      setConfirmDelete(null);
      await load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-slate-900">
            Dept/Project
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage the master list of departments & projects used across
            candidates, vacancies, and users
          </p>
        </div>
      </div>

      {/* Add + search */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !adding) handleAdd();
              }}
              placeholder="New department/project name…"
              className={`${inputClass} pl-9`}
              disabled={adding}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
          >
            {adding ? "Adding…" : "Add"}
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search departments…"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <th className="text-left font-medium px-6 py-3">Name</th>
                <th className="text-left font-medium px-6 py-3">Vacancies</th>
                <th className="text-left font-medium px-6 py-3">Applications</th>
                <th className="text-left font-medium px-6 py-3">Users</th>
                <th className="text-right font-medium px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                    Loading departments…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                    {departments.length === 0
                      ? "No departments yet. Add one above to get started."
                      : "No departments match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !savingEdit) handleSaveEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                              className={inputClass}
                              disabled={savingEdit}
                            />
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={savingEdit}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[#006b5f] hover:bg-[#e6f5f3] transition-colors"
                              aria-label="Save name"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={savingEdit}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                              aria-label="Cancel rename"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900">
                            {row.name}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {row.usage.vacancies}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {row.usage.applications}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {row.usage.users}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={isEditing}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
                            aria-label={`Rename ${row.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(row)}
                            disabled={isEditing}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-40"
                            aria-label={`Delete ${row.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-500" />
              <div>
                <h3 className="font-heading text-base font-semibold text-slate-900">
                  Delete “{confirmDelete.name}”?
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  The department will be removed from all dropdowns. Existing
                  records keep their historical data.
                </p>
              </div>
            </div>

            {(confirmDelete.usage.vacancies > 0 ||
              confirmDelete.usage.users > 0) && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">This department is still in use:</p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  {confirmDelete.usage.vacancies > 0 && (
                    <li>{confirmDelete.usage.vacancies} vacancy(ies)</li>
                  )}
                  {confirmDelete.usage.users > 0 && (
                    <li>{confirmDelete.usage.users} user(s)</li>
                  )}
                </ul>
                <p className="mt-1.5 text-xs">
                  Deleting anyway will hide it from dropdowns, but those
                  records will keep pointing at it.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="md"
                onClick={() => handleDelete(confirmDelete, true)}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
