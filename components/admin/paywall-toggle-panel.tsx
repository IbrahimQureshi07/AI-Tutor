"use client";

import * as React from "react";
import { toast } from "sonner";
import { Lock, LockOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type PaywallStatus = {
  enabled: boolean;
  settingsTableReady: boolean;
  envOverride: boolean | null;
  dbValue: boolean | null;
};

export function PaywallTogglePanel() {
  const [status, setStatus] = React.useState<PaywallStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/paywall", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Could not load paywall setting.");
        return;
      }
      setStatus(json as PaywallStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onToggle(next: boolean) {
    if (!status || busy) return;
    if (status.envOverride !== null) {
      toast.error(
        "PAYWALL_ENABLED is set in environment variables and locks this switch. Unset it on Vercel to use the toggle.",
      );
      return;
    }

    setBusy(true);
    const prev = status;
    setStatus({ ...status, enabled: next });
    try {
      const res = await fetch("/api/admin/paywall", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(prev);
        toast.error(json.error ?? "Could not update paywall.");
        return;
      }
      setStatus(json as PaywallStatus);
      toast.success(
        next
          ? "Paywall on — unpaid students will see the unlock screen."
          : "Paywall off — students go straight to the app after login.",
      );
    } catch {
      setStatus(prev);
      toast.error("Could not update paywall.");
    } finally {
      setBusy(false);
    }
  }

  const lockedByEnv = status?.envOverride !== null;
  const switchChecked = status?.enabled ?? true;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {switchChecked ? (
                <Lock className="h-4 w-4 text-primary" />
              ) : (
                <LockOpen className="h-4 w-4 text-success" />
              )}
              Course paywall
            </CardTitle>
            <p className="text-xs text-ink-muted mt-1 max-w-xl">
              When off, new and unpaid students skip the $299 unlock screen and
              enter the app after signup/login. Turn back on anytime — per-student
              grant/revoke still works when the paywall is on. Nothing is deleted.
            </p>
          </div>
          {status && (
            <Badge variant={switchChecked ? "warn" : "success"} className="text-[10px]">
              {switchChecked ? "Paywall on" : "Paywall off"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading || !status ? (
          <p className="text-sm text-ink-muted">Loading paywall setting…</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-elevated/30 px-4 py-3">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="paywall-enabled" className="text-sm font-medium text-ink">
                  Require course unlock before studying
                </Label>
                <p className="text-xs text-ink-muted">
                  {switchChecked
                    ? "Unpaid students are sent to /unlock until granted or paid."
                    : "All active student accounts can use the full app."}
                </p>
              </div>
              <Switch
                id="paywall-enabled"
                checked={switchChecked}
                disabled={busy || lockedByEnv || !status.settingsTableReady}
                onCheckedChange={onToggle}
                aria-label="Toggle course paywall"
              />
            </div>

            {!status.settingsTableReady && (
              <p className="text-xs text-warn">
                Settings table not found yet. Run{" "}
                <code className="text-[11px]">0007_app_settings.sql</code> in
                Supabase to enable this switch, or set{" "}
                <code className="text-[11px]">PAYWALL_ENABLED=false</code> on
                Vercel for an immediate off.
              </p>
            )}

            {lockedByEnv && (
              <p className="text-xs text-warn">
                Locked by env{" "}
                <code className="text-[11px]">
                  PAYWALL_ENABLED={status.envOverride ? "true" : "false"}
                </code>
                . Remove that variable on Vercel to control this from admin.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
