import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background bg-paper">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-8 w-8 rounded-full bg-primary/15 grid place-items-center">
              <div className="h-3 w-3 rounded-full bg-primary" />
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight">
              Tutor<span className="text-primary">.sc</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-muted">
            <a href="#modes" className="hover:text-ink transition-colors">Modes</a>
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#stats" className="hover:text-ink transition-colors">Results</a>
            <Link href="/try" className="hover:text-ink transition-colors">Try demo</Link>
            <Link href="/pricing" className="hover:text-ink transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/try">Try free</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/pricing">Pricing</Link>
            </Button>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border/60 mt-24">
        <div className="container py-10 text-sm text-ink-muted flex flex-col md:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} Tutor.sc — South Carolina real estate prep.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/try" className="hover:text-ink transition-colors">
              Try free demo
            </Link>
            <Link href="/pricing" className="hover:text-ink transition-colors">
              Pricing
            </Link>
            <p>Made for future REALTORS®.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
