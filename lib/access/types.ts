export type AccessStatus = "none" | "demo_completed" | "active" | "expired";

export type PaymentProvider = "manual" | "stripe";

export type AccessProfile = {
  role: string | null;
  is_active: boolean | null;
  access_status: AccessStatus | null;
  paid_at: string | null;
  payment_provider: PaymentProvider | null;
};

export type AccessState = {
  /** False until migration 0006 is applied on Supabase. */
  migrationApplied: boolean;
  status: AccessStatus;
  hasFullAccess: boolean;
  isAdmin: boolean;
  /** True when user should see /unlock or /pricing instead of the app. */
  needsPaywall: boolean;
  paidAt: string | null;
  paymentProvider: PaymentProvider | null;
};
