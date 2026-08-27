import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { SalesSupportCard } from "@/components/brand/sales-support-card";
import { BRAND } from "@/lib/brand";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, target_exam_date")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="text-ink-muted mt-1">
          Manage your profile and preferences with {BRAND.shortName}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How we greet you across the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            initialFullName={profile?.full_name ?? ""}
            initialTargetDate={profile?.target_exam_date ?? ""}
            email={user.email ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account email.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-ink-muted">
            Signed in as <span className="text-ink font-medium">{user.email}</span>
          </div>
        </CardContent>
      </Card>

      <SalesSupportCard />
    </div>
  );
}
