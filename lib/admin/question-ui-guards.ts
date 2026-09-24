import { toast } from "sonner";
import { BULK_DELETE_CONFIRM_PHRASE } from "@/lib/admin/bulk-delete-confirm";

export { BULK_DELETE_CONFIRM_PHRASE };

/**
 * Two-step destructive confirm: OK dialog, then optional typed phrase.
 * Returns false if the user cancels or mistypes.
 */
export function confirmDangerousAction(opts: {
  summary: string;
  details: string[];
  /** Exact string the user must type (e.g. "DELETE"). */
  typeToConfirm?: string;
}): boolean {
  const lines = [
    opts.summary,
    "",
    ...opts.details,
    "",
    "This cannot be undone.",
  ];
  if (!window.confirm(lines.join("\n"))) return false;

  if (opts.typeToConfirm) {
    const typed = window.prompt(
      `Type ${opts.typeToConfirm} to confirm permanently:`,
      "",
    );
    if (typed !== opts.typeToConfirm) {
      if (typed != null) {
        toast.error(
          `Confirmation cancelled — type ${opts.typeToConfirm} exactly.`,
        );
      }
      return false;
    }
  }
  return true;
}

/** Map admin API failures to a clear toast (401/403/generic). */
export function toastAdminError(
  res: Response,
  json: { error?: unknown },
  fallback: string,
): void {
  const fromApi = typeof json.error === "string" ? json.error.trim() : "";
  if (res.status === 401) {
    toast.error(fromApi || "Sign in required.");
    return;
  }
  if (res.status === 403) {
    toast.error(fromApi || "Admin access required.");
    return;
  }
  toast.error(fromApi || fallback);
}
