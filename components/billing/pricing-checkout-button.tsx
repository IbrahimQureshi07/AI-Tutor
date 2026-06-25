"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

export function PricingCheckoutButton({ priceUsd }: { priceUsd: number }) {
  const [loading, setLoading] = React.useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        url?: string;
      };

      if (json.url) {
        window.location.href = json.url;
        return;
      }

      if (json.error === "payments_not_configured") {
        toast.info(
          json.message ??
            `Checkout is not live yet. Contact your coordinator to enroll ($${priceUsd} one-time).`,
        );
        return;
      }

      toast.error(json.message ?? json.error ?? "Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      disabled={loading}
      onClick={() => void handleCheckout()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Lock className="h-4 w-4" />
      )}
      Unlock full course — ${priceUsd}
    </Button>
  );
}
