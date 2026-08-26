"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Target,
  Brain,
  ListTodo,
  Timer,
  Trophy,
  MessageSquare,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/assessment", icon: Target, label: "Assessment" },
  { href: "/practice", icon: Brain, label: "Practice" },
  { href: "/mistakes", icon: ListTodo, label: "Mistakes" },
  { href: "/mock-exam", icon: Timer, label: "Mock Exam" },
  { href: "/final-test", icon: Trophy, label: "Final Test" },
  { href: "/chat", icon: MessageSquare, label: "AI Tutor" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  const nav = showAdmin
    ? [
        ...NAV,
        { href: "/admin", icon: ShieldCheck, label: "Admin" },
      ]
    : NAV;
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-surface/40 backdrop-blur h-screen sticky top-0">
      <div className="p-5 border-b border-border/60">
        <BrandLogo href="/dashboard" size="md" />
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all focus-ring",
                active
                  ? "bg-primary-soft/60 text-primary shadow-sm"
                  : "text-ink-muted hover:bg-elevated hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {n.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/60 text-xs text-ink-muted">
        {BRAND.shortName} · SC Real Estate
      </div>
    </aside>
  );
}
