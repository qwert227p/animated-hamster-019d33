CREATE TABLE "accounts" (
	"user_id" bigint PRIMARY KEY,
	"username" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"place_id" bigint,
	"game_name" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"eggs" jsonb DEFAULT '[]' NOT NULL,
	"stats" jsonb DEFAULT '{}' NOT NULL,
	"session_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
