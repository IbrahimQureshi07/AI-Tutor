import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileNav } from "@/components/app/mobile-nav";
import { ChatSheetProvider } from "@/components/chat/chat-sheet-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAppShell } from "@/lib/auth/request-session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const shell = await getAppShell();
  if (!shell) redirect("/login");

  const { user, profile, showAdmin } = shell;

  return (
    <TooltipProvider delayDuration={300}>
      <ChatSheetProvider>
        <div className="flex min-h-screen bg-background bg-paper">
          <Sidebar showAdmin={showAdmin} />
          <div className="flex-1 min-w-0 flex flex-col">
            <Topbar
              userEmail={user.email ?? null}
              fullName={profile?.full_name ?? null}
              showAdmin={showAdmin}
            />
            <main className="flex-1 px-5 md:px-8 py-6 md:py-10 pb-24 lg:pb-10 max-w-6xl w-full mx-auto animate-fade-in">
              {children}
            </main>
          </div>
          <MobileNav showAdmin={showAdmin} />
        </div>
      </ChatSheetProvider>
    </TooltipProvider>
  );
}
