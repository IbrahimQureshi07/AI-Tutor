import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { maybeBootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Keep bootstrap behavior active for first trusted admin login.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await maybeBootstrapAdmin(supabase, user);
  }

  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    if (guard.reason === "unauthorized") {
      redirect("/login?redirectTo=/admin");
    }
    redirect("/dashboard");
  }

  return <>{children}</>;
}

