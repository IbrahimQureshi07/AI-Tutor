"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { isSharedDemoLoginEnabled } from "@/lib/auth/shared-demo-login";
import { Loader2, Mail, Lock, LogIn, UserPlus, Zap } from "lucide-react";

const showSharedDemoLogin = isSharedDemoLoginEnabled();

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const search = useSearchParams();
  const defaultRedirect = mode === "signup" ? "/unlock" : "/dashboard";
  const redirectTo = search.get("redirectTo") || defaultRedirect;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  /** Synchronous guard — useTransition's pending is too late to stop double-submit rate limits. */
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const title = mode === "login" ? "Welcome back" : "Create your account";
  const sub =
    mode === "login"
      ? "Continue your journey to the SC license."
      : "Create your account, then unlock the full course with a one-time payment.";
  const switchHref = mode === "login" ? "/signup" : "/login";
  const switchText =
    mode === "login" ? "Don't have an account?" : "Already have an account?";
  const switchAction = mode === "login" ? "Sign up" : "Log in";

  async function handleEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
            data: { full_name: fullName },
          },
        });
        if (error) {
          toast.error(formatAuthError(error.message));
          return;
        }
        if (data.session) {
          toast.success("Welcome! You're signed in.");
          router.replace(redirectTo);
          router.refresh();
          return;
        }
        toast.success(
          "Check your email for a confirmation link, then log in here.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          toast.error(formatAuthError(error.message));
          return;
        }
        toast.success("Welcome back.");
        router.replace(redirectTo);
        router.refresh();
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    if (!email) return toast.error("Enter your email first.");
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) {
        toast.error(formatAuthError(error.message));
        return;
      }
      setMagicSent(true);
      toast.success("Magic link sent. Check your inbox.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function handleDemo() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        email?: string;
        password?: string;
        error?: string;
      };
      if (!res.ok || !json.email || !json.password) {
        toast.error(json.error ?? "Could not start demo session.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: json.email,
        password: json.password,
      });
      if (error) {
        toast.error(formatAuthError(error.message));
        return;
      }
      toast.success("You're in. (Demo account)");
      router.replace(redirectTo);
      router.refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) toast.error(formatAuthError(error.message));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-ink-muted">{sub}</p>
      </div>

      {showSharedDemoLogin && (
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() => void handleDemo()}
        >
          <Zap className="h-4 w-4" />
          Skip — try a demo account
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => void handleGoogle()}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 -top-2.5 -translate-x-1/2 bg-background px-3 text-xs uppercase tracking-widest text-ink-muted">
          or with email
        </span>
      </div>

      <form onSubmit={(e) => void handleEmailPassword(e)} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Appleseed"
              autoComplete="name"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="pl-9"
              autoComplete="email"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs text-ink-muted hover:text-ink"
              >
                Forgot?
              </Link>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-9"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
            />
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === "login" ? (
            <LogIn className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {mode === "login" ? "Log in" : "Create account"}
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full"
        disabled={busy || magicSent}
        onClick={() => void handleMagicLink()}
      >
        {magicSent ? "Magic link sent" : "Email me a magic link instead"}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        {switchText}{" "}
        <Link
          href={switchHref}
          className="font-medium text-primary hover:underline"
        >
          {switchAction}
        </Link>
      </p>

      <p className="text-center text-xs text-ink-muted">
        By continuing you agree to our terms and privacy policy.
      </p>
    </div>
  );
}

function formatAuthError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("over_email_send_rate_limit") ||
    m.includes("over_request_rate") ||
    m.includes("429")
  ) {
    return "Too many tries from this browser. Wait about a minute, then use one click (Continue with Google) or try again.";
  }
  return message;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12S6.8 21.5 12 21.5c7 0 9.4-4.9 9.4-7.5 0-.5 0-.9-.1-1.3H12z"
      />
    </svg>
  );
}
