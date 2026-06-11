import Link from "next/link";
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

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border bg-surface p-3 h-fit lg:sticky lg:top-20">
        <div className="px-2 py-1 text-xs uppercase tracking-wider text-ink-muted">
          Admin
        </div>
        <nav className="mt-2 space-y-1">
          <Link
            href="/admin"
            className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-elevated"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/students"
            className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-elevated"
          >
            Students
          </Link>
          <Link
            href="/admin/users"
            className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-elevated"
          >
            Users
          </Link>
          <Link
            href="/admin/questions"
            className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-elevated"
          >
            Questions
          </Link>
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  );
}

