import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";

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
          <BrandLogo href="/" size="sm" />
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
