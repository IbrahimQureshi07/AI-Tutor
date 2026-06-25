import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCoursePriceUsd } from "@/lib/access/check-access";

export const dynamic = "force-dynamic";

/**
 * Stripe Checkout stub — returns 503 until STRIPE_SECRET_KEY is configured (Step 11).
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to purchase." }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error: "payments_not_configured",
        message:
          "Online checkout is not live yet. Contact your program coordinator to complete enrollment.",
        amountUsd: getCoursePriceUsd(),
      },
      { status: 503 },
    );
  }

  // Step 11: create Stripe Checkout session here.
  return NextResponse.json(
    { error: "payments_not_implemented", message: "Checkout session not wired yet." },
    { status: 501 },
  );
}
