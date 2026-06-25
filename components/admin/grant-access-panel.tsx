"use client";

import * as React from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccessStatus, PaymentProvider } from "@/lib/access/types";

export type StudentAccessInfo = {
  migrationApplied: boolean;
  status: AccessStatus;
  hasFullAccess: boolean;
  paidAt: string | null;
  paymentProvider: PaymentProvider | null;
};

const STATUS_LABELS: Record<AccessStatus, string> = {
  none: "Unpaid",
  demo_completed: "Demo used",
  active: "Course access",
  expired: "Expired",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusVariant(
  status: AccessStatus,
  hasFullAccess: boolean,
): "success" | "warn" | "outline" | "secondary" {
  if (hasFullAccess) return "success";
  if (status === "demo_completed") return "warn";
  if (status === "expired") return "secondary";
  return "outline";
}

export function GrantAccessPanel({
  studentId,
  studentRole,
  access,
  onUpdated,
}: {
  studentId: string;
  studentRole: "student" | "admin";
  access: StudentAccessInfo;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = React.useState<"grant" | "revoke" | null>(null);

  async function mutate(action: "grant" | "revoke") {
    const label = action === "grant" ? "grant course access" : "revoke course access";
    if (
      !window.confirm(
        action === "grant"
          ? "Grant full course access for this student? Use after offline payment is confirmed."
          : "Revoke course access? The student will be sent to the paywall on next visit.",
      )
    ) {
      return;
    }

    setBusy(action);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? `Could not ${label}.`);
        return;
      }
      toast.success(
        action === "grant" ? "Course access granted." : "Course access revoked.",
      );
      onUpdated();
    } catch {
      toast.error(`Could not ${label}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Course access
        </CardTitle>
        <p className="text-xs text-ink-muted leading-relaxed">
          Grant access after offline payment. Requires billing migration{" "}
          <code className="text-[10px]">0006_access_billing.sql</code> on Supabase.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {studentRole === "admin" ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-elevated/50 px-4 py-3 text-sm text-ink-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            Admin accounts always have full access — no grant needed.
          </div>
        ) : !access.migrationApplied ? (
          <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-muted leading-relaxed">
            Billing columns are not on Supabase yet. Everyone still has full access
            until migration <strong>0006</strong> runs. Grant/revoke will work after
            that.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(access.status, access.hasFullAccess)}>
                {access.hasFullAccess
                  ? STATUS_LABELS.active
                  : STATUS_LABELS[access.status]}
              </Badge>
              {access.paymentProvider && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  via {access.paymentProvider}
                </Badge>
              )}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted uppercase tracking-wide">
                  Paid / granted at
                </dt>
                <dd className="mt-0.5 text-ink">{fmtDateTime(access.paidAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted uppercase tracking-wide">
                  Status
                </dt>
                <dd className="mt-0.5 text-ink capitalize">
                  {access.status.replace("_", " ")}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              {access.hasFullAccess ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => mutate("revoke")}
                >
                  {busy === "revoke" ? "Revoking…" : "Revoke access"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => mutate("grant")}
                >
                  {busy === "grant" ? "Granting…" : "Grant course access"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
