import Link from "next/link";
import { LockKeyhole, LayoutDashboard } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAppUser } from "@/lib/auth/request-session";
import { getAccessState, isModeDisabled } from "@/lib/access/check-access";
import { MODES, type ModeKey } from "@/lib/constants";

const MODE_KEYS = Object.keys(MODES) as ModeKey[];

export default async function ModeLockedPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode = MODE_KEYS.includes(rawMode as ModeKey)
    ? (rawMode as ModeKey)
    : null;

  if (!mode) redirect("/dashboard");

  const { supabase, user } = await requireAppUser();
  const access = await getAccessState(supabase, user);

  // Never leave a stale lock screen accessible after an admin unlocks it.
  if (!isModeDisabled(access, mode)) redirect("/dashboard");

  const label = MODES[mode].label;

  return (
    <div className="mx-auto max-w-2xl py-8 md:py-16">
      <Card className="overflow-hidden">
        <CardContent className="relative p-8 text-center md:p-12">
          <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
          <div className="relative">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warn/15 text-warn">
              <LockKeyhole className="h-7 w-7" />
            </div>
            <Badge variant="warn" className="mt-5">
              Locked by administrator
            </Badge>
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
              {label} is currently locked
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-ink-muted leading-relaxed">
              An administrator has temporarily disabled this section for your
              account. Payment or course progress cannot unlock it; only an
              administrator can turn this section back on.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              Contact your course administrator if you believe this is a mistake.
            </p>
            <div className="mt-7 flex justify-center">
              <Button asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
