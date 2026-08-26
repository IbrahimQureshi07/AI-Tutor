"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, Users, CircleCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

const STATS = [
  { icon: TrendingUp, n: "+18 pts", l: "Average score lift" },
  { icon: Users, n: "94%", l: "Users feel exam-ready" },
  { icon: CircleCheck, n: "1,200+", l: "Exam-style questions" },
];

export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % STATS.length), 3800);
    return () => clearInterval(t);
  }, []);
  const stat = STATS[i];

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.2fr_1fr]">
      {/* Left: hero */}
      <div className="relative hidden lg:flex flex-col p-12 mesh-gradient overflow-hidden">
        <BrandLogo href="/" size="lg" className="z-10" priority />

        <div className="relative mt-auto z-10 max-w-xl">
          <h1 className="font-serif text-5xl xl:text-6xl font-semibold tracking-tight text-ink leading-[1.05]">
            Pass the South Carolina real estate exam.{" "}
            <span className="text-primary">With a tutor that never sleeps.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-muted">
            Practice, diagnose, simulate. Powered by AI, built for the SC exam.
          </p>

          <div className="mt-10 h-16 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={stat.n}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-4"
              >
                <div className="h-12 w-12 rounded-2xl bg-surface/70 border border-border/60 grid place-items-center backdrop-blur">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-serif text-3xl font-semibold">{stat.n}</div>
                  <div className="text-sm text-ink-muted">{stat.l}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Decorative floating orbs */}
        <div className="absolute top-32 right-24 h-40 w-40 rounded-full bg-primary/10 blur-3xl animate-float" aria-hidden />
        <div className="absolute bottom-24 right-16 h-56 w-56 rounded-full bg-accent/30 blur-3xl animate-float" aria-hidden />
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
