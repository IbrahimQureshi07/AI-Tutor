/* eslint-disable no-console */
/**
 * One-shot setup:
 *   1. Verifies the database schema is in place (sections table exists).
 *   2. Creates / re-uses the admin user (m@gmail.com / 123456) with email
 *      auto-confirmed so login works immediately.
 *   3. Optionally imports questions from data/questions.csv if present and
 *      the questions table is currently empty.
 *
 * Required env (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (from Supabase -> Settings -> API -> service_role)
 *   ADMIN_EMAIL                (default m@gmail.com)
 *   ADMIN_PASSWORD             (default 123456)
 *
 * Run:  npm run setup
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "m@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!URL) fail("NEXT_PUBLIC_SUPABASE_URL missing in .env.local");
if (!SERVICE_KEY || SERVICE_KEY.includes("PASTE_YOUR")) {
  fail(
    "SUPABASE_SERVICE_ROLE_KEY missing in .env.local.\n" +
      "Open Supabase → Project Settings → API → copy the 'service_role' (secret) key,\n" +
      "and paste it into .env.local as SUPABASE_SERVICE_ROLE_KEY=...",
  );
}

const admin = createClient(URL!, SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function checkSchema() {
  const { error } = await admin.from("sections").select("code").limit(1);
  if (error) {
    fail(
      "Database schema not found.\n" +
        "Open Supabase → SQL Editor → paste the contents of\n" +
        "  supabase/migrations/0001_init.sql\n" +
        "and click Run. Then run `npm run setup` again.",
    );
  }
}

async function ensureAdmin() {
  console.log(`→ Ensuring admin user ${ADMIN_EMAIL} exists…`);

  // Look up by email (paginate just in case).
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) fail(`Failed to list users: ${listErr.message}`);
  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
  );

  if (existing) {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata ?? {}), full_name: "Admin", is_admin: true },
    });
    if (updErr) fail(`Failed to update admin: ${updErr.message}`);
    console.log(`  ✓ Updated existing admin (id ${existing.id})`);
    return existing.id;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Admin", is_admin: true },
  });
  if (createErr) fail(`Failed to create admin: ${createErr.message}`);
  console.log(`  ✓ Created admin user (id ${created.user!.id})`);
  return created.user!.id;
}

async function maybeImportQuestions() {
  const csv = resolve("data/questions.csv");
  if (!existsSync(csv)) {
    console.log("→ No data/questions.csv found, skipping import.");
    return;
  }

  const { count, error } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.warn(`  ! Could not count questions: ${error.message}`);
    return;
  }
  if ((count ?? 0) > 0) {
    console.log(`→ ${count} questions already in DB, skipping import.`);
    return;
  }

  console.log("→ Importing questions from data/questions.csv …");
  const r = spawnSync("npx", ["tsx", "scripts/import-questions.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) fail("Question import failed.");
}

async function main() {
  console.log("Fortune Academy — first-time setup\n");
  await checkSchema();
  await ensureAdmin();
  await maybeImportQuestions();

  console.log(`\n✓ Done.\n`);
  console.log(`  Admin login:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Start the app: npm run dev`);
  console.log(`  Then open:    http://localhost:3000/login\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
