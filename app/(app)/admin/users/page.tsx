"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { UserPlus } from "lucide-react";

type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "student" | "admin";
  isActive: boolean;
  createdAt: string | null;
};

type CreateFormState = {
  fullName: string;
  email: string;
  password: string;
  role: "student" | "admin";
};

const EMPTY_CREATE: CreateFormState = {
  fullName: "",
  email: "",
  password: "",
  role: "student",
};

type Filter = "all" | "students" | "admins" | "active" | "inactive";

export default function AdminUsersPage() {
  const [rows, setRows] = React.useState<AdminUserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createForm, setCreateForm] = React.useState(EMPTY_CREATE);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Could not load users.");
        return;
      }
      setRows((json.users ?? []) as AdminUserRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.fullName ?? ""} ${r.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "students":
          return r.role === "student";
        case "admins":
          return r.role === "admin";
        case "active":
          return r.isActive;
        case "inactive":
          return !r.isActive;
        default:
          return true;
      }
    });
  }, [rows, query, filter]);

  async function patchUser(userId: string, patch: Partial<Pick<AdminUserRow, "role" | "isActive">>) {
    setSavingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          role: patch.role,
          isActive: patch.isActive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Could not save user.");
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, ...patch } as AdminUserRow : r)),
      );
      toast.success("User updated.");
    } finally {
      setSavingId(null);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: createForm.email.trim(),
          password: createForm.password,
          fullName: createForm.fullName.trim() || undefined,
          role: createForm.role,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Could not create user.");
        return;
      }
      const created = json.user as AdminUserRow | undefined;
      if (created) {
        setRows((prev) => [created, ...prev]);
      } else {
        await load();
      }
      toast.success("User created. Share the password with them securely.");
      setCreateForm(EMPTY_CREATE);
      setShowAdd(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Users</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Add accounts, change roles, or deactivate access.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowAdd((v) => !v)}
        >
          <UserPlus className="h-4 w-4" />
          {showAdd ? "Close form" : "Add user"}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Add user</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ink-muted mb-4 leading-relaxed">
              Creates a login with the password you set here. Share email and
              password with the person directly — no invite email is sent.
            </p>
            <form onSubmit={createUser} className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-fullName">Full name (optional)</Label>
                <Input
                  id="add-fullName"
                  value={createForm.fullName}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  placeholder="Jane Appleseed"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="user@example.com"
                  required
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-password">Password</Label>
                <Input
                  id="add-password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-role">Role</Label>
                <select
                  id="add-role"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      role: e.target.value as "student" | "admin",
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="student">student</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create user"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAdd(false);
                    setCreateForm(EMPTY_CREATE);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>All users</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="h-9 max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["students", "Students"],
                  ["admins", "Admins"],
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                ] as [Filter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    filter === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-ink-muted hover:bg-elevated",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-ink-muted">Loading users…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {rows.length === 0 ? "No users found." : "No matching users."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-border p-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_140px_130px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">
                      {u.fullName || "Unnamed user"}
                    </p>
                    <p className="text-xs text-ink-muted truncate">{u.email ?? "—"}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-ink-muted">Role</label>
                    <select
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={(e) =>
                        void patchUser(u.id, {
                          role: e.target.value as "student" | "admin",
                        })
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="student">student</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={u.isActive ? "success" : "outline"}>
                      {u.isActive ? "active" : "inactive"}
                    </Badge>
                  </div>

                  <div className="flex justify-start md:justify-end">
                    <Button
                      variant={u.isActive ? "outline" : "soft"}
                      size="sm"
                      disabled={savingId === u.id}
                      onClick={() => void patchUser(u.id, { isActive: !u.isActive })}
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
