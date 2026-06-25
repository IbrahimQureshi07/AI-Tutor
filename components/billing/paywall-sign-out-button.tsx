"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function PaywallSignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
