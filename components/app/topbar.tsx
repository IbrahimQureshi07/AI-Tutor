"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, LogOut, User, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import { createClient } from "@/lib/supabase/client";

export function Topbar({
  userEmail,
  fullName,
  showAdmin = false,
}: {
  userEmail: string | null;
  fullName: string | null;
  showAdmin?: boolean;
}) {
  const router = useRouter();
  const { open } = useChatSheet();
  const { theme, setTheme } = useTheme();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const initials = (fullName || userEmail || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/60">
      <div className="h-16 px-5 md:px-8 flex items-center justify-between gap-4">
        <div className="flex-1" />
        <Button
          variant="soft"
          size="sm"
          className="rounded-full gap-2"
          onClick={() => open()}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask AI
          <span className="hidden sm:inline-flex ml-1 items-center gap-0.5 text-[10px] text-ink-muted">
            <kbd className="rounded bg-background/60 px-1 py-px border border-border">⌘</kbd>
            <kbd className="rounded bg-background/60 px-1 py-px border border-border">K</kbd>
          </span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="focus-ring rounded-full">
              <Avatar>
                <AvatarImage src="" alt="" />
                <AvatarFallback>{initials || "U"}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium text-ink">{fullName || "You"}</span>
                <span className="text-xs text-ink-muted">{userEmail}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {showAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin">Admin Console</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="h-4 w-4" /> Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-danger">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
