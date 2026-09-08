-- Initial CineShield AI schema migration
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scripts" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "file_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'uploaded' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analysis_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "script_id" text NOT NULL REFERENCES "scripts"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'queued' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "stage_message" text,
  "error_message" text,
  "overall_risk_score" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "entities" (
  "id" text PRIMARY KEY NOT NULL,
  "analysis_id" text NOT NULL REFERENCES "analysis_runs"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "risk_findings" (
  "id" text PRIMARY KEY NOT NULL,
  "analysis_id" text NOT NULL REFERENCES "analysis_runs"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "severity" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "scene_id" text,
  "element_id" text,
  "start_offset" integer,
  "end_offset" integer,
  "suggested_action" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "rewrites" (
  "id" text PRIMARY KEY NOT NULL,
  "finding_id" text NOT NULL REFERENCES "risk_findings"("id") ON DELETE CASCADE,
  "original_text" text NOT NULL,
  "suggested_text" text NOT NULL,
  "rationale" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "scripts_project_id_idx" ON "scripts"("project_id");
CREATE INDEX IF NOT EXISTS "analysis_runs_script_id_idx" ON "analysis_runs"("script_id");
CREATE INDEX IF NOT EXISTS "analysis_runs_project_id_idx" ON "analysis_runs"("project_id");
CREATE INDEX IF NOT EXISTS "risk_findings_analysis_id_idx" ON "risk_findings"("analysis_id");
