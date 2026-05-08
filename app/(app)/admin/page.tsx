import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminHomePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          Admin Console
        </h1>
        <p className="text-ink-muted mt-1">
          You are signed in with admin access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access is active</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-muted">
            Admin route guard is now enforced. Next step: wire user management
            and question management screens here.
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild size="sm">
              <Link href="/admin/users">Manage users</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/questions">Manage questions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

