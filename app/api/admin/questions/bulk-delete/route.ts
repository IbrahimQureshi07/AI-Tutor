import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminGuardResponse, adminMisconfiguredResponse } from "@/lib/admin/admin-http";
import { BULK_DELETE_CONFIRM_PHRASE } from "@/lib/admin/bulk-delete-confirm";
import {
  applyQuestionListFilters,
  cleanQuestionSearch,
  describeQuestionFilter,
  hasQuestionDeleteScope,
  parseQuestionGroup,
  parseQuestionSection,
  parseQuestionSource,
  resolveQuestionSectionCodes,
} from "@/lib/admin/question-list-filters";

export const dynamic = "force-dynamic";

const DELETE_PAGE = 500;
const DELETE_MAX = 20_000;

const FilterBody = z.object({
  mode: z.literal("filter"),
  source: z.enum(["dataset", "llm", "both"]),
  section: z.string().optional(),
  group: z.enum(["all", "national", "state"]).optional(),
  q: z.string().optional(),
  /** Must match live matching count (stale UI guard). */
  confirmCount: z.number().int().positive().max(DELETE_MAX),
  confirmPhrase: z.literal(BULK_DELETE_CONFIRM_PHRASE),
});

const IdsBody = z.object({
  mode: z.literal("ids"),
  ids: z.array(z.string().uuid()).min(1).max(DELETE_MAX),
  confirmPhrase: z.literal(BULK_DELETE_CONFIRM_PHRASE),
});

const Body = z.discriminatedUnion("mode", [FilterBody, IdsBody]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return adminGuardResponse(guard);
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return adminMisconfiguredResponse();
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Invalid bulk delete payload. Confirm count/ids and type DELETE.",
      },
      { status: 400 },
    );
  }

  if (parsed.data.mode === "ids") {
    const unique = Array.from(new Set(parsed.data.ids));
    let deleted = 0;
    for (let i = 0; i < unique.length; i += DELETE_PAGE) {
      const chunk = unique.slice(i, i + DELETE_PAGE);
      const { data, error } = await admin
        .from("questions")
        .delete()
        .in("id", chunk)
        .select("id");
      if (error) {
        return NextResponse.json(
          { error: error.message, deleted },
          { status: 500 },
        );
      }
      deleted += data?.length ?? 0;
    }
    return NextResponse.json({
      deleted,
      mode: "ids",
    });
  }

  const source = parseQuestionSource(parsed.data.source);
  const group = parseQuestionGroup(parsed.data.group ?? "all");
  const section = parseQuestionSection(parsed.data.section ?? "all");
  const q = cleanQuestionSearch(parsed.data.q);
  const sectionCodes = resolveQuestionSectionCodes(section, group);
  const filterDesc = describeQuestionFilter({ source, section, group, q });

  if (!hasQuestionDeleteScope({ source, section, group, q })) {
    return NextResponse.json(
      {
        error:
          "Add a source, section, group, or search filter before bulk delete. Refusing to wipe the entire bank.",
      },
      { status: 400 },
    );
  }

  const filters = { source, sectionCodes, q };

  let countQuery = admin
    .from("questions")
    .select("id", { count: "exact", head: true });
  countQuery = applyQuestionListFilters(countQuery as never, filters) as typeof countQuery;
  const { count, error: countError } = await countQuery;
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const liveCount = count ?? 0;
  if (liveCount === 0) {
    return NextResponse.json({ error: "No questions match these filters." }, { status: 404 });
  }
  if (liveCount !== parsed.data.confirmCount) {
    return NextResponse.json(
      {
        error: `Count changed. Expected ${parsed.data.confirmCount}, found ${liveCount}. Refresh and try again.`,
        totalMatching: liveCount,
        filter: filterDesc,
      },
      { status: 409 },
    );
  }
  if (liveCount > DELETE_MAX) {
    return NextResponse.json(
      {
        error: `Too many matches (${liveCount}). Narrow filters (max ${DELETE_MAX}).`,
        totalMatching: liveCount,
      },
      { status: 400 },
    );
  }

  let deleted = 0;
  for (;;) {
    let idQuery = admin
      .from("questions")
      .select("id")
      .order("id", { ascending: true })
      .range(0, DELETE_PAGE - 1);
    idQuery = applyQuestionListFilters(idQuery as never, filters) as typeof idQuery;
    const { data: rows, error: selectError } = await idQuery;
    if (selectError) {
      return NextResponse.json(
        { error: selectError.message, deleted, filter: filterDesc },
        { status: 500 },
      );
    }
    const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) break;

    const { data: removed, error: deleteError } = await admin
      .from("questions")
      .delete()
      .in("id", ids)
      .select("id");
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message, deleted, filter: filterDesc },
        { status: 500 },
      );
    }
    deleted += removed?.length ?? 0;
    if (deleted >= liveCount) break;
    if (ids.length < DELETE_PAGE) break;
  }

  return NextResponse.json({
    deleted,
    mode: "filter",
    filter: filterDesc,
    source,
    section,
    group,
  });
}
