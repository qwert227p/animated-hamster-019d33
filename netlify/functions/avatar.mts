import type { Config } from "@netlify/functions";

// Proxies Roblox headshot lookups (the thumbnails API has no CORS headers).
export default async (req: Request) => {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",").map((s) => s.trim()).filter((s) => /^\d+$/.test(s)).slice(0, 100);
  if (!ids.length) return Response.json({});
  try {
    const r = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids.join(",")}&size=150x150&format=Png&isCircular=false`,
    );
    const j: any = await r.json();
    const out: Record<string, string> = {};
    for (const d of j.data ?? []) if (d.imageUrl) out[d.targetId] = d.imageUrl;
    return Response.json(out, { headers: { "cache-control": "public, max-age=3600" } });
  } catch {
    return Response.json({});
  }
};

export const config: Config = { path: "/api/avatar" };
