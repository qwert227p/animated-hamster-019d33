import type { Config } from "@netlify/functions";
import { desc, gt, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { accounts } from "../../db/schema.js";

const HIDE_AFTER_MS = 24 * 3600 * 1000;

export default async (req: Request) => {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (id) {
    const [row] = await db.select().from(accounts).where(eq(accounts.userId, id));
    if (!row) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ now: Date.now(), account: row });
  }
  const rows = await db
    .select()
    .from(accounts)
    .where(gt(accounts.updatedAt, new Date(Date.now() - HIDE_AFTER_MS)))
    .orderBy(desc(accounts.updatedAt))
    .limit(500);
  return Response.json({ now: Date.now(), accounts: rows }, { headers: { "cache-control": "no-store" } });
};

export const config: Config = { path: "/api/accounts" };
