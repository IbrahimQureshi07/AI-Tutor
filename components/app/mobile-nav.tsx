"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Brain,
  Timer,
  MessageSquare,
  Trophy,
  ShieldCheck,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/practice", icon: Brain, label: "Practice" },
  { href: "/mock-exam", icon: Timer, label: "Mock" },
  { href: "/final-test", icon: Trophy, label: "Final" },
  { href: "/chat", icon: MessageSquare, label: "Tutor" },
];

export function MobileNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  const nav = showAdmin
    ? [...NAV, { href: "/admin", icon: ShieldCheck, label: "Admin" }]
    : NAV;
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl">
      <div className={cn("grid", showAdmin ? "grid-cols-6" : "grid-cols-5")}>
        {nav.map((n) => {
          const active =
            pathname === n.href ||
            (n.href !== "/dashboard" && pathname.startsWith(n.href));
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] uppercase tracking-widest",
                active ? "text-primary" : "text-ink-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
