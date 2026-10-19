import { pgTable, bigint, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";

export type Entry = { name: string; count: number; kind?: string };

export const accounts = pgTable("accounts", {
  userId: bigint("user_id", { mode: "number" }).primaryKey(),
  username: text().notNull(),
  displayName: text("display_name").notNull().default(""),
  placeId: bigint("place_id", { mode: "number" }),
  gameName: text("game_name").notNull().default(""),
  items: jsonb().$type<Entry[]>().notNull().default([]),
  eggs: jsonb().$type<Entry[]>().notNull().default([]),
  stats: jsonb().$type<Record<string, string | number>>().notNull().default({}),
  sessionSeconds: integer("session_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
