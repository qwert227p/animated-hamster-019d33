import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { accounts, type Entry } from "../../db/schema.js";

const MAX_ENTRIES = 300;

function cleanList(v: unknown): Entry[] {
  if (!Array.isArray(v)) return [];
  const out: Entry[] = [];
  for (const e of v.slice(0, MAX_ENTRIES)) {
    if (!e || typeof e !== "object") continue;
    const name = String((e as any).name ?? "").slice(0, 80).trim();
    if (!name) continue;
    const count = Math.max(0, Math.min(1e9, Math.floor(Number((e as any).count) || 1)));
    const kind = (e as any).kind ? String((e as any).kind).slice(0, 40) : undefined;
    out.push(kind ? { name, count, kind } : { name, count });
  }
  return out;
}

function cleanStats(v: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, val] of Object.entries(v).slice(0, 30)) {
    out[String(k).slice(0, 40)] = typeof val === "number" ? val : String(val).slice(0, 80);
  }
  return out;
}

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // If MAIKO_KEY is set on the site, reporters must send it.
  const key = process.env.MAIKO_KEY;
  if (key && req.headers.get("x-maiko-key") !== key) {
    return Response.json({ error: "bad key" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }

  const userId = Math.floor(Number(body.user_id));
  const username = String(body.username ?? "").slice(0, 40).trim();
  if (!userId || userId < 1 || !username) return Response.json({ error: "user_id and username required" }, { status: 400 });

  const row = {
    userId,
    username,
    displayName: String(body.display_name ?? username).slice(0, 40),
    placeId: Number(body.place_id) || null,
    gameName: String(body.game_name ?? "").slice(0, 80),
    items: cleanList(body.items),
    eggs: cleanList(body.eggs),
    stats: cleanStats(body.stats),
    sessionSeconds: Math.max(0, Math.floor(Number(body.session_seconds) || 0)),
    updatedAt: new Date(),
  };

  await db.insert(accounts).values(row).onConflictDoUpdate({ target: accounts.userId, set: row });
  return Response.json({ ok: true });
};

export const config: Config = { path: "/api/report" };
