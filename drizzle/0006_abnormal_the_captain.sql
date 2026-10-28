CREATE TABLE "canva_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" integer GENERATED ALWAYS AS IDENTITY (sequence name "canva_jobs_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code_id" uuid NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"claim_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "canva_jobs_sequence_unique" UNIQUE("sequence"),
	CONSTRAINT "canva_jobs_code_id_unique" UNIQUE("code_id"),
	CONSTRAINT "canva_job_status" CHECK ("canva_jobs"."status" in ('QUEUED', 'PROCESSING', 'SENT', 'REVIEW'))
);
--> statement-breakpoint
CREATE TABLE "canva_queue_lock" (
	"id" integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canva_jobs" ADD CONSTRAINT "canva_jobs_code_id_canva_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."canva_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canva_jobs_queue_idx" ON "canva_jobs" USING btree ("status","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "canva_jobs_one_active_idx" ON "canva_jobs" USING btree ("status") WHERE "canva_jobs"."status" = 'PROCESSING';