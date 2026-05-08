"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "student" | "admin";
  isActive: boolean;
  createdAt: string | null;
};

export default function AdminUsersPage() {
  const [rows, setRows] = React.useState<AdminUserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Users</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Manage access, role, and account status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-ink-muted">Loading users…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-ink-muted">No users found.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((u) => (
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

