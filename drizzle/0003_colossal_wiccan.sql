ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
--> statement-breakpoint
DELETE FROM "sessions" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "role" IN ('OWNER', 'ADMIN'));
