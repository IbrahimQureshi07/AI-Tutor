import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PaywallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/unlock");

  return (
    <div className="min-h-screen bg-background bg-paper">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-7 w-7 rounded-full bg-primary/15 grid place-items-center">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            </div>
            <span className="font-serif text-base font-semibold tracking-tight">
              Tutor<span className="text-primary">.sc</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/pricing"
              className="text-ink-muted hover:text-ink transition-colors hidden sm:inline"
            >
              Full pricing details
            </Link>
            <span className="text-ink-muted truncate max-w-[160px] sm:max-w-xs">
              {user.email}
            </span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
