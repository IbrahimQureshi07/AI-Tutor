import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileNav } from "@/components/app/mobile-nav";
import { ChatSheetProvider } from "@/components/chat/chat-sheet-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { maybeBootstrapAdmin } from "@/lib/auth/bootstrap-admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  await maybeBootstrapAdmin(supabase, user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <TooltipProvider delayDuration={300}>
      <ChatSheetProvider>
        <div className="flex min-h-screen bg-background bg-paper">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <Topbar
              userEmail={user.email ?? null}
              fullName={profile?.full_name ?? null}
            />
            <main className="flex-1 px-5 md:px-8 py-6 md:py-10 pb-24 lg:pb-10 max-w-6xl w-full mx-auto animate-fade-in">
              {children}
            </main>
          </div>
          <MobileNav />
        </div>
      </ChatSheetProvider>
    </TooltipProvider>
  );
}
